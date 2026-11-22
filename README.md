# Australia, told through open data

Interactive data portfolio by Graham Jaroslow. Live: https://tenshiism.github.io/au-open-data/

| Project | Source |
|---|---|
| Climate stripes + 10-yr trend, every state | Bureau of Meteorology ACORN-SAT annual mean temperature anomaly |
| Rents vs wages, rebased to any year window | ABS CPI (rents, 8 capitals) and Wage Price Index, seasonally adjusted |
| Age pyramids, tile map, growth momentum | ABS Estimated Resident Population by state |

## Rebuild the data
```
pip install pandas
python -I pipeline/fetch_real.py
```
Writes `data/*.json`; raw downloads go to `raw/` (not committed).

Stack: Python (pandas) pipeline, ABS SDMX Data API, static HTML + Chart.js.
