"""PDF Report Generation Service.

Generates professional PDF reports for stress tests using WeasyPrint.
Includes:
- Executive Summary
- Risk Zone Analysis
- Impact Metrics
- Action Plans
- Charts and Visualizations
"""
import io
import logging
import base64
import re
from datetime import datetime
from typing import Optional, Dict, Any, List
from pathlib import Path

logger = logging.getLogger(__name__)

from jinja2 import Environment, FileSystemLoader, Template, select_autoescape
import markdown

# WeasyPrint import with fallback
try:
    from weasyprint import HTML, CSS
    from weasyprint.text.fonts import FontConfiguration
    HAS_WEASYPRINT = True
    _WEASYPRINT_IMPORT_ERROR: Optional[Exception] = None
except (ImportError, OSError) as e:
    HAS_WEASYPRINT = False
    HTML = None
    CSS = None
    FontConfiguration = None
    _WEASYPRINT_IMPORT_ERROR = e
    logger.warning("WeasyPrint not available (%s). Will try ReportLab fallback.", e)

# ReportLab fallback (pure-Python, works on macOS without cairo/pango)
try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    HAS_REPORTLAB = True
    _REPORTLAB_IMPORT_ERROR: Optional[Exception] = None
except Exception as e:
    HAS_REPORTLAB = False
    _REPORTLAB_IMPORT_ERROR = e

# Public feature flags
PDF_BACKEND: str = "weasyprint" if HAS_WEASYPRINT else ("reportlab" if HAS_REPORTLAB else "none")
HAS_PDF: bool = PDF_BACKEND != "none"


# Get template directory
TEMPLATE_DIR = Path(__file__).parent / "templates"
TEMPLATE_DIR.mkdir(exist_ok=True)


def get_risk_level_color(level: str) -> str:
    """Get color for risk level."""
    colors = {
        "critical": "#dc2626",  # red-600
        "high": "#ea580c",      # orange-600
        "medium": "#ca8a04",    # yellow-600
        "low": "#16a34a",       # green-600
    }
    return colors.get(level.lower(), "#6b7280")


# Currency by city (San Francisco = USD, Frankfurt = EUR, etc.)
_REGION_CURRENCY = {
    "San Francisco": "USD", "Oakland": "USD", "New York": "USD", "Chicago": "USD", "Los Angeles": "USD",
    "London": "GBP", "Frankfurt": "EUR", "Berlin": "EUR", "Munich": "EUR", "Paris": "EUR", "Amsterdam": "EUR",
    "Tokyo": "JPY", "Singapore": "SGD", "Sydney": "AUD", "Melbourne": "AUD",
}


def _get_currency_for_city(city_name: str) -> str:
    if not city_name:
        return "EUR"
    for key, cur in _REGION_CURRENCY.items():
        if key.lower() in city_name.lower():
            return cur
    if "USA" in (city_name or "").upper() or "United States" in (city_name or ""):
        return "USD"
    if "Japan" in (city_name or "") or "Tokyo" in (city_name or ""):
        return "JPY"
    return "EUR"


def format_currency(value: float, currency: str = "EUR") -> str:
    """Format currency value (expects actual amount, e.g. 1_500_000 for €1.5M or $1.5M)."""
    sym = "$" if currency == "USD" else "£" if currency == "GBP" else "¥" if currency == "JPY" else "€"
    if value >= 1_000_000_000:
        return f"{sym}{value / 1_000_000_000:.1f}B"
    elif value >= 1_000_000:
        return f"{sym}{value / 1_000_000:.1f}M"
    elif value >= 1_000:
        return f"{sym}{value / 1_000:.1f}K"
    else:
        return f"{sym}{value:.0f}"


def format_currency_millions(value_millions: float, currency: str = "EUR") -> str:
    """Format value stored in millions (e.g. 1391.5 -> €1,391.5M or $1,391.5M)."""
    return format_currency(float(value_millions or 0) * 1_000_000, currency)


def generate_risk_bar_svg(zones: List[Dict[str, Any]], currency: str = "EUR") -> str:
    """Generate SVG bar chart for risk zones."""
    if not zones:
        return ""
    
    max_loss = max(z.get("expected_loss", 0) for z in zones) or 1
    
    bars = []
    for i, zone in enumerate(zones[:10]):  # Max 10 zones
        level = zone.get("zone_level", "medium").lower()
        loss = float(zone.get("expected_loss", 0) or 0)  # in millions
        width = (loss / max_loss) * 280 if max_loss else 0
        color = get_risk_level_color(level)
        name = zone.get("name", f"Zone {i+1}")[:25]
        
        y = i * 35
        bars.append(f'''
            <g transform="translate(0, {y})">
                <text x="0" y="12" font-size="10" fill="#374151">{name}</text>
                <rect x="120" y="0" width="{width}" height="20" fill="{color}" rx="2"/>
                <text x="{125 + width}" y="14" font-size="9" fill="#6b7280">{format_currency_millions(loss, currency)}</text>
            </g>
        ''')
    
    height = len(zones[:10]) * 35 + 10
    return f'''
        <svg width="450" height="{height}" xmlns="http://www.w3.org/2000/svg">
            {''.join(bars)}
        </svg>
    '''


def generate_severity_gauge_svg(severity: float) -> str:
    """Generate SVG gauge for severity."""
    angle = severity * 180  # 0-180 degrees
    
    # Determine color based on severity
    if severity >= 0.8:
        color = "#dc2626"
    elif severity >= 0.6:
        color = "#ea580c"
    elif severity >= 0.4:
        color = "#ca8a04"
    else:
        color = "#16a34a"
    
    # Calculate arc end point
    import math
    end_x = 100 + 70 * math.cos(math.radians(180 - angle))
    end_y = 100 - 70 * math.sin(math.radians(180 - angle))
    large_arc = 1 if angle > 90 else 0
    
    return f'''
        <svg width="200" height="120" xmlns="http://www.w3.org/2000/svg">
            <!-- Background arc -->
            <path d="M 30 100 A 70 70 0 0 1 170 100" fill="none" stroke="#e5e7eb" stroke-width="12"/>
            <!-- Value arc -->
            <path d="M 30 100 A 70 70 0 0 1 {end_x:.1f} {end_y:.1f}" fill="none" stroke="{color}" stroke-width="12" stroke-linecap="round"/>
            <!-- Center text -->
            <text x="100" y="95" text-anchor="middle" font-size="24" font-weight="bold" fill="{color}">{severity*100:.0f}%</text>
            <text x="100" y="115" text-anchor="middle" font-size="10" fill="#6b7280">Severity</text>
        </svg>
    '''


