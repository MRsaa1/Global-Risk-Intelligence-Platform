"""
Explainable AI - SHAP, model cards, and interpretability.

Provides explainability tools for risk models including
SHAP values, feature importance, and model documentation.
"""

from libs.xai.shap_explainer import SHAPExplainer
from libs.xai.model_card import ModelCard, generate_model_card
from libs.xai.feature_importance import FeatureImportanceAnalyzer

__all__ = [
    "SHAPExplainer",
    "ModelCard",
    "generate_model_card",
    "FeatureImportanceAnalyzer",
]

__version__ = "1.0.0"

