"""
Unified regulatory disclaimer texts for reports, PDFs, and exports.
Use these constants everywhere so wording is consistent (Gap X1–X4).
"""

# Forward-looking statement
FORWARD_LOOKING = (
    "Estimates and projections are indicative and do not constitute a guarantee of future results."
)
FORWARD_LOOKING_RU = (
    "Оценки и прогнозы носят ориентировочный характер и не являются гарантией будущих результатов."
)

# Purpose / not for regulatory submission
INTERNAL_USE_ONLY = (
    "For internal risk management purposes. Not intended for regulatory submission without separate review."
)
INTERNAL_USE_ONLY_RU = (
    "Для целей внутреннего управления рисками. Не предназначено для подачи регулятору без отдельной проверки."
)

# Model limitations
MODEL_LIMITATIONS_TEMPLATE = (
    "Results are based on model assumptions and data as of the calculation date. "
    "Methodology: {methodology}. Model validation is conducted periodically."
)
MODEL_LIMITATIONS_RU_TEMPLATE = (
    "Результаты основаны на модельных допущениях и данных на дату расчёта. "
    "Методология: {methodology}. Валидация моделей проводится периодически."
)

# Data cut-off
DATA_CUTOFF_TEMPLATE = "Data as of: {report_date}."
DATA_CUTOFF_RU_TEMPLATE = "Данные на дату: {report_date}."


def get_full_disclaimer(
    report_date: str = "",
    methodology: str = "Universal Stress Testing Methodology v2.0",
    lang: str = "en",
) -> str:
    """Single block of text for PDF footer or UI: forward-looking + internal use + model + date."""
    if lang == "ru":
        parts = [
            FORWARD_LOOKING_RU,
            INTERNAL_USE_ONLY_RU,
            MODEL_LIMITATIONS_RU_TEMPLATE.format(methodology=methodology),
        ]
        if report_date:
            parts.append(DATA_CUTOFF_RU_TEMPLATE.format(report_date=report_date))
    else:
        parts = [
            FORWARD_LOOKING,
            INTERNAL_USE_ONLY,
            MODEL_LIMITATIONS_TEMPLATE.format(methodology=methodology),
        ]
        if report_date:
            parts.append(DATA_CUTOFF_TEMPLATE.format(report_date=report_date))
    return " ".join(parts)


def get_short_disclaimer() -> str:
    """One line for UI banners: forward-looking + internal use."""
    return f"{FORWARD_LOOKING} {INTERNAL_USE_ONLY}"
