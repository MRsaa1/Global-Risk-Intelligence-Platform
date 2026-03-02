# NVIDIA cuRAG and Morpheus Integration

## cuRAG (GPU-Accelerated Document RAG)

### Overview

cuRAG provides GPU-accelerated indexing and semantic retrieval for large document sets (PDFs, internal docs, regulations). When enabled, the NeMo Retriever can query a cuRAG vector store in addition to the Knowledge Graph and historical events.

### Requirements

- **GPU**: Recommended for meaningful speedup; nvidia-rag can run on CPU with reduced performance.
- **Python**: The optional dependency `nvidia-rag` may require Python 3.12 (see PyPI). The API runs without it; when the package is missing, cuRAG is a no-op (retrieve returns [], index_documents does nothing).

### Configuration

In `apps/api/.env` or environment:

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_CURAG` | `false` | Set to `true` to enable cuRAG indexing and retrieval. |
| `CURAG_INDEX_PATH` | (empty) | Directory for index persistence. Empty = in-memory only (index lost on restart). |
| `CURAG_EMBEDDING_MODEL` | (empty) | Optional override for embedding model; empty = nvidia-rag default. |

### Optional dependency

Install the optional extra (when using Python version compatible with nvidia-rag):

```bash
cd apps/api && pip install -e ".[curag]"
```

If you do not install it, the service still starts; cuRAG will be disabled and no error is raised.

### API

- **POST /api/v1/rag/documents**  
  Index documents for cuRAG.
  - **Multipart**: upload one or more files (PDF or text).  
  - **Form field `texts_json`**: optional JSON array of strings, e.g. `["snippet 1", "snippet 2"]`.  
  - Response: `{ "indexed_count": N, "skipped": M, "errors": [] }`.

- **GET /api/v1/rag/status**  
  Returns `enable_curag`, `available` (whether nvidia-rag is ready), and `curag_index_path`.

### Using cuRAG in RAG queries

When cuRAG is enabled, include `"vector_store"` or `"curag"` in the `sources` list when calling the NeMo Retriever (e.g. from agents or AIQ). Example: `sources=["relational_db", "historical_events", "vector_store"]`. By default, `get_context_for_analysis` does not add `vector_store`, so existing behavior is unchanged until you opt in via config or parameters.

---

## Morpheus (Agent Output Validation)

### Overview

Morpheus is an optional layer that validates agent input/output for data leaks and hallucinations. It runs after NeMo Guardrails checks. When enabled, agent responses (ADVISOR, AIQ, REPORTER, etc.) are sent to a Morpheus validation service; a failed check adds a violation and can block or redact the response.

### Requirements

- A Morpheus validation service exposing an HTTP endpoint (e.g. a container running a Morpheus pipeline that accepts POST with `input`, `output`, `context` and returns pass/fail and flags).

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_MORPHEUS` | `false` | Set to `true` to call Morpheus after Guardrails. |
| `MORPHEUS_VALIDATION_URL` | (empty) | URL of the validation endpoint, e.g. `http://morpheus:8080/validate`. |
| `MORPHEUS_TIMEOUT_SEC` | `10.0` | Timeout in seconds for the validation request. |

### API contract (Morpheus service)

- **Request**: POST JSON `{ "input": str, "output": str, "context": dict }`.
- **Response**: JSON with at least `passed: bool`; optional `flags: list`, `detail: str`.  
  On timeout or network error, the platform treats the check as passed and logs a warning so production is not broken.

### Where it runs

All flows that already use NeMo Guardrails (ADVISOR, AIQ disclosure draft, agentic orchestrator) automatically get Morpheus validation when `ENABLE_MORPHEUS` and `MORPHEUS_VALIDATION_URL` are set. No per-agent code change is required.

---

## See also

- [NVIDIA_NEMO_INTEGRATION.md](NVIDIA_NEMO_INTEGRATION.md) — NeMo Retriever and Guardrails
- [NVIDIA_AGENTS_STACK.md](NVIDIA_AGENTS_STACK.md) — Agent stack overview
