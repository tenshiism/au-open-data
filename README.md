# Australia, told through open data

Interactive data portfolio by Graham Jaroslow. Live: https://tenshiism.github.io/au-open-data/

| Project | Source |
|---|---|
| Victoria is warming (warming stripes) | Bureau of Meteorology ACORN-SAT annual mean temperature anomaly |
| Rents vs wages | ABS CPI (rents, 8 capitals) and Wage Price Index, seasonally adjusted |
| Where Australia is growing | ABS Estimated Resident Population by state |

## Rebuild the data
```
pip install pandas
python -I pipeline/fetch_real.py
```
Writes `data/*.json`; raw downloads go to `raw/` (not committed).

Stack: Python (pandas) pipeline, ABS SDMX Data API, static HTML + Chart.js.
