"""
NVIDIA NeMo Retriever - RAG Pipeline for Agents.

Provides retrieval-augmented generation (RAG) to connect agents to:
- Knowledge Graph (Neo4j)
- Historical events database
- Vector store for semantic search
"""
import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import httpx
from sqlalchemy import select, or_, desc

from src.core.config import settings
from src.services.knowledge_graph import get_knowledge_graph_service

logger = logging.getLogger(__name__)


@dataclass
class RetrievalResult:
    """Result from RAG retrieval."""
    query: str
    retrieved_documents: List[Dict[str, Any]]
    knowledge_graph_context: Optional[Dict[str, Any]] = None
    historical_events: Optional[List[Dict[str, Any]]] = None
    total_results: int = 0
    retrieval_time_ms: float = 0.0


class NeMoRetrieverService:
    """
    NeMo Retriever Service for RAG pipeline.
    
    Connects agents to:
    - Knowledge Graph (Neo4j) for dependency queries
    - Historical events for context
    - Vector store for semantic search (future)
    """
    
    def __init__(self):
        self.enabled = getattr(settings, 'nemo_retriever_enabled', True)
        self.embedding_model = getattr(settings, 'nemo_embedding_model', 'nvidia/nv-embedqa-e5-v5')
        self.rerank_model = getattr(settings, 'nemo_rerank_model', 'nvidia/nv-rerankqa-mistral-4b-v3')
        
        # API endpoints (if using NVIDIA Cloud API)
        self.nvidia_api_key = getattr(settings, 'nvidia_api_key', '') or ''
        self.embedding_url = f"https://integrate.api.nvidia.com/v1/embeddings"
        self.rerank_url = f"https://integrate.api.nvidia.com/v1/rerank"
        
        self.http_client = httpx.AsyncClient(
            timeout=30.0,
            headers={
                'Authorization': f'Bearer {self.nvidia_api_key}',
                'Content-Type': 'application/json'
            } if self.nvidia_api_key else {}
        )
    
    async def retrieve(
        self,
        query: str,
        top_k: int = 5,
        sources: Optional[List[str]] = None,
        asset_id: Optional[str] = None,
    ) -> RetrievalResult:
        """
        Retrieve relevant context for a query.
        
        Args:
            query: Query string
            top_k: Number of results to return
            sources: Sources to search (knowledge_graph, historical_events, vector_store)
            asset_id: Optional asset ID for context
            
        Returns:
            RetrievalResult with retrieved documents and context
        """
        import time
        start_time = time.time()
        
        if not self.enabled:
            logger.debug("NeMo Retriever disabled, returning empty result")
            return RetrievalResult(
                query=query,
                retrieved_documents=[],
                total_results=0,
                retrieval_time_ms=0.0
            )
        
        # Default: use relational DB + historical events; add KG when enabled.
        sources = sources or ["relational_db", "historical_events", "knowledge_graph"]
        retrieved_docs = []
        kg_context = None
        historical_events = None
        
        # 1. Query Knowledge Graph
        if "knowledge_graph" in sources:
            try:
                # KG is optional; skip when disabled to avoid noisy errors.
                if not getattr(settings, "enable_neo4j", False):
                    raise RuntimeError("knowledge_graph disabled")
                kg_context = await self._query_knowledge_graph(query, asset_id, top_k)
                if kg_context:
                    retrieved_docs.extend(kg_context.get("nodes", []))
                    retrieved_docs.extend(kg_context.get("relationships", []))
            except Exception as e:
                if "knowledge_graph disabled" in str(e):
                    logger.debug("Knowledge Graph skipped (disabled)")
                else:
                    logger.warning(f"Knowledge Graph query failed: {e}")

        # 1b. Query relational DB entities (assets, stress tests, projects, etc.)
        if "relational_db" in sources:
            try:
                rel_docs = await self._query_relational_db(query, top_k=top_k * 5)
                if rel_docs:
                    retrieved_docs.extend(rel_docs)
            except Exception as e:
                logger.warning(f"Relational DB query failed: {e}")
        
        # 2. Query Historical Events
        if "historical_events" in sources:
            try:
                historical_events = await self._query_historical_events(query, top_k)
                if historical_events:
                    retrieved_docs.extend(historical_events)
            except Exception as e:
                logger.warning(f"Historical events query failed: {e}")
        
        # 2b. Query cuRAG / vector store (when enabled and requested)
        if ("vector_store" in sources or "curag" in sources) and getattr(settings, "enable_curag", False):
            try:
                from src.services.curag_retriever import retrieve as curag_retrieve
                curag_docs = await curag_retrieve(query, top_k=top_k)
                if curag_docs:
                    retrieved_docs.extend(curag_docs)
            except Exception as e:
                logger.warning(f"cuRAG/vector_store query failed: {e}")
        
        # 3. Rerank results (if we have embedding capability)
        if len(retrieved_docs) > top_k and self.nvidia_api_key:
            try:
                retrieved_docs = await self._rerank(query, retrieved_docs, top_k)
            except Exception as e:
                logger.warning(f"Reranking failed, using top {top_k}: {e}")
                retrieved_docs = retrieved_docs[:top_k]
        else:
            retrieved_docs = retrieved_docs[:top_k]
        
        retrieval_time = (time.time() - start_time) * 1000
        
        return RetrievalResult(
            query=query,
            retrieved_documents=retrieved_docs,
            knowledge_graph_context=kg_context,
            historical_events=historical_events,
            total_results=len(retrieved_docs),
            retrieval_time_ms=retrieval_time
        )

    async def _query_relational_db(self, query: str, top_k: int = 20) -> List[Dict[str, Any]]:
        """
        Lightweight retrieval from the primary relational DB.
        This is NOT a vector store; it provides high-recall candidates for rerank().
        """
        from src.core.database import AsyncSessionLocal
        from src.models.asset import Asset
        from src.models.stress_test import StressTest, RiskZone
        from src.models.project import Project
        from src.models.portfolio import Portfolio
        from src.models.fraud import DamageClaim

        pattern = f"%{query}%"
        docs: List[Dict[str, Any]] = []

        def _add(doc: Dict[str, Any]):
            docs.append(doc)

        async with AsyncSessionLocal() as session:
            # Assets
            try:
                q = (
                    select(Asset)
                    .where(or_(Asset.name.ilike(pattern), Asset.description.ilike(pattern), Asset.address.ilike(pattern)))
                    .order_by(desc(Asset.updated_at), desc(Asset.created_at))
                    .limit(min(top_k, 20))
                )
                rows = (await session.execute(q)).scalars().all()
                for a in rows:
                    _add(
                        {
                            "source": "relational_db",
                            "entity": "asset",
                            "id": str(a.id),
                            "title": a.name,
                            "snippet": (a.description or a.address or "")[:500],
                            "url": f"/assets/{a.id}",
                        }
                    )
            except Exception as e:
                logger.debug("Relational retrieval (assets) failed: %s", e)

            # Stress tests
            try:
                q = (
                    select(StressTest)
                    .where(or_(StressTest.name.ilike(pattern), StressTest.description.ilike(pattern), StressTest.region_name.ilike(pattern)))
                    .order_by(desc(StressTest.updated_at), desc(StressTest.created_at))
                    .limit(min(top_k, 20))
                )
                rows = (await session.execute(q)).scalars().all()
                for st in rows:
                    _add(
                        {
                            "source": "relational_db",
                            "entity": "stress_test",
                            "id": str(st.id),
                            "title": st.name,
                            "snippet": (st.description or st.region_name or "")[:500],
                            "url": f"/stress-tests/{st.id}",
                        }
                    )
            except Exception as e:
                logger.debug("Relational retrieval (stress_tests) failed: %s", e)

            # Risk zones
            try:
                q = (
                    select(RiskZone)
                    .where(or_(RiskZone.name.ilike(pattern), RiskZone.description.ilike(pattern)))
                    .order_by(desc(RiskZone.expected_loss))
                    .limit(min(top_k, 20))
                )
                rows = (await session.execute(q)).scalars().all()
                for rz in rows:
                    _add(
                        {
                            "source": "relational_db",
                            "entity": "risk_zone",
                            "id": str(rz.id),
                            "title": rz.name or f"Risk Zone {rz.id}",
                            "snippet": (rz.description or rz.zone_level or "")[:500],
                            "url": f"/stress-tests/{rz.stress_test_id}",
                        }
                    )
            except Exception as e:
                logger.debug("Relational retrieval (risk_zones) failed: %s", e)

            # Projects
            try:
                q = (
                    select(Project)
                    .where(or_(Project.name.ilike(pattern), Project.description.ilike(pattern), Project.code.ilike(pattern), Project.city.ilike(pattern)))
                    .order_by(desc(Project.updated_at), desc(Project.created_at))
                    .limit(min(top_k, 20))
                )
                rows = (await session.execute(q)).scalars().all()
                for p in rows:
                    _add(
                        {
                            "source": "relational_db",
                            "entity": "project",
                            "id": str(p.id),
                            "title": p.name,
                            "snippet": (p.description or p.city or p.code or "")[:500],
                            "url": f"/projects/{p.id}",
                        }
                    )
            except Exception as e:
                logger.debug("Relational retrieval (projects) failed: %s", e)

            # Portfolios
            try:
                q = (
                    select(Portfolio)
                    .where(or_(Portfolio.name.ilike(pattern), Portfolio.description.ilike(pattern), Portfolio.code.ilike(pattern)))
                    .order_by(desc(Portfolio.updated_at), desc(Portfolio.created_at))
                    .limit(min(top_k, 20))
                )
                rows = (await session.execute(q)).scalars().all()
                for p in rows:
                    _add(
                        {
                            "source": "relational_db",
                            "entity": "portfolio",
                            "id": str(p.id),
                            "title": p.name,
                            "snippet": (p.description or p.code or "")[:500],
                            "url": f"/portfolios/{p.id}",
                        }
                    )
            except Exception as e:
                logger.debug("Relational retrieval (portfolios) failed: %s", e)

            # Fraud claims
            try:
                q = (
                    select(DamageClaim)
                    .where(or_(DamageClaim.title.ilike(pattern), DamageClaim.description.ilike(pattern), DamageClaim.claim_number.ilike(pattern)))
                    .order_by(desc(DamageClaim.reported_at))
                    .limit(min(top_k, 20))
                )
                rows = (await session.execute(q)).scalars().all()
                for c in rows:
                    _add(
                        {
                            "source": "relational_db",
                            "entity": "fraud_claim",
                            "id": str(c.id),
                            "title": c.title,
                            "snippet": (c.description or c.claim_number or "")[:500],
                            "url": f"/fraud/claims/{c.id}",
                        }
                    )
            except Exception as e:
                logger.debug("Relational retrieval (fraud_claims) failed: %s", e)

        # Deduplicate
        seen = set()
        out: List[Dict[str, Any]] = []
        for d in docs:
            key = (d.get("entity"), d.get("id"))
            if key in seen:
                continue
            seen.add(key)
            out.append(d)

        return out[:top_k]
    
    async def _query_knowledge_graph(
        self,
        query: str,
        asset_id: Optional[str],
        top_k: int
    ) -> Optional[Dict[str, Any]]:
        """Query Knowledge Graph for relevant nodes and relationships."""
        try:
            kg_service = get_knowledge_graph_service()
            
            # Build Cypher query based on query text
            if asset_id:
                # Query specific asset and its dependencies
                cypher_query = """
                MATCH (asset:Asset {id: $asset_id})
                OPTIONAL MATCH (asset)-[r1:DEPENDS_ON|SUPPLIES_TO|CASCADES_TO*1..3]-(related)
                RETURN asset, collect(DISTINCT related) as related_nodes, 
                       collect(DISTINCT r1) as relationships
                LIMIT $limit
                """
                async with kg_service.driver.session() as session:
                    result = await session.run(
                        cypher_query,
                        asset_id=asset_id,
                        limit=top_k
                    )
                    record = await result.single()
                    if record:
                        return {
                            "nodes": [dict(record["asset"])] if record["asset"] else [],
                            "relationships": [dict(r) for r in record["relationships"]] if record["relationships"] else []
                        }
            else:
                # General query - search by name or properties
                # Use $search_text (not $query) to avoid clashing with session.run(query, ...)
                cypher_query = """
                MATCH (n)
                WHERE n.name CONTAINS $search_text
                   OR n.description CONTAINS $search_text
                   OR any(prop in keys(n) WHERE toString(n[prop]) CONTAINS $search_text)
                OPTIONAL MATCH (n)-[r]-(related)
                RETURN n, collect(DISTINCT related)[0..$limit] as related_nodes,
                       collect(DISTINCT r)[0..$limit] as relationships
                LIMIT $limit
                """
                async with kg_service.driver.session() as session:
                    result = await session.run(
                        cypher_query,
                        {"search_text": query.lower(), "limit": top_k}
                    )
                    nodes = []
                    relationships = []
                    async for record in result:
                        if record["n"]:
                            nodes.append(dict(record["n"]))
                        if record["relationships"]:
                            relationships.extend([dict(r) for r in record["relationships"]])
                    
                    if nodes or relationships:
                        return {
                            "nodes": nodes[:top_k],
                            "relationships": relationships[:top_k]
                        }
            
            return None
        except Exception as e:
            logger.error(f"Knowledge Graph query error: {e}")
            return None
    
    async def _query_historical_events(
        self,
        query: str,
        top_k: int
    ) -> List[Dict[str, Any]]:
        """Query historical events database for similar events."""
        try:
            from src.core.database import AsyncSessionLocal
            from src.models.historical_event import HistoricalEvent
            
            # Simple text search in historical events
            # In production, would use vector embeddings
            pattern = f"%{query}%"
            async with AsyncSessionLocal() as session:
                # Query using ORM
                query_obj = select(HistoricalEvent).where(
                    or_(
                        HistoricalEvent.name.ilike(pattern),
                        HistoricalEvent.description.ilike(pattern),
                        HistoricalEvent.event_type.ilike(pattern)
                    )
                )
                
                # Order by created_at (always available)
                query_obj = query_obj.order_by(desc(HistoricalEvent.created_at)).limit(top_k)
                
                result = await session.execute(query_obj)
                events_orm = result.scalars().all()
                
                # Convert to dict format
                raw_events = []
                for event in events_orm:
                    raw_events.append({
                        "id": str(event.id),
                        "name": event.name,
                        "event_type": event.event_type,
                        "title": event.name,  # Use 'name' field
                        "description": event.description,
                        "start_date": event.start_date.isoformat() if event.start_date else None,
                        "end_date": event.end_date.isoformat() if event.end_date else None,
                        "location": event.region_name or f"{event.center_latitude},{event.center_longitude}" if event.center_latitude else None,
                        "severity": event.severity_actual or 0.5,
                        "severity_actual": event.severity_actual,
                        "impact": float(event.financial_loss_eur) if event.financial_loss_eur else 0.0,
                        "financial_loss_eur": event.financial_loss_eur,
                        "occurred_at": event.start_date.isoformat() if event.start_date else (event.created_at.isoformat() if event.created_at else None),
                        "relevance": 0.7  # Simple relevance score
                    })
                
                # Clean data with Curator if enabled
                try:
                    from src.services.nemo_curator import get_nemo_curator_service
                    curator = get_nemo_curator_service()
                    if curator.enabled and curator.auto_clean_enabled:
                        curation_result = await curator.clean_historical_events(
                            raw_events,
                            filters=["duplicates", "outliers", "invalid_dates"]
                        )
                        # Use cleaned events (simplified - take first cleaned_count)
                        events = raw_events[:curation_result.cleaned_count][:top_k]
                    else:
                        events = raw_events[:top_k]
                except Exception as e:
                    logger.debug(f"Curator integration failed, using raw events: {e}")
                    events = raw_events[:top_k]
                
                return events
        except Exception as e:
            logger.warning(f"Historical events query failed: {e}")
            # Fallback: return empty list (better than mock data)
            return []
    
    async def _rerank(
        self,
        query: str,
        documents: List[Dict[str, Any]],
        top_k: int
    ) -> List[Dict[str, Any]]:
        """Rerank documents by relevance to query."""
        if not self.nvidia_api_key or not documents:
            return documents[:top_k]
        
        try:
            # Use NVIDIA reranking API
            def _doc_text(doc: Dict[str, Any]) -> str:
                title = (doc.get("title") or doc.get("name") or doc.get("id") or "").strip()
                snippet = (doc.get("snippet") or doc.get("description") or "").strip()
                entity = (doc.get("entity") or doc.get("event_type") or "").strip()
                return "\n".join([line for line in [f"[{entity}] {title}".strip(), snippet] if line])

            response = await self.http_client.post(
                self.rerank_url,
                json={
                    "model": self.rerank_model,
                    "query": query,
                    "documents": [_doc_text(doc) for doc in documents[:20]]  # Limit for API
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                ranked_indices = [item["index"] for item in data.get("results", [])]
                reranked = [documents[i] for i in ranked_indices if i < len(documents)]
                return reranked[:top_k]
            else:
                logger.warning(f"Reranking API returned {response.status_code}")
                return documents[:top_k]
        except Exception as e:
            logger.warning(f"Reranking failed: {e}")
            return documents[:top_k]
    
    async def get_context_for_analysis(
        self,
        subject: str,
        subject_id: Optional[str] = None,
        query: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get comprehensive context for agent analysis.
        
        Args:
            subject: Type of subject (asset, alert, event)
            subject_id: ID of the subject
            query: Optional query string
            
        Returns:
            Context dictionary with all relevant information
        """
        if not query:
            query = f"Analysis context for {subject} {subject_id or ''}"
        
        result = await self.retrieve(
            query=query,
            top_k=10,
            sources=["knowledge_graph", "historical_events"],
            asset_id=subject_id if subject == "asset" else None
        )
        
        return {
            "query": query,
            "knowledge_graph": result.knowledge_graph_context,
            "historical_events": result.historical_events,
            "retrieved_documents": result.retrieved_documents,
            "total_results": result.total_results,
            "retrieval_time_ms": result.retrieval_time_ms
        }


# Global service instance
_nemo_retriever_service: Optional[NeMoRetrieverService] = None


def get_nemo_retriever_service() -> NeMoRetrieverService:
    """Get or create NeMo Retriever service instance."""
    global _nemo_retriever_service
    if _nemo_retriever_service is None:
        _nemo_retriever_service = NeMoRetrieverService()
    return _nemo_retriever_service


# Convenience alias
nemo_retriever = get_nemo_retriever_service()