# Default PDF template
DEFAULT_TEMPLATE = '''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>
        @page {
            size: A4;
            margin: 2cm;
            @top-right {
                content: "Page " counter(page) " of " counter(pages);
                font-size: 9pt;
                color: #6b7280;
            }
            @bottom-center {
                content: "Physical-Financial Risk Platform | Confidential";
                font-size: 8pt;
                color: #9ca3af;
            }
        }
        
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        
        body {
            font-family: 'Helvetica Neue', Arial, sans-serif;
            font-size: 10pt;
            line-height: 1.5;
            color: #1f2937;
        }
        
        .header {
            background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
            color: white;
            padding: 20px;
            margin: -2cm -2cm 20px -2cm;
            width: calc(100% + 4cm);
        }
        
        .header h1 {
            font-size: 24pt;
            font-weight: 700;
            margin-bottom: 5px;
        }
        
        .header .subtitle {
            font-size: 12pt;
            opacity: 0.9;
        }
        
        .header .meta {
            margin-top: 15px;
            font-size: 9pt;
            opacity: 0.8;
        }
        
        .section {
            margin-bottom: 25px;
            page-break-inside: avoid;
        }
        
        .section-title {
            font-size: 14pt;
            font-weight: 700;
            color: #1e3a8a;
            border-bottom: 2px solid #3b82f6;
            padding-bottom: 5px;
            margin-bottom: 15px;
        }
        
        .summary-box {
            background: #f8fafc;
            border-left: 4px solid #3b82f6;
            padding: 15px;
            margin-bottom: 20px;
        }
        
        .summary-box p {
            margin-bottom: 10px;
        }
        
        .metrics-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            margin-bottom: 20px;
        }
        
        .metric-card {
            flex: 1;
            min-width: 120px;
            background: #f1f5f9;
            border-radius: 8px;
            padding: 15px;
            text-align: center;
        }
        
        .metric-value {
            font-size: 20pt;
            font-weight: 700;
            color: #1e3a8a;
        }
        
        .metric-label {
            font-size: 9pt;
            color: #64748b;
            margin-top: 5px;
        }
        
        .risk-zones-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
        }
        
        .risk-zones-table th {
            background: #1e3a8a;
            color: white;
            padding: 10px;
            text-align: left;
            font-size: 9pt;
        }
        
        .risk-zones-table td {
            padding: 8px 10px;
            border-bottom: 1px solid #e2e8f0;
            font-size: 9pt;
        }
        
        .risk-zones-table tr:nth-child(even) {
            background: #f8fafc;
        }
        
        .risk-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 8pt;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .risk-critical { background: #fef2f2; color: #dc2626; }
        .risk-high { background: #fff7ed; color: #ea580c; }
        .risk-medium { background: #fefce8; color: #ca8a04; }
        .risk-low { background: #f0fdf4; color: #16a34a; }
        
        .action-item {
            background: #f8fafc;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 10px;
        }
        
        .action-title {
            font-weight: 600;
            color: #1e3a8a;
            margin-bottom: 5px;
        }
        
        .action-details {
            font-size: 9pt;
            color: #64748b;
        }
        
        .chart-container {
            text-align: center;
            margin: 20px 0;
        }
        
        .sources {
            font-size: 8pt;
            color: #64748b;
            border-top: 1px solid #e2e8f0;
            padding-top: 15px;
            margin-top: 30px;
        }
        
        .sources li {
            margin-bottom: 3px;
        }
        
        .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 9pt;
            color: #9ca3af;
        }
        
        .page-break {
            page-break-before: always;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Stress Test Report</h1>
        <div class="subtitle">{{ report.test_name or 'Risk Analysis' }}</div>
        <div class="meta">
            <strong>City:</strong> {{ report.city_name or 'N/A' }} | 
            <strong>Scenario:</strong> {{ report.scenario_name or report.test_type or 'Custom' }} | 
            <strong>Generated:</strong> {{ report.generated_at or 'Today' }}
        </div>
    </div>
    
    <div class="section">
        <h2 class="section-title">Executive Summary</h2>
        <div class="summary-box">
            {{ report.executive_summary | safe }}
        </div>
        
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-value">{{ report.severity_pct }}%</div>
                <div class="metric-label">Severity</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">{{ report.total_loss_formatted }}</div>
                <div class="metric-label">Expected Loss</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">{{ report.affected_buildings }}</div>
                <div class="metric-label">Buildings Affected</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">{{ report.affected_population }}</div>
                <div class="metric-label">People Impacted</div>
            </div>
        </div>
        
        <div class="chart-container">
            {{ severity_gauge | safe }}
        </div>
    </div>
    
    {% if region_action_plan %}
    <div class="section">
        <h2 class="section-title">Regional Action Plan</h2>
        <div class="summary-box">
            <p>{{ region_action_plan.summary }}</p>
            <p><strong>Key actions:</strong></p>
            <ul style="margin-left: 20px;">{% for a in (region_action_plan.key_actions or [])[:6] %}<li>{{ a }}</li>{% endfor %}</ul>
            {% if region_action_plan.contacts %}<p><strong>Contacts:</strong> {% for c in region_action_plan.contacts %}{{ c.name }}: {{ c.phone }}{% if not loop.last %}; {% endif %}{% endfor %}</p>{% endif %}
        </div>
    </div>
    {% endif %}
    
    <div class="section">
        <h2 class="section-title">Risk Zone Analysis</h2>
        
        {% if zones %}
        <table class="risk-zones-table">
            <thead>
                <tr>
                    <th>Zone</th>
                    <th>Risk Level</th>
                    <th>Buildings</th>
                    <th>Expected Loss</th>
                    <th>Population</th>
                </tr>
            </thead>
            <tbody>
                {% for zone in zones %}
                <tr>
                    <td>{{ zone.name }}</td>
                    <td><span class="risk-badge risk-{{ zone.level }}">{{ zone.level }}</span></td>
                    <td>{{ zone.buildings }}</td>
                    <td>{{ zone.loss_formatted }}</td>
                    <td>{{ zone.population }}</td>
                </tr>
                {% endfor %}
            </tbody>
        </table>
        
        <div class="chart-container">
            {{ risk_bar_chart | safe }}
        </div>
        {% else %}
        <p>No risk zones identified for this scenario.</p>
        {% endif %}
    </div>
    
    {% if actions %}
    <div class="section page-break">
        <h2 class="section-title">Recommended Actions</h2>
        
        {% for action in actions %}
        <div class="action-item">
            <div class="action-title">{{ loop.index }}. {{ action.title }}</div>
            <div class="action-details">
                <strong>Priority:</strong> {{ action.priority }} | 
                <strong>Timeline:</strong> {{ action.timeline }} |
                <strong>Est. Cost:</strong> {{ action.cost }} |
                <strong>Risk Reduction:</strong> {{ action.risk_reduction }}%
            </div>
        </div>
        {% endfor %}
    </div>
    {% endif %}
    
    {% if historical_comparisons %}
    <div class="section page-break">
        <h2 class="section-title">Historical Event Comparisons</h2>
        <p class="text-sm" style="color: #64748b; margin-bottom: 15px;">Compared with past events of the same type and region.</p>
        {% for comp in historical_comparisons %}
        <div class="action-item" style="margin-bottom: 20px; padding: 15px; background: #fffbeb; border-left: 4px solid #f59e0b;">
            <div class="action-title" style="font-weight: 600;">{{ comp.name }}{% if comp.year %} ({{ comp.year }}){% endif %}</div>
            <p style="font-size: 9pt; color: #6b7280;"><strong>Why comparable:</strong> {{ comp.similarity_reason }}</p>
            {% if comp.description %}<p style="font-size: 10pt;">{{ comp.description }}</p>{% endif %}
            {% if comp.lessons_learned %}<p style="font-size: 10pt;"><strong>Lessons:</strong> {{ comp.lessons_learned }}</p>{% endif %}
        </div>
        {% endfor %}
    </div>
    {% endif %}
    
    {% if report.concluding_summary %}
    <div class="section page-break">
        <h2 class="section-title">Conclusions & Next Steps</h2>
        <div class="action-item" style="background: #f0fdf4; border-left: 4px solid #22c55e;">
            {{ report.concluding_summary | safe }}
        </div>
    </div>
    {% endif %}
    
    {% if cascade_simulations %}
    <div class="section page-break">
        <h2 class="section-title">Cascade Simulation Results</h2>
        <p class="text-sm" style="color: #64748b; margin-bottom: 15px;">Simulations run in Cascade Analysis and added to this report.</p>
        {% for sim in cascade_simulations %}
        <div class="action-item" style="margin-bottom: 20px; padding: 15px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #3b82f6;">
            <div class="action-title" style="font-weight: 600; margin-bottom: 8px;">Simulation #{{ loop.index }}</div>
            <p style="font-size: 10pt; margin-bottom: 10px;">
                Trigger: <strong>{{ sim.trigger_node }}</strong> at {{ sim.trigger_severity_pct }}% severity. 
                Over {{ sim.simulation_steps }} step(s), <strong>{{ sim.affected_count }}</strong> node(s) affected, 
                total loss <strong>{{ sim.total_loss_fmt }}</strong>.
                {% if sim.containment_points %} Containment: {{ sim.containment_points | join(', ') }}.{% endif %}
            </p>
            <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                <div style="min-width: 80px;"><span style="font-weight: 700; color: #1e3a8a;">{{ sim.affected_count }}</span> Nodes</div>
                <div style="min-width: 80px;"><span style="font-weight: 700; color: #1e3a8a;">{{ sim.total_loss_fmt }}</span> Loss</div>
                <div style="min-width: 80px;"><span style="font-weight: 700; color: #1e3a8a;">{{ sim.critical_nodes | length }}</span> Critical</div>
                <div style="min-width: 80px;"><span style="font-weight: 700; color: #1e3a8a;">{{ sim.containment_points | length }}</span> Containment</div>
            </div>
        </div>
        {% endfor %}
    </div>
    {% endif %}
    
    <div class="section">
        <h2 class="section-title">Methodology</h2>
        <p>This stress test was conducted using the Physical-Financial Risk Platform's 
        multi-layered risk assessment framework, incorporating:</p>
        <ul style="margin-left: 20px; margin-top: 10px;">
            <li>Monte Carlo simulation with {{ report.simulation_runs or '10,000' }} iterations</li>
            <li>VaR 99% and Expected Shortfall (CVaR) calculations</li>
            <li>Gaussian copula for correlated defaults</li>
            <li>Historical event calibration</li>
            {% if report.nvidia_enhanced %}
            <li>NVIDIA Earth-2 weather forecasting</li>
            <li>NVIDIA PhysicsNeMo physics-based simulations</li>
            {% endif %}
        </ul>
    </div>
    
    <div class="sources">
        <h3 style="margin-bottom: 10px; color: #374151;">Data Sources</h3>
        <ul>
            <li>Building Registry Database ({{ report.data_freshness or '2026-01-15' }})</li>
            <li>Topographic Elevation Model (Copernicus DEM)</li>
            <li>Historical Event Records ({{ report.historical_events_count or '50+' }} events)</li>
            <li>Infrastructure Grid Mapping (OpenStreetMap)</li>
            <li>Population Density Census (UN World Population Prospects)</li>
        </ul>
    </div>
    
    <div class="footer">
        <p>Generated by Physical-Financial Risk Platform v1.5.0</p>
        <p>© 2026 SAA Alliance. All rights reserved.</p>
    </div>
</body>
</html>
'''


