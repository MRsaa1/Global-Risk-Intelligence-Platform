# Zone stress test (3D) and Municipal reports

Stress tests run on **already drawn zones** in the **Google 3D Photorealistic** view are a separate testing stage. Instrumentation and reports for this flow live in **Municipal Dashboard**.

## Where to run

- **Digital Twin panel** (when a 3D city is open from Command Center or elsewhere): at the bottom, use **«Запустить»**. One click runs the zone stress test for the current city, draws risk zones in 3D, and saves the report to the Municipal list.
- **Municipal Dashboard**: in **Overview**, select a country and city, enable **3D city**, then click **«Запустить»**. The test runs for that city and the report is added to the list; the view switches to the Simulation reports tab.

## Where reports are visible

All reports from these runs are listed in **Municipal Dashboard → tab «Simulation reports»** (Отчёты симуляций). From there you can open the full report (same content as the standalone `/report` page).

Reports are stored in the browser (`localStorage` key `pfrp-municipal-zone-reports`). The backend marks these runs with `source=zone_simulation` when the request includes that parameter.

## API

- `POST /api/v1/stress-tests/execute` accepts an optional body field `source: "zone_simulation"`. The response includes `report_source: "zone_simulation"` when provided.
