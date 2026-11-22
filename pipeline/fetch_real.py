"""Downloads real Australian open data and writes data/*.json for the site.
Raw downloads go to ../raw/ (git-ignored). Run:  python -I pipeline/fetch_real.py

Sources (verified 2026-11-22):
  BoM  – Victoria annual mean temperature anomaly (ACORN-SAT), climate-change time series
  ABS  – CPI_Q v1.0.0 (Rents, 8 capitals, SA), WPI v1.2.0 (Australia, SA), ERP_Q v1.0.0 (state population)
"""
import json, urllib.request
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
OUT, RAW = ROOT / "data", ROOT / "raw"
ABS = "https://data.api.abs.gov.au/rest/data/ABS,{id},{ver}/all?startPeriod={start}&format=csvfilewithlabels"
BOM = "http://www.bom.gov.au/web01/ncc/www/cli_chg/timeseries/tmean/0112/vic/latest.txt"
SHORT = {"New South Wales": "NSW", "Victoria": "VIC", "Queensland": "QLD", "Western Australia": "WA",
         "South Australia": "SA", "Tasmania": "TAS", "Australian Capital Territory": "ACT", "Northern Territory": "NT"}


def download(url, name, refresh=False):
    path = RAW / name
    if refresh or not path.exists():
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        path.write_bytes(urllib.request.urlopen(req, timeout=600).read())
    return path


def climate():
    rows = []
    for line in download(BOM, "bom_vic_tmean.txt").read_text().splitlines():
        parts = line.split()
        if len(parts) == 2 and len(parts[0]) == 12:
            rows.append({"year": int(parts[0][:4]), "anom": float(parts[1])})
    return {"source": BOM, "baseline": "1961–1990", "years": rows}


def annual(df):
    df = df.assign(year=df.TIME_PERIOD.str[:4].astype(int))
    g = df.groupby("year").OBS_VALUE.agg(["mean", "count"])
    return g[g["count"] == 4]["mean"]  # complete years only


def housing():
    # Quarterly CPI only publishes rents back to 2005 as the national, seasonally adjusted series.
    c = pd.read_csv(download(ABS.format(id="CPI_Q", ver="1.0.0", start=2005), "CPI_Q.csv"), low_memory=False)
    c = c[(c.Measure == "Index Numbers") & (c.Index == "Rents")
          & (c.Region == "Weighted average of eight capital cities") & (c["Adjustment Type"] == "Seasonally Adjusted")]
    w = pd.read_csv(download(ABS.format(id="WPI", ver="1.2.0", start=2005), "WPI.csv"), low_memory=False)
    w = w[(w.Measure == "Quarterly Index") & (w.Index == "Total hourly rates of pay excluding bonuses")
          & (w.Sector == "Private and Public") & (w.Industry == "All Industries") & (w.Region == "Australia")
          & (w["Adjustment Type"] == "Seasonally Adjusted")]
    rent, wage = annual(c), annual(w)
    years = sorted(set(rent.index) & set(wage.index))
    return {"rows": [{"year": int(y), "rent": round(float(rent[y]), 2), "wage": round(float(wage[y]), 2)} for y in years]}


def population():
    e = pd.read_csv(download(ABS.format(id="ERP_Q", ver="1.0.0", start=2023), "ERP_Q.csv"), low_memory=False)
    e = e[(e.Measure == "ERP Percentage Change Over Previous Year") & (e.Sex == "Persons")
          & (e.Age == "All ages") & (e.Region.isin(SHORT))]
    latest = sorted(e.TIME_PERIOD.unique())[-1]
    e = e[e.TIME_PERIOD == latest]
    return {"period": latest, "states": [{"state": SHORT[r.Region], "growth": float(r.OBS_VALUE)} for r in e.itertuples()]}


def main():
    OUT.mkdir(exist_ok=True); RAW.mkdir(exist_ok=True)
    for name, fn in [("climate", climate), ("housing", housing), ("population", population)]:
        d = fn(); (OUT / f"{name}.json").write_text(json.dumps(d))
        print(name, "ok", {k: (len(v) if isinstance(v, list) else v) for k, v in d.items()})


if __name__ == "__main__":
    main()
