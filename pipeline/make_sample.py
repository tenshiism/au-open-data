"""Writes clearly-flagged SAMPLE data (sample: true) so the site layout can be checked
before real data is downloaded. The site shows a 'SAMPLE DATA' badge for these.
Replace by running fetch_real.py."""
import json, random
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "data"
OUT.mkdir(exist_ok=True)
random.seed(1)

years = [{"year": y, "temp": round(15.0 + (y - 1910) * 0.011 + random.gauss(0, 0.35), 2)} for y in range(1910, 2026)]
(OUT / "climate.json").write_text(json.dumps({"sample": True, "years": years}))

rows, rent, wage = [], 100.0, 100.0
for y in range(2005, 2026):
    rows.append({"year": y, "rent": round(rent, 1), "wage": round(wage, 1)})
    rent *= 1 + random.uniform(0.02, 0.06); wage *= 1 + random.uniform(0.02, 0.035)
(OUT / "housing.json").write_text(json.dumps({"sample": True, "rows": rows}))

states = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"]
(OUT / "population.json").write_text(json.dumps({"sample": True,
    "states": [{"state": s, "growth": round(random.uniform(0.4, 3.0), 2)} for s in states]}))
print("sample data written to", OUT)
