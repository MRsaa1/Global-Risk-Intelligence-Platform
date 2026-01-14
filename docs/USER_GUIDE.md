# Physical-Financial Risk Platform - User Guide

## Welcome

Welcome to the **Physical-Financial Risk Platform** - The Operating System for the Physical Economy.

This guide will help you get started and make the most of the platform.

---

## Getting Started

### 1. Login

- Navigate to the login page
- Use your credentials or demo account: `demo@example.com` / `demo`
- You'll see an onboarding tour on first login

### 2. Dashboard Overview

The dashboard provides:
- **Portfolio Summary**: Total assets, at-risk count, portfolio value
- **Recent Alerts**: Latest notifications from SENTINEL agent
- **Risk Distribution**: Climate, Physical, Network, Financial risk breakdown
- **Platform Layers**: Status of all 5 layers

### 3. Adding Your First Asset

1. Go to **Assets** page
2. Click **Add Asset**
3. Fill in basic information:
   - Name and description
   - Location (address or coordinates)
   - Asset type
   - Physical attributes (area, floors, year built)
   - Current valuation
4. Upload a BIM file (IFC format) to create a Digital Twin

---

## Key Features

### Living Digital Twins

Every asset has a **Digital Twin** that includes:
- **3D Geometry**: View your asset in 3D with risk overlay
- **Timeline**: Complete history from construction to now
- **Current State**: Real-time sensor data and condition
- **Climate Exposures**: Flood, heat, wind, wildfire risk scores
- **Financial Metrics**: PD, LGD, valuation

**To view a Digital Twin:**
1. Open an asset
2. Click **View Twin** button
3. Explore the 3D model and timeline

### Climate Risk Assessment

**Run a climate stress test:**
1. Go to **Simulations** page
2. Click **New Simulation**
3. Select assets and scenario (SSP245, SSP585, etc.)
4. Set time horizon (e.g., 2050)
5. View results with exposure scores and financial impacts

**Scenarios:**
- **SSP126**: Sustainability (Paris Agreement aligned)
- **SSP245**: Middle of the road
- **SSP370**: Regional rivalry
- **SSP585**: Fossil-fueled development (worst case)

### Network Intelligence

**Discover hidden dependencies:**
1. View asset detail page
2. Check **Network Risk Score**
3. See infrastructure dependencies
4. Run cascade simulation to see propagation

**Example:** Power grid failure affects 23 assets with €1.2B exposure. Traditional models show €0. You see €1.2B.

### Autonomous Agents

**SENTINEL** monitors 24/7 and alerts you to:
- Weather threats (hurricanes, floods)
- Sensor anomalies
- Infrastructure issues
- Climate threshold breaches

**ANALYST** provides deep analysis:
- Root cause analysis
- Sensitivity analysis
- Trend detection

**ADVISOR** recommends actions:
- Multiple options with NPV/ROI
- Prioritized by urgency
- Decision support

---

## Best Practices

### 1. Keep Digital Twins Updated

- Upload new BIM files after renovations
- Add timeline events for inspections and incidents
- Sync regularly to update risk scores

### 2. Monitor Alerts

- Check dashboard daily for new alerts
- Acknowledge and resolve alerts promptly
- Review ADVISOR recommendations

### 3. Run Regular Stress Tests

- Monthly climate stress tests
- Quarterly cascade simulations
- Annual comprehensive analysis

### 4. Review Network Dependencies

- Map all infrastructure dependencies
- Identify shared risks
- Plan for redundancy

---

## Tips & Tricks

### Keyboard Shortcuts

- `Cmd/Ctrl + K`: Quick search
- `Cmd/Ctrl + /`: Show shortcuts

### 3D Viewer

- **Drag**: Rotate camera
- **Scroll**: Zoom in/out
- **Shift + Drag**: Pan
- **Click object**: Select and view details

### Risk Scores

- **0-39**: Low risk (green)
- **40-69**: Medium risk (amber)
- **70-100**: High risk (red)

---

## Support

### Feedback

Click the **feedback button** (bottom right) to:
- Report bugs
- Request features
- Share improvements

### Documentation

- **API Docs**: http://localhost:9002/docs
- **Architecture**: See `/docs/architecture/`
- **This Guide**: `/docs/USER_GUIDE.md`

---

## FAQ

**Q: How accurate are the risk scores?**
A: Scores are based on industry-standard models (CMIP6, FEMA, etc.) and calibrated to real-world data. Confidence levels are shown for each assessment.

**Q: Can I export data?**
A: Yes, use the API or contact support for bulk exports.

**Q: How often should I sync Digital Twins?**
A: Daily for active assets, weekly for others. Automatic sync can be configured.

**Q: What BIM formats are supported?**
A: IFC 2x3, IFC 4, IFC 4.3. More formats coming soon.

---

**Version:** 0.1.0  
**Last Updated:** 2024-01-12
