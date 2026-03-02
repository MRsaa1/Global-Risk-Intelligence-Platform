"""
EM-DAT CSV adapter for external risk ETL.

EM-DAT (CRED) public table: https://public.emdat.be
Export as CSV; columns vary (Dis No, Year, Disaster Type, Country, ISO, Start Year/Month/Day,
Total Deaths, Total Affected, Total Damages ('000 US$), Insured Damages, Latitude, Longitude, etc.).

Maps to: raw_source_records → normalized_events → event_entities + event_losses + event_impacts + event_recovery.
Technical Spec: docs/EXTERNAL_DATABASES_TECHNICAL_SPEC_V1.md
"""
import csv
import io
import logging
from datetime import date
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Map EM-DAT disaster type/subgroup to canonical event_type
EMDAT_TYPE_TO_CANONICAL: Dict[str, str] = {
    "flood": "flood",
    "flash flood": "flood",
    "storm": "climate",
    "tropical cyclone": "climate",
    "hurricane": "climate",
    "earthquake": "seismic",
    "tsunami": "seismic",
    "drought": "drought",
    "wildfire": "fire",
    "landslide": "seismic",
    "volcanic activity": "seismic",
    "extreme temperature": "climate",
    "epidemic": "pandemic",
}


def _norm_key(h: str) -> str:
    return h.strip().lower().replace(" ", "_").replace(".", "").replace("(", "").replace(")", "").replace("'", "")


def _parse_date(row: Dict[str, str], prefix: str) -> Optional[date]:
    year = row.get(f"{prefix}year") or row.get(f"{prefix}_year") or row.get("year")
    month = row.get(f"{prefix}month") or row.get(f"{prefix}_month") or row.get("month", "1")
    day = row.get(f"{prefix}day") or row.get(f"{prefix}_day") or row.get("day", "1")
    try:
        y = int(year) if year else None
        m = int(month) if month else 1
        d = int(day) if day else 1
        if y is None:
            return None
        return date(y, min(12, max(1, m)), min(31, max(1, d)))
    except (TypeError, ValueError):
        return None


def _decimal(s: Optional[str]) -> Optional[Decimal]:
    if s is None or s == "":
        return None
    try:
        s = str(s).replace(",", "").strip()
        return Decimal(s) if s else None
    except Exception:
        return None


def _float(s: Optional[str]) -> Optional[float]:
    if s is None or s == "":
        return None
    try:
        return float(str(s).replace(",", "").strip())
    except Exception:
        return None


def parse_emdat_csv(csv_content: str) -> List[Dict[str, Any]]:
    """
    Parse EM-DAT CSV content into list of payloads (for raw_source_records.payload).
    """
    rows: List[Dict[str, Any]] = []
    try:
        reader = csv.DictReader(io.StringIO(csv_content), dialect="excel")
        raw_headers = reader.fieldnames or []
        key_map = {_norm_key(h): h for h in raw_headers}
    except Exception as e:
        logger.warning("EM-DAT CSV parse failed: %s", e)
        return rows

    for row in reader:
        norm_row = {_norm_key(k): v for k, v in row.items() if k and v is not None and str(v).strip()}
        dis_no = norm_row.get("disno") or norm_row.get("dis_no") or norm_row.get("no")
        if not dis_no:
            continue
        source_record_id = str(dis_no).strip()
        start_date = _parse_date(norm_row, "start") or _parse_date(norm_row, "start_")
        end_date = _parse_date(norm_row, "end") or _parse_date(norm_row, "end_")
        country_iso3 = (norm_row.get("iso") or norm_row.get("country_code") or "").strip()[:3]
        country_name = (norm_row.get("country") or "").strip()
        disaster_type = (norm_row.get("disaster_type") or norm_row.get("type") or "").strip().lower()
        subtype = (norm_row.get("subtype") or "").strip().lower()
        lat = _float(norm_row.get("latitude") or norm_row.get("lat"))
        lon = _float(norm_row.get("longitude") or norm_row.get("lon") or norm_row.get("lng"))
        location = (norm_row.get("location") or "").strip() or None
        total_deaths = _decimal(norm_row.get("total_deaths") or norm_row.get("deaths"))
        affected = _decimal(norm_row.get("total_affected") or norm_row.get("affected"))
        homeless = _decimal(norm_row.get("homeless"))
        total_damages = _decimal(norm_row.get("total_damages_000_us") or norm_row.get("total_damages") or norm_row.get("damages"))
        insured_damages = _decimal(norm_row.get("insured_damages_000_us") or norm_row.get("insured_damages"))

        canonical_type = "climate"
        for k, v in EMDAT_TYPE_TO_CANONICAL.items():
            if k in disaster_type or k in subtype:
                canonical_type = v
                break

        payload: Dict[str, Any] = {
            "source_record_id": source_record_id,
            "disaster_type": disaster_type,
            "subtype": subtype,
            "canonical_event_type": canonical_type,
            "country_iso3": country_iso3,
            "country_name": country_name,
            "location": location,
            "start_date": start_date.isoformat() if start_date else None,
            "end_date": end_date.isoformat() if end_date else None,
            "lat": lat,
            "lon": lon,
            "total_deaths": float(total_deaths) if total_deaths else None,
            "total_affected": float(affected) if affected else None,
            "homeless": float(homeless) if homeless else None,
            "total_damages_000_usd": float(total_damages) if total_damages else None,
            "insured_damages_000_usd": float(insured_damages) if insured_damages else None,
        }
        title = f"{disaster_type or 'Disaster'} - {country_name or country_iso3 or 'Unknown'}"
        if start_date:
            title += f" ({start_date.year})"
        payload["title"] = title
        rows.append(payload)
    return rows


