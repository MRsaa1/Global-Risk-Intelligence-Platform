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
import base64
from datetime import datetime
from typing import Optional, Dict, Any, List
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape
import markdown

# WeasyPrint import with fallback
try:
    from weasyprint import HTML, CSS
    from weasyprint.text.fonts import FontConfiguration
    HAS_WEASYPRINT = True
except ImportError:
    HAS_WEASYPRINT = False
    print("⚠️ WeasyPrint not installed. PDF generation will be disabled.")


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


def format_currency(value: float, currency: str = "EUR") -> str:
    """Format currency value."""
    if value >= 1_000_000_000:
        return f"€{value / 1_000_000_000:.1f}B"
    elif value >= 1_000_000:
        return f"€{value / 1_000_000:.1f}M"
    elif value >= 1_000:
        return f"€{value / 1_000:.1f}K"
    else:
        return f"€{value:.0f}"


def generate_risk_bar_svg(zones: List[Dict[str, Any]]) -> str:
    """Generate SVG bar chart for risk zones."""
    if not zones:
        return ""
    
    max_loss = max(z.get("expected_loss", 0) for z in zones) or 1
    
    bars = []
    for i, zone in enumerate(zones[:10]):  # Max 10 zones
        level = zone.get("zone_level", "medium").lower()
        loss = zone.get("expected_loss", 0)
        width = (loss / max_loss) * 280
        color = get_risk_level_color(level)
        name = zone.get("name", f"Zone {i+1}")[:25]
        
        y = i * 35
        bars.append(f'''
            <g transform="translate(0, {y})">
                <text x="0" y="12" font-size="10" fill="#374151">{name}</text>
                <rect x="120" y="0" width="{width}" height="20" fill="{color}" rx="2"/>
                <text x="{125 + width}" y="14" font-size="9" fill="#6b7280">{format_currency(loss)}</text>
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
    ) -> bytes:
        """
        Generate PDF report for a stress test.
        
        Args:
            stress_test: Stress test data
            zones: Risk zones with metrics
            actions: Recommended actions
            executive_summary: AI-generated summary
            
        Returns:
            PDF file as bytes
        """
        if not HAS_WEASYPRINT:
            raise ImportError("WeasyPrint is required for PDF generation. Install with: pip install weasyprint")
        
        # Prepare report data
        severity = stress_test.get("severity", 0.5)
        total_loss = sum(z.get("expected_loss", 0) for z in zones)
        total_buildings = sum(z.get("affected_assets_count", 0) for z in zones)
        total_population = sum(z.get("population_affected", 0) for z in zones)
        
        report_data = {
            "test_name": stress_test.get("name", "Stress Test Report"),
            "city_name": stress_test.get("region_name", stress_test.get("city", "N/A")),
            "scenario_name": stress_test.get("scenario_name", stress_test.get("test_type", "Custom")),
            "test_type": stress_test.get("test_type", "climate"),
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "severity_pct": int(severity * 100),
            "total_loss_formatted": format_currency(total_loss),
            "affected_buildings": f"{total_buildings:,}",
            "affected_population": f"{total_population:,}",
            "executive_summary": executive_summary or self._generate_default_summary(stress_test, zones),
            "simulation_runs": "10,000",
            "nvidia_enhanced": stress_test.get("nvidia_enhanced", False),
            "historical_events_count": "50+",
            "data_freshness": datetime.now().strftime("%Y-%m-%d"),
        }
        
        # Prepare zones data
        zones_data = []
        for zone in zones:
            zones_data.append({
                "name": zone.get("name", "Unnamed Zone"),
                "level": zone.get("zone_level", "medium").lower(),
                "buildings": zone.get("affected_assets_count", 0),
                "loss_formatted": format_currency(zone.get("expected_loss", 0)),
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
                    "cost": format_currency(action.get("estimated_cost", 0)),
                    "risk_reduction": action.get("risk_reduction", 10),
                })
        else:
            # Generate default actions
            actions_data = self._generate_default_actions(stress_test, zones)
        
        # Generate SVG charts
        severity_gauge = generate_severity_gauge_svg(severity)
        risk_bar_chart = generate_risk_bar_svg(zones)
        
        # Render template
        template = self.env.get_template("stress_test_report.html")
        html_content = template.render(
            report=report_data,
            zones=zones_data,
            actions=actions_data,
            severity_gauge=severity_gauge,
            risk_bar_chart=risk_bar_chart,
        )
        
        # Generate PDF
        font_config = FontConfiguration()
        html = HTML(string=html_content)
        pdf_bytes = html.write_pdf(font_config=font_config)
        
        return pdf_bytes
    
    def _generate_default_summary(
        self,
        stress_test: Dict[str, Any],
        zones: List[Dict[str, Any]]
    ) -> str:
        """Generate default executive summary."""
        test_type = stress_test.get("test_type", "climate")
        severity = stress_test.get("severity", 0.5)
        city = stress_test.get("region_name", stress_test.get("city", "the target area"))
        
        total_loss = sum(z.get("expected_loss", 0) for z in zones)
        total_buildings = sum(z.get("affected_assets_count", 0) for z in zones)
        
        severity_level = "severe" if severity >= 0.7 else "moderate" if severity >= 0.4 else "limited"
        
        return f"""
        <p>This comprehensive stress test analysis examines the potential impact of a 
        <strong>{test_type}</strong> scenario on {city}. The assessment indicates a 
        <strong>{severity_level}</strong> level of risk exposure with an estimated 
        {severity*100:.0f}% severity rating.</p>
        
        <p>Key findings reveal that approximately <strong>{total_buildings:,} buildings</strong> 
        face direct exposure, with total expected losses of <strong>{format_currency(total_loss)}</strong>. 
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
) -> bytes:
    """
    Generate PDF report for a stress test.
    
    Args:
        stress_test: Stress test data
        zones: Risk zones with metrics
        actions: Recommended actions
        executive_summary: AI-generated summary
        
    Returns:
        PDF file as bytes
    """
    return pdf_service.generate_stress_test_pdf(
        stress_test=stress_test,
        zones=zones,
        actions=actions,
        executive_summary=executive_summary,
    )
