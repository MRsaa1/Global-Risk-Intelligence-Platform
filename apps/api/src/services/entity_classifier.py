"""
Entity Classifier - Abstraction for organization/entity type classification.

Current implementation: uses risk_zone_calculator.detect_entity_type (ontology + keywords).
Interface is designed so a fine-tuned BERT/RoBERTa model can be plugged in later
(e.g. load from "palantir/entity-classifier-v3" or project-trained model) for higher accuracy.
"""
from dataclasses import dataclass
from typing import Optional

from src.services.risk_zone_calculator import detect_entity_type


@dataclass
class EntityProfile:
    """Classification result for an entity."""
    entity_name: str
    suggested_type: str  # HEALTHCARE, FINANCIAL, etc.
    confidence: float  # 0-1; 1.0 when using keyword/ontology
    source: str = "ontology"  # "ontology" | "bert" | "external"


class EntityClassifierService:
    """
    Classifies entity type from name (and optional context).
    Uses ontology/keywords by default; can be extended with fine-tuned BERT.
    """

    def __init__(self, use_fine_tuned: bool = False):
        self.use_fine_tuned = use_fine_tuned
        self._model = None  # Placeholder for future: AutoModelForSequenceClassification

    def classify(self, entity_name: str, context: Optional[dict] = None) -> EntityProfile:
        """
        Classify entity type from name. Optional context for future BERT input.
        Returns EntityProfile with suggested_type and confidence.
        """
        if not entity_name or not entity_name.strip():
            return EntityProfile(
                entity_name=entity_name or "",
                suggested_type="CITY_REGION",
                confidence=1.0,
                source="ontology",
            )
        # Current: ontology + keyword-based
        suggested_type = detect_entity_type(entity_name)
        return EntityProfile(
            entity_name=entity_name.strip(),
            suggested_type=suggested_type,
            confidence=1.0,
            source="ontology",
        )

    # Future: def _load_fine_tuned_model(self): ...
    # Future: def classify_with_bert(self, entity_name: str, context: dict) -> EntityProfile: ...


entity_classifier = EntityClassifierService()