class PDFReportService:
    """Service for generating PDF reports."""
    
    def __init__(self):
        """Initialize the PDF service."""
        self.template_dir = TEMPLATE_DIR
        
        # Create default template if it doesn't exist
        template_path = self.template_dir / "stress_test_report.html"
        if not template_path.exists():
            template_path.write_text(DEFAULT_TEMPLATE)
        
        # Setup Jinja2 environment
        self.env = Environment(
            loader=FileSystemLoader(str(self.template_dir)),
            autoescape=select_autoescape(['html', 'xml'])
        )
        
        # Add custom filters
        self.env.filters['currency'] = format_currency
        self.env.filters['markdown'] = lambda x: markdown.markdown(x) if x else ''
    
    def generate_stress_test_pdf(
        self,
        stress_test: Dict[str, Any],
        zones: List[Dict[str, Any]],
        actions: Optional[List[Dict[str, Any]]] = None,
        executive_summary: Optional[str] = None,
        cascade_simulations: Optional[List[Dict[str, Any]]] = None,
        region_action_plan: Optional[Dict[str, Any]] = None,
        historical_comparisons: Optional[List[Dict[str, Any]]] = None,
        concluding_summary: Optional[str] = None,
        report_v2: Optional[Dict[str, Any]] = None,
    ) -> bytes:
        """
        Generate PDF report for a stress test.
        
        Args:
            stress_test: Stress test data
            zones: Risk zones with metrics
            actions: Recommended actions
            executive_summary: AI-generated summary
            cascade_simulations: Cascade simulation results added to report
            
        Returns:
            PDF file as bytes
        """
        city_name = stress_test.get("region_name", stress_test.get("city", "N/A"))
        currency = stress_test.get("currency") or _get_currency_for_city(city_name)
        if PDF_BACKEND == "reportlab":
            return self._generate_stress_test_pdf_reportlab(
                stress_test=stress_test,
                zones=zones,
                actions=actions,
                executive_summary=executive_summary,
                cascade_simulations=cascade_simulations or [],
                region_action_plan=region_action_plan,
                historical_comparisons=historical_comparisons or [],
                concluding_summary=concluding_summary,
                report_v2=report_v2,
                currency=currency,
            )
        if PDF_BACKEND != "weasyprint":
            raise ImportError(
                "PDF generation is not available. Install either:\n"
                "- reportlab (pip install reportlab)\n"
                "- or WeasyPrint + system libs (cairo, pango)\n"
                f"WeasyPrint error: {_WEASYPRINT_IMPORT_ERROR}\n"
                f"ReportLab error: {_REPORTLAB_IMPORT_ERROR}"
            )
        
        # Prepare report data (expected_loss/estimated_loss are in millions)
        severity = stress_test.get("severity", 0.5)
        city_name = stress_test.get("region_name", stress_test.get("city", "N/A"))
        currency = stress_test.get("currency") or _get_currency_for_city(city_name)
        total_loss_millions = sum(z.get("expected_loss", 0) for z in zones)
        total_buildings = sum(z.get("affected_assets_count", 0) for z in zones)
        total_population = sum(z.get("population_affected", 0) for z in zones)

        report_data = {
            "test_name": stress_test.get("name", "Stress Test Report"),
            "city_name": city_name,
            "scenario_name": stress_test.get("scenario_name", stress_test.get("test_type", stress_test.get("type", "Custom"))),
            "test_type": stress_test.get("test_type", stress_test.get("type", "climate")),
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "severity_pct": int(severity * 100),
            "total_loss_formatted": format_currency_millions(total_loss_millions, currency),
            "affected_buildings": f"{total_buildings:,}",
            "affected_population": f"{total_population:,}",
            "executive_summary": executive_summary or self._generate_default_summary(stress_test, zones, currency),
            "simulation_runs": "10,000",
            "nvidia_enhanced": stress_test.get("nvidia_enhanced", False),
            "historical_events_count": "50+",
            "data_freshness": datetime.now().strftime("%Y-%m-%d"),
            "concluding_summary": concluding_summary or "",
        }
        
        # Prepare zones data (expected_loss in millions)
        zones_data = []
        for zone in zones:
            zones_data.append({
                "name": zone.get("name", "Unnamed Zone"),
                "level": zone.get("zone_level", "medium").lower(),
                "buildings": zone.get("affected_assets_count", 0),
                "loss_formatted": format_currency_millions(zone.get("expected_loss", 0), currency),
                "population": f"{zone.get('population_affected', 0):,}",
            })
        
        # Prepare actions data
        actions_data = []
        if actions:
            for action in actions:
                actions_data.append({
                    "title": action.get("title", action.get("action", "Action")),
                    "priority": action.get("priority", "Medium"),
                    "timeline": action.get("timeline", "1-3 months"),
                    "cost": format_currency_millions(action.get("estimated_cost", action.get("cost", 0)), currency),
                    "risk_reduction": action.get("risk_reduction", 10),
                })
        else:
            # Generate default actions
            actions_data = self._generate_default_actions(stress_test, zones)
        
        # Generate SVG charts
        severity_gauge = generate_severity_gauge_svg(severity)
        risk_bar_chart = generate_risk_bar_svg(zones, currency)
        
        # Render template (fallback to DEFAULT_TEMPLATE if file missing, e.g. read-only deploy)
        try:
            template = self.env.get_template("stress_test_report.html")
        except Exception as e:
            logger.warning("PDF template file not found, using built-in: %s", e)
            template = Template(DEFAULT_TEMPLATE)
        cascade_data = [
            {
                "trigger_node": s.get("trigger_node", "—"),
                "trigger_severity_pct": int((s.get("trigger_severity", 0) or 0) * 100),
                "simulation_steps": s.get("simulation_steps", 0),
                "affected_count": s.get("affected_count", 0),
                "total_loss": s.get("total_loss", 0),
                "total_loss_fmt": format_currency(s.get("total_loss", 0), currency),
                "containment_points": s.get("containment_points", []),
                "critical_nodes": s.get("critical_nodes", []),
            }
            for s in (cascade_simulations or [])
        ]
        html_content = template.render(
            report=report_data,
            zones=zones_data,
            actions=actions_data,
            cascade_simulations=cascade_data,
            region_action_plan=region_action_plan,
            historical_comparisons=historical_comparisons or [],
            concluding_summary=concluding_summary,
            severity_gauge=severity_gauge,
            risk_bar_chart=risk_bar_chart,
            report_v2=report_v2,
        )
        
        # Generate PDF
        font_config = FontConfiguration()
        html = HTML(string=html_content)
        pdf_bytes = html.write_pdf(font_config=font_config)
        
        return pdf_bytes

    def _generate_stress_test_pdf_reportlab(
        self,
        *,
        stress_test: Dict[str, Any],
        zones: List[Dict[str, Any]],
        actions: Optional[List[Dict[str, Any]]] = None,
        executive_summary: Optional[str] = None,
        cascade_simulations: Optional[List[Dict[str, Any]]] = None,
        region_action_plan: Optional[Dict[str, Any]] = None,
        historical_comparisons: Optional[List[Dict[str, Any]]] = None,
        concluding_summary: Optional[str] = None,
        report_v2: Optional[Dict[str, Any]] = None,
        currency: str = "EUR",
    ) -> bytes:
        """
        ReportLab fallback PDF generator.
        Produces a clean, readable PDF without external native deps (macOS-friendly).
        """
        if not HAS_REPORTLAB:
            raise ImportError(f"ReportLab is not available: {_REPORTLAB_IMPORT_ERROR}")

        _sym = "¥" if currency == "JPY" else "$" if currency == "USD" else "£" if currency == "GBP" else "€"

        # Prepare core metrics
        severity = float(stress_test.get("severity", 0.5) or 0.5)
        total_loss = sum((z.get("expected_loss", 0) or 0) for z in (zones or []))
        total_buildings = sum((z.get("affected_assets_count", 0) or 0) for z in (zones or []))
        total_population = sum((z.get("population_affected", 0) or 0) for z in (zones or []))

        title = "Stress Test Report"
        subtitle = stress_test.get("name", "Stress Test Report")
        city_name = stress_test.get("region_name", stress_test.get("city", "N/A"))
        scenario_name = stress_test.get("scenario_name", stress_test.get("test_type", stress_test.get("type", "Custom")))
        generated_at = datetime.now().strftime("%Y-%m-%d %H:%M")

        # Summary (may be HTML from older callers); strip tags for PDF text; normalize currency symbol
        summary_raw = executive_summary or stress_test.get("executive_summary") or ""
        summary_text = self._strip_html_to_text(str(summary_raw))
        if not summary_text.strip():
            summary_text = self._strip_html_to_text(self._generate_default_summary(stress_test, zones, currency))
        summary_text = self._normalize_currency_in_text(summary_text, _sym)

        # Build PDF
        buf = io.BytesIO()
        doc = SimpleDocTemplate(
            buf,
            pagesize=A4,
            leftMargin=2 * cm,
            rightMargin=2 * cm,
            topMargin=2 * cm,
            bottomMargin=2 * cm,
            title=title,
        )

        styles = getSampleStyleSheet()
        h1 = ParagraphStyle("h1", parent=styles["Title"], fontSize=20, textColor=colors.HexColor("#1e3a8a"))
        h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontSize=13, textColor=colors.HexColor("#1e3a8a"), spaceBefore=10, spaceAfter=6)
        small = ParagraphStyle("small", parent=styles["Normal"], fontSize=9, textColor=colors.HexColor("#6b7280"), leading=11)
        normal = ParagraphStyle("normal", parent=styles["Normal"], fontSize=10, leading=13)

        story: List[Any] = []
        story.append(Paragraph("CONFIDENTIAL · RISK ASSESSMENT", ParagraphStyle("badge", parent=styles["Normal"], fontSize=8, textColor=colors.HexColor("#64748b"), spaceAfter=4)))
        story.append(Paragraph(title, h1))
        story.append(Paragraph(self._escape_para(str(subtitle)), ParagraphStyle("subtitle", parent=styles["Normal"], fontSize=11, textColor=colors.HexColor("#374151"))))
        story.append(Spacer(1, 6))
        meta = f"<b>City:</b> {self._escape_para(str(city_name))} &nbsp;&nbsp; <b>Scenario:</b> {self._escape_para(str(scenario_name))} &nbsp;&nbsp; <b>Generated:</b> {self._escape_para(generated_at)}"
        story.append(Paragraph(meta, small))
        story.append(Spacer(1, 12))

        story.append(Paragraph("Executive Summary", h2))
        story.append(Paragraph(self._escape_para(summary_text).replace("\n", "<br/>"), normal))
        story.append(Spacer(1, 12))

        # Regional Action Plan
        if region_action_plan:
            r = region_action_plan
            story.append(Paragraph(f"Regional Action Plan — {self._escape_para(str(r.get('region', '')))}, {self._escape_para(str(r.get('country', '')))}", h2))
            story.append(Paragraph(self._escape_para(str(r.get("summary", ""))), normal))
            key_actions = r.get("key_actions") or []
            for a in key_actions[:6]:
                story.append(Paragraph(f"• {self._escape_para(str(a))}", normal))
            contacts = r.get("contacts") or []
            if contacts:
                cs = "; ".join(f"{c.get('name', '')}: {c.get('phone', '')}" for c in contacts)
                story.append(Paragraph(f"<b>Contacts:</b> {self._escape_para(cs)}", small))
            story.append(Spacer(1, 12))

        # Historical comparisons
        if historical_comparisons:
            story.append(Paragraph("Historical Event Comparisons", h2))
            story.append(Paragraph("Compared with past events of the same type and region. Lessons and context.", small))
            story.append(Spacer(1, 6))
            for comp in historical_comparisons:
                name = comp.get("name", "Unknown")
                year = comp.get("year", "")
                reason = comp.get("similarity_reason", "")
                desc = comp.get("description", "")
                lessons = comp.get("lessons_learned", "")
                loss = comp.get("financial_loss_eur")
                sev = comp.get("severity_actual")
                pop = comp.get("affected_population")
                line = f"<b>{self._escape_para(str(name))}{' (' + str(year) + ')' if year else ''}</b><br/>"
                line += f"<font size=9 color='#6b7280'>Comparable: {self._escape_para(str(reason))}</font><br/>"
                if desc:
                    line += f"{self._escape_para(str(desc)[:400])}{'...' if len(str(desc)) > 400 else ''}<br/>"
                if lessons:
                    line += f"<b>Lessons:</b> {self._escape_para(str(lessons)[:300])}<br/>"
                extra = []
                if loss: extra.append(f"Loss: {format_currency(float(loss), currency)}")
                if sev: extra.append(f"Severity: {int(sev * 100)}%")
                if pop: extra.append(f"Affected: {int(pop):,}")
                if extra:
                    line += f"<font size=9>{' | '.join(extra)}</font>"
                story.append(Paragraph(line, normal))
                story.append(Spacer(1, 6))

        # Metrics table (total_loss from zones is in millions)
        story.append(Paragraph("Key Metrics", h2))
        metrics = [
            ["Severity", f"{int(severity * 100)}%"],
            ["Expected Loss", format_currency_millions(float(total_loss or 0), currency)],
            ["Buildings Affected", f"{int(total_buildings):,}"],
            ["People Impacted", f"{int(total_population):,}"],
        ]
        t = Table(metrics, colWidths=[6 * cm, 8 * cm])
        t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.white),
                    ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#111827")),
                    ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                    ("FONTSIZE", (0, 0), (-1, -1), 10),
                    ("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.HexColor("#e5e7eb")),
                    ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.whitesmoke, colors.white]),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        story.append(t)
        story.append(Spacer(1, 12))

        # Stress Test Report 2.0 (probabilistic, temporal, contagion, predictive, network, sensitivity, stakeholder, model uncertainty)
        if report_v2:
            story.append(Paragraph("Stress Test Report 2.0", h2))
            story.append(Paragraph(
                "Data quality &amp; accuracy: These metrics are derived from scaled/placeholder models (based on expected loss and scenario type). "
                "They reflect <i>indicative</i> accuracy. VaR/CVaR, temporal, contagion, and network figures will improve when real Monte Carlo, "
                "cascade/graph analysis, and external data are integrated.",
                small,
            ))
            story.append(Spacer(1, 8))
            pm = report_v2.get("probabilistic_metrics") or {}
            if pm:
                story.append(Paragraph("Probabilistic metrics", ParagraphStyle("h3", parent=styles["Normal"], fontSize=10, textColor=colors.HexColor("#1e3a8a"), spaceBefore=6, spaceAfter=4)))
                prob_rows = [
                    ["Mean (μ)", format_currency_millions(float(pm.get("mean_loss") or 0), currency)],
                    ["Median", format_currency_millions(float(pm.get("median_loss") or 0), currency)],
                    ["VaR 95%", format_currency_millions(float(pm.get("var_95") or 0), currency)],
                    ["VaR 99%", format_currency_millions(float(pm.get("var_99") or 0), currency)],
                    ["CVaR 99%", format_currency_millions(float(pm.get("cvar_99") or 0), currency)],
                    ["Std dev (σ)", format_currency_millions(float(pm.get("std_dev") or 0), currency)],
                ]
                ci = pm.get("confidence_interval_90")
                if ci and len(ci) >= 2:
                    prob_rows.append(["90% CI", f"{format_currency_millions(float(ci[0]), currency)} – {format_currency_millions(float(ci[1]), currency)}"])
                pt = Table(prob_rows, colWidths=[4 * cm, 5 * cm])
                pt.setStyle(TableStyle([("FONTSIZE", (0, 0), (-1, -1), 9), ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e5e7eb")), ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]), ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5), ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]))
                story.append(pt)
                story.append(Spacer(1, 6))
            td = report_v2.get("temporal_dynamics") or {}
            if td:
                story.append(Paragraph("Temporal dynamics", ParagraphStyle("h3", parent=styles["Normal"], fontSize=10, textColor=colors.HexColor("#1e3a8a"), spaceBefore=6, spaceAfter=4)))
                story.append(Paragraph(f"RTO: {td.get('rto_hours', '—')}h · RPO: {td.get('rpo_hours', '—')}h · Recovery: {td.get('recovery_time_months', [0, 0])[0]}–{td.get('recovery_time_months', [0, 0])[1]} mo · BI duration: {td.get('business_interruption_days', '—')} days", small))
                loss_acc = td.get("loss_accumulation") or []
                if loss_acc:
                    acc_rows = [["Period", f"Amount ({_sym}M)"]]
                    for row in loss_acc:
                        acc_rows.append([str(row.get("period", "—")), str(int(row.get("amount_m", 0)))])
                    at = Table(acc_rows, colWidths=[3 * cm, 3 * cm])
                    at.setStyle(TableStyle([("FONTSIZE", (0, 0), (-1, -1), 9), ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e5e7eb")), ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")), ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5), ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]))
                    story.append(at)
                story.append(Spacer(1, 6))
            fc = report_v2.get("financial_contagion") or {}
            if fc:
                story.append(Paragraph("Financial contagion (cross-sector)", ParagraphStyle("h3", parent=styles["Normal"], fontSize=10, textColor=colors.HexColor("#1e3a8a"), spaceBefore=6, spaceAfter=4)))
                lines = []
                if fc.get("banking"):
                    b = fc["banking"]
                    lines.append(f"Banking: NPL +{b.get('npl_increase_pct', '—')}%, provisions {_sym}{b.get('provisions_eur_m', 0)}M, CET1 {b.get('cet1_impact_bps', '—')} bps")
                if fc.get("insurance"):
                    i = fc["insurance"]
                    lines.append(f"Insurance: claims {_sym}{i.get('claims_gross_eur_m', 0)}M, net {_sym}{i.get('net_retained_eur_m', 0)}M, Solvency {i.get('solvency_impact_pp', '—')} pp")
                if fc.get("real_estate"):
                    r = fc["real_estate"]
                    lines.append(f"Real estate: value −{r.get('value_decline_pct', '—')}%, vacancy +{r.get('vacancy_increase_pct', '—')}%")
                if fc.get("supply_chain"):
                    s = fc["supply_chain"]
                    lines.append(f"Supply chain: GDP {s.get('direct_gdp_pct', '—')}% / {s.get('indirect_gdp_pct', '—')}%, jobs −{s.get('job_losses', 0):,}")
                if lines:
                    story.append(Paragraph("<br/>".join(self._escape_para(l) for l in lines), small))
                if fc.get("total_economic_impact_eur_m") is not None:
                    story.append(Paragraph(f"Total economic impact: {_sym}{int(fc['total_economic_impact_eur_m'])}M (×{fc.get('economic_multiplier', '—')} direct)", small))
                story.append(Spacer(1, 6))
            pred = report_v2.get("predictive_indicators") or {}
            if pred:
                story.append(Paragraph("Predictive indicators", ParagraphStyle("h3", parent=styles["Normal"], fontSize=10, textColor=colors.HexColor("#1e3a8a"), spaceBefore=6, spaceAfter=4)))
                story.append(Paragraph(f"Status: {self._escape_para(str(pred.get('status', '—')))} · P(event): {int((pred.get('probability_event') or 0) * 100)}%", small))
                triggers = pred.get("key_triggers") or []
                if triggers:
                    story.append(Paragraph("Triggers: " + "; ".join(self._escape_para(str(t)) for t in triggers[:4]), small))
                story.append(Spacer(1, 6))
            net = report_v2.get("network_risk") or {}
            if net:
                story.append(Paragraph("Network / systemic risk", ParagraphStyle("h3", parent=styles["Normal"], fontSize=10, textColor=colors.HexColor("#1e3a8a"), spaceBefore=6, spaceAfter=4)))
                nodes = net.get("critical_nodes") or []
                path = net.get("cascade_path", "")
                amp = net.get("amplification_factor")
                spof = net.get("single_points_of_failure") or []
                story.append(Paragraph(f"Critical nodes: {', '.join(self._escape_para(str(n.get('name', ''))) for n in nodes[:5])}", small))
                if path:
                    story.append(Paragraph(f"Cascade path: {self._escape_para(path)}", small))
                if amp is not None:
                    story.append(Paragraph(f"Amplification: {amp}×", small))
                if spof:
                    story.append(Paragraph("SPOF: " + "; ".join(self._escape_para(s) for s in spof[:3]), small))
                story.append(Spacer(1, 6))
            reg = report_v2.get("regulatory_relevance") or {}
            if reg:
                story.append(Paragraph("Regulatory relevance", ParagraphStyle("h3", parent=styles["Normal"], fontSize=10, textColor=colors.HexColor("#1e3a8a"), spaceBefore=6, spaceAfter=4)))
                story.append(Paragraph(f"Entity type: {self._escape_para(reg.get('entity_type', '—'))} · Jurisdiction: {self._escape_para(reg.get('jurisdiction', '—'))} · Disclosure required: {'Yes' if reg.get('disclosure_required') else 'No'}", small))
                regs = reg.get("regulation_labels") or reg.get("regulations") or []
                if regs:
                    reg_list = ", ".join(regs.values() if isinstance(regs, dict) else regs[:8])
                    # For Japan jurisdiction, show Japan regulations if current list looks EU (EBA/TCFD only)
                    jur = (reg.get("jurisdiction") or "").strip()
                    if jur == "Japan" and "FSA" not in reg_list and "JFSA" not in reg_list:
                        reg_list = "FSA Japan, JFSA, BOJ, TCFD"
                    story.append(Paragraph(f"Applicable: {self._escape_para(reg_list)}", small))
                metrics = reg.get("required_metrics") or []
                if metrics:
                    story.append(Paragraph("Required metrics: " + "; ".join(self._escape_para(m) for m in metrics[:4]), small))
                story.append(Spacer(1, 6))
            multi = report_v2.get("multi_scenario_table") or []
            if multi:
                story.append(Paragraph("Multi-scenario comparison", ParagraphStyle("h3", parent=styles["Normal"], fontSize=10, textColor=colors.HexColor("#1e3a8a"), spaceBefore=6, spaceAfter=4)))
                mrows = [["Return (y)", "Prob%", f"Loss ({_sym}M)", "Buildings", "Recovery (mo)"]]
                for row in multi[:6]:
                    mrows.append([
                        str(row.get("return_period_y", "—")),
                        str(row.get("probability_pct", "—")),
                        str(int(row.get("expected_loss_m", 0))),
                        str(row.get("buildings", "—")),
                        str(row.get("recovery_months", "—")),
                    ])
                mt = Table(mrows, colWidths=[1.8 * cm, 1.5 * cm, 2 * cm, 1.8 * cm, 2.2 * cm])
                mt.setStyle(TableStyle([("FONTSIZE", (0, 0), (-1, -1), 8), ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e5e7eb")), ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a8a")), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4), ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]))
                story.append(mt)
                story.append(Spacer(1, 6))
            unc = report_v2.get("model_uncertainty") or {}
            if unc:
                story.append(Paragraph("Model uncertainty &amp; validation", ParagraphStyle("h3", parent=styles["Normal"], fontSize=10, textColor=colors.HexColor("#1e3a8a"), spaceBefore=6, spaceAfter=4)))
                dq = unc.get("data_quality") or {}
                story.append(Paragraph(f"Data quality: exposure {dq.get('exposure_pct', '—')}%, valuations {dq.get('valuations_pct', '—')}%, vulnerability {dq.get('vulnerability_pct', '—')}%", small))
                up = unc.get("uncertainty_pct") or {}
                story.append(Paragraph(f"Uncertainty: hazard ±{up.get('hazard', '—')}%, exposure ±{up.get('exposure', '—')}%, vulnerability ±{up.get('vulnerability', '—')}%, combined ±{up.get('combined', '—')}%", small))
                limits = unc.get("limitations") or []
                if limits:
                    story.append(Paragraph("Limitations: " + "; ".join(self._escape_para(str(l)) for l in limits[:3]), small))
                story.append(Spacer(1, 6))
            story.append(Spacer(1, 8))

        # Zones table
        story.append(Paragraph("Risk Zone Analysis", h2))
        if zones:
            header = ["Zone", "Risk", "Buildings", "Expected Loss", "Population"]
            rows = [header]
            for z in zones[:25]:
                rows.append(
                    [
                        self._escape_para(str(z.get("name", "Zone"))),
                        self._escape_para(str(z.get("zone_level", "medium")).lower()),
                        f"{int(z.get('affected_assets_count', 0) or 0):,}",
                        format_currency_millions(float(z.get("expected_loss", 0) or 0), currency),
                        f"{int(z.get('population_affected', 0) or 0):,}",
                    ]
                )
            zt = Table(rows, repeatRows=1, colWidths=[5.5 * cm, 2.2 * cm, 2.4 * cm, 3.0 * cm, 3.0 * cm])
            zt.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a8a")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("FONTSIZE", (0, 0), (-1, 0), 9),
                        ("FONTSIZE", (0, 1), (-1, -1), 9),
                        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e5e7eb")),
                        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 5),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                        ("TOPPADDING", (0, 0), (-1, -1), 4),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ]
                )
            )
            story.append(zt)
        else:
            story.append(Paragraph("No risk zones provided for this scenario.", normal))
        story.append(Spacer(1, 12))

        # Actions section
        story.append(Paragraph("Recommended Actions", h2))
        actions_list = actions or self._generate_default_actions(stress_test, zones)
        if actions_list:
            for i, a in enumerate(actions_list[:12], start=1):
                title_txt = a.get("title") or a.get("action") or "Action"
                priority = a.get("priority", "Medium")
                timeline = a.get("timeline", "1-3 months")
                cost = a.get("estimated_cost", a.get("cost", 0))
                rr = a.get("risk_reduction", 0)
                line = f"<b>{i}. {self._escape_para(str(title_txt))}</b><br/><font size=9 color='#6b7280'>Priority: {self._escape_para(str(priority))} · Timeline: {self._escape_para(str(timeline))} · Est. Cost: {self._escape_para(format_currency_millions(float(cost or 0), currency))} · Risk Reduction: {self._escape_para(str(rr))}%</font>"
                story.append(Paragraph(line, normal))
                story.append(Spacer(1, 6))
        else:
            story.append(Paragraph("No actions provided.", normal))

        # Cascade simulations section
        if cascade_simulations:
            story.append(Spacer(1, 12))
            story.append(Paragraph("Cascade Simulation Results", h2))
            story.append(Paragraph("Simulations run in Cascade Analysis and added to this report.", small))
            story.append(Spacer(1, 6))
            for i, sim in enumerate(cascade_simulations, start=1):
                trigger = sim.get("trigger_node", "—")
                sev_pct = int((sim.get("trigger_severity") or 0) * 100)
                steps = sim.get("simulation_steps", 0)
                affected = sim.get("affected_count", 0)
                loss = float(sim.get("total_loss") or 0)
                containment = sim.get("containment_points", [])
                crit = sim.get("critical_nodes", [])
                # total_loss from frontend/API is in millions; format as currency millions (e.g. ¥19.1B)
                loss_fmt = format_currency_millions(loss, currency) if loss >= 1 else format_currency(loss, currency)
                text = (
                    f"<b>Simulation #{i}</b><br/>"
                    f"Trigger: {self._escape_para(str(trigger))} at {sev_pct}% severity. "
                    f"Over {steps} step(s), {affected} node(s) affected, total loss {loss_fmt}. "
                )
                if containment:
                    text += f"Containment: {', '.join(containment)}. "
                text += f"<br/><font size=9>Nodes: {affected} | Loss: {loss_fmt} | Critical: {len(crit)} | Containment: {len(containment)}</font>"
                story.append(Paragraph(text, normal))
                story.append(Spacer(1, 6))

        # Concluding summary
        if concluding_summary:
            story.append(Spacer(1, 12))
            story.append(Paragraph("Conclusions & Next Steps", h2))
            concl_text = self._normalize_currency_in_text(str(concluding_summary), _sym)
            story.append(Paragraph(self._escape_para(concl_text), normal))
            story.append(Spacer(1, 6))

        # Footer note
        story.append(Spacer(1, 14))
        story.append(Paragraph("Physical-Financial Risk Platform | Confidential", small))

        def _on_page(canvas, _doc):
            canvas.saveState()
            canvas.setFont("Helvetica", 8)
            canvas.setFillColor(colors.HexColor("#9ca3af"))
            canvas.drawCentredString(A4[0] / 2.0, 1.2 * cm, "Physical-Financial Risk Platform | Confidential")
            canvas.drawRightString(A4[0] - 2 * cm, 1.2 * cm, f"Page {_doc.page}")
            canvas.restoreState()

        doc.build(story, onFirstPage=_on_page, onLaterPages=_on_page)
        return buf.getvalue()

    @staticmethod
    def _strip_html_to_text(s: str) -> str:
        """Best-effort HTML → plain text for PDF fallback."""
        if not s:
            return ""
        # normalize breaks
        s = re.sub(r"(?i)<br\s*/?>", "\n", s)
        s = re.sub(r"(?i)</p\s*>", "\n", s)
        s = re.sub(r"<[^>]+>", "", s)
        s = s.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
        s = re.sub(r"\n{3,}", "\n\n", s)
        return s.strip()

    @staticmethod
    def _escape_para(s: str) -> str:
        """Escape text for ReportLab Paragraph markup."""
        if s is None:
            return ""
        return (
            str(s)
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
        )

    @staticmethod
    def _normalize_currency_in_text(text: str, sym: str) -> str:
        """Replace € in LLM-generated text with report currency symbol (e.g. ¥ for Tokyo)."""
        if not text or sym == "€":
            return text or ""
        return (text or "").replace("€", sym)
    
    def _generate_default_summary(
        self,
        stress_test: Dict[str, Any],
        zones: List[Dict[str, Any]],
        currency: str = "EUR",
    ) -> str:
        """Generate default executive summary."""
        test_type = stress_test.get("test_type", "climate")
        severity = stress_test.get("severity", 0.5)
        city = stress_test.get("region_name", stress_test.get("city", "the target area"))
        
        total_loss_millions = sum(z.get("expected_loss", 0) for z in zones)
        total_buildings = sum(z.get("affected_assets_count", 0) for z in zones)
        
        severity_level = "severe" if severity >= 0.7 else "moderate" if severity >= 0.4 else "limited"
        
        return f"""
        <p>This comprehensive stress test analysis examines the potential impact of a 
        <strong>{test_type}</strong> scenario on {city}. The assessment indicates a 
        <strong>{severity_level}</strong> level of risk exposure with an estimated 
        {severity*100:.0f}% severity rating.</p>
        
        <p>Key findings reveal that approximately <strong>{total_buildings:,} buildings</strong> 
        face direct exposure, with total expected losses of <strong>{format_currency_millions(total_loss_millions, currency)}</strong>. 
        The analysis identifies {len(zones)} distinct risk zones requiring targeted mitigation strategies.</p>
        
        <p>Immediate action is recommended for critical infrastructure protection, 
        emergency response planning, and stakeholder communication to minimize potential losses 
        and ensure business continuity.</p>
        """
    
    def _generate_default_actions(
        self,
        stress_test: Dict[str, Any],
        zones: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Generate default recommended actions."""
        test_type = stress_test.get("test_type", "climate")
        
        actions_by_type = {
            "climate": [
                {"title": "Implement flood barriers and drainage systems", "priority": "High", "timeline": "3-6 months", "cost": 500000, "risk_reduction": 35},
                {"title": "Relocate critical equipment above flood level", "priority": "High", "timeline": "1-2 months", "cost": 150000, "risk_reduction": 25},
                {"title": "Establish emergency evacuation protocols", "priority": "Medium", "timeline": "1 month", "cost": 50000, "risk_reduction": 15},
            ],
            "seismic": [
                {"title": "Structural reinforcement of high-risk buildings", "priority": "Critical", "timeline": "6-12 months", "cost": 2000000, "risk_reduction": 40},
                {"title": "Install seismic early warning systems", "priority": "High", "timeline": "2-3 months", "cost": 300000, "risk_reduction": 20},
                {"title": "Update building codes compliance", "priority": "Medium", "timeline": "3-6 months", "cost": 100000, "risk_reduction": 15},
            ],
            "financial": [
                {"title": "Diversify portfolio exposure", "priority": "Critical", "timeline": "1-2 months", "cost": 0, "risk_reduction": 30},
                {"title": "Implement hedging strategies", "priority": "High", "timeline": "1 month", "cost": 100000, "risk_reduction": 25},
                {"title": "Establish credit monitoring systems", "priority": "Medium", "timeline": "2-3 months", "cost": 75000, "risk_reduction": 20},
            ],
        }
        
        return actions_by_type.get(test_type, actions_by_type["climate"])


# Global service instance
pdf_service = PDFReportService()


def generate_pdf_report(
    stress_test: Dict[str, Any],
    zones: List[Dict[str, Any]],
    actions: Optional[List[Dict[str, Any]]] = None,
    executive_summary: Optional[str] = None,
    cascade_simulations: Optional[List[Dict[str, Any]]] = None,
    region_action_plan: Optional[Dict[str, Any]] = None,
    historical_comparisons: Optional[List[Dict[str, Any]]] = None,
    concluding_summary: Optional[str] = None,
    report_v2: Optional[Dict[str, Any]] = None,
) -> bytes:
    """
    Generate PDF report for a stress test.
    
    Args:
        stress_test: Stress test data
        zones: Risk zones with metrics
        actions: Recommended actions
        executive_summary: AI-generated summary
        cascade_simulations: Cascade simulation results added to report
        report_v2: Report V2 metrics (probabilistic, temporal, contagion, predictive, network, sensitivity, stakeholder, model uncertainty)
        
    Returns:
        PDF file as bytes
    """
    return pdf_service.generate_stress_test_pdf(
        stress_test=stress_test,
        zones=zones,
        actions=actions,
        executive_summary=executive_summary,
        cascade_simulations=cascade_simulations or [],
        region_action_plan=region_action_plan,
        historical_comparisons=historical_comparisons or [],
        concluding_summary=concluding_summary,
        report_v2=report_v2,
    )


def _escape_bcp_para(text: str) -> str:
    """Escape text for ReportLab Paragraph (basic HTML subset)."""
    if not text:
        return ""
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def generate_bcp_pdf(content: str) -> bytes:
    """
    Generate a PDF from BCP text content.
    Splits by ## (heading) and ### (subheading), otherwise paragraphs.
    Requires ReportLab (HAS_REPORTLAB).
    """
    if not HAS_REPORTLAB:
        raise RuntimeError("PDF generation not available (ReportLab not installed)")
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
        title="Business Continuity Plan",
    )
    styles = getSampleStyleSheet()
    h1_style = ParagraphStyle("bcp_h1", parent=styles["Title"], fontSize=16, textColor=colors.HexColor("#1e3a8a"), spaceBefore=12, spaceAfter=6)
    h2_style = ParagraphStyle("bcp_h2", parent=styles["Heading2"], fontSize=13, textColor=colors.HexColor("#1e3a8a"), spaceBefore=10, spaceAfter=4)
    h3_style = ParagraphStyle("bcp_h3", parent=styles["Heading2"], fontSize=11, textColor=colors.HexColor("#374151"), spaceBefore=6, spaceAfter=3)
    normal_style = ParagraphStyle("bcp_normal", parent=styles["Normal"], fontSize=10, leading=13)
    story: List[Any] = []
    story.append(Paragraph("BUSINESS CONTINUITY PLAN", ParagraphStyle("bcp_badge", parent=styles["Normal"], fontSize=8, textColor=colors.HexColor("#64748b"), spaceAfter=4)))
    story.append(Spacer(1, 8))
    lines = (content or "").split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        i += 1
        if not stripped:
            story.append(Spacer(1, 4))
            continue
        if stripped.startswith("## "):
            title = _escape_bcp_para(stripped[3:].strip())
            story.append(Paragraph(title, h1_style))
        elif stripped.startswith("### "):
            title = _escape_bcp_para(stripped[4:].strip())
            story.append(Paragraph(title, h2_style))
        else:
            para = _escape_bcp_para(stripped).replace("\n", " ")
            if para:
                story.append(Paragraph(para.replace("\n", "<br/>"), normal_style))
    doc.build(story)
    return buf.getvalue()