def normalized_event_from_emdat_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Map one EM-DAT payload to normalized_events fields."""
    start_date = None
    if payload.get("start_date"):
        try:
            start_date = date.fromisoformat(payload["start_date"])
        except Exception:
            pass
    end_date = None
    if payload.get("end_date"):
        try:
            end_date = date.fromisoformat(payload["end_date"])
        except Exception:
            pass
    fatalities = payload.get("total_deaths")
    affected = payload.get("total_affected") or payload.get("homeless")
    return {
        "event_type": payload.get("canonical_event_type") or "climate",
        "event_subtype": payload.get("subtype") or payload.get("disaster_type"),
        "title": payload.get("title"),
        "start_date": start_date,
        "end_date": end_date,
        "country_iso2": _iso3_to_iso2(payload.get("country_iso3")),
        "region": payload.get("country_name"),
        "city": payload.get("location"),
        "lat": payload.get("lat"),
        "lon": payload.get("lon"),
        "geo_precision": "point" if payload.get("lat") and payload.get("lon") else "country",
        "fatalities": Decimal(str(fatalities)) if fatalities is not None else None,
        "affected": Decimal(str(affected)) if affected is not None else None,
        "confidence": Decimal("0.75"),
    }


def event_losses_impacts_recovery_from_emdat_payload(
    payload: Dict[str, Any],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    """From one EM-DAT payload produce event_losses, event_impacts, event_recovery dicts."""
    losses: List[Dict[str, Any]] = []
    total_000 = payload.get("total_damages_000_usd")
    if total_000 is not None and total_000 > 0:
        amount_usd = float(total_000) * 1000
        losses.append({
            "loss_type": "economic",
            "amount_original": Decimal(str(amount_usd)),
            "currency_original": "USD",
            "amount_usd_nominal": Decimal(str(amount_usd)),
            "amount_usd_real": Decimal(str(amount_usd)),
            "base_year": 2025,
            "source_name": "emdat",
            "confidence": Decimal("0.75"),
        })
    insured_000 = payload.get("insured_damages_000_usd")
    if insured_000 is not None and insured_000 > 0:
        amount_usd = float(insured_000) * 1000
        losses.append({
            "loss_type": "insured",
            "amount_original": Decimal(str(amount_usd)),
            "currency_original": "USD",
            "amount_usd_nominal": Decimal(str(amount_usd)),
            "amount_usd_real": Decimal(str(amount_usd)),
            "base_year": 2025,
            "source_name": "emdat",
            "confidence": Decimal("0.7"),
        })

    impacts: List[Dict[str, Any]] = []
    if payload.get("total_deaths") is not None or payload.get("total_affected") is not None or payload.get("homeless") is not None:
        impacts.append({
            "casualties": Decimal(str(payload["total_deaths"])) if payload.get("total_deaths") else None,
            "displaced": Decimal(str(payload["homeless"])) if payload.get("homeless") else None,
            "sector": None,
            "source_name": "emdat",
            "confidence": Decimal("0.75"),
        })

    recoveries: List[Dict[str, Any]] = []
    if payload.get("start_date") and payload.get("end_date"):
        try:
            s = date.fromisoformat(payload["start_date"])
            e = date.fromisoformat(payload["end_date"])
            duration_days = (e - s).days
            if duration_days > 0:
                recoveries.append({
                    "duration_days": Decimal(str(duration_days)),
                    "recovery_time_months": Decimal(str(round(duration_days / 30, 1))),
                    "rto_days": None,
                    "rpo_hours": None,
                    "source_name": "emdat",
                    "confidence": Decimal("0.6"),
                })
        except Exception:
            pass

    return losses, impacts, recoveries


def _iso3_to_iso2(iso3: Optional[str]) -> Optional[str]:
    if not iso3 or len(iso3) != 3:
        return iso3[:2] if iso3 and len(iso3) >= 2 else None
    m = {
        "usa": "US", "gbr": "GB", "deu": "DE", "fra": "FR", "ita": "IT", "esp": "ES", "jpn": "JP",
        "chn": "CN", "ind": "IN", "bra": "BR", "can": "CA", "aus": "AU", "mex": "MX", "idn": "ID",
        "tur": "TR", "kor": "KR", "nld": "NL", "che": "CH", "tha": "TH", "pak": "PK", "phl": "PH",
        "bgd": "BD", "egy": "EG", "nga": "NG", "vnm": "VN", "zaf": "ZA", "irn": "IR", "arg": "AR",
        "col": "CO", "pol": "PL", "rus": "RU", "ukr": "UA", "bel": "BY", "kaz": "KZ", "uzb": "UZ",
    }
    return m.get(iso3.lower(), iso3[:2].upper())
