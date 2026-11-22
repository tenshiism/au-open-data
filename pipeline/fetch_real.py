"""Downloads real Australian open data and writes data/dashboard.json for the site.
Raw downloads go to ../raw/ (git-ignored). Run:  python -I pipeline/fetch_real.py [--refresh]

Sources (verified 2026-11-22):
  BoM  – annual mean temperature anomaly vs 1961–1990 (ACORN-SAT), Australia + each state
         (BoM has no separate ACT series; ACT uses the NSW series and is labelled so)
  ABS  – CPI_Q v1.0.0: Rents, weighted average of 8 capital cities, seasonally adjusted
         WPI v1.2.0:   total hourly rates excl. bonuses, all sectors/industries, by state, original
         ERP_Q v1.0.0: estimated resident population by state, sex and age
"""
import json, sys, urllib.request
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
OUT, RAW = ROOT / "data", ROOT / "raw"
REFRESH = "--refresh" in sys.argv
ABS = "https://data.api.abs.gov.au/rest/data/ABS,{id},{ver}/all?startPeriod={start}&format=csvfilewithlabels"
BOM = "http://www.bom.gov.au/web01/ncc/www/cli_chg/timeseries/tmean/0112/{s}/latest.txt"
CODES = {"Australia": "AUS", "New South Wales": "NSW", "Victoria": "VIC", "Queensland": "QLD",
         "Western Australia": "WA", "South Australia": "SA", "Tasmania": "TAS",
         "Australian Capital Territory": "ACT", "Northern Territory": "NT"}
AGES = ["0-4", "5-9", "10-14", "15-19", "20-24", "25-29", "30-34", "35-39", "40-44", "45-49", "50-54",
        "55-59", "60-64", "65-69", "70-74", "75-79", "80-84", "85 and over"]


def download(url, name):
    path = RAW / name
    if REFRESH or not path.exists():
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        path.write_bytes(urllib.request.urlopen(req, timeout=600).read())
    return path


def climate():
    out = {}
    for code in ["AUS", "NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT"]:
        rows = []
        for line in download(BOM.format(s=code.lower()), f"bom_{code.lower()}.txt").read_text().splitlines():
            p = line.split()
            if len(p) == 2 and len(p[0]) == 12:
                rows.append([int(p[0][:4]), float(p[1])])
        out[code] = rows
    out["ACT"] = out["NSW"]
    return out


def annual(df):
    df = df.assign(year=df.TIME_PERIOD.str[:4].astype(int))
    g = df.groupby("year").OBS_VALUE.agg(["mean", "count"])
    g = g[g["count"] == 4]["mean"]
    return {int(y): round(float(v), 2) for y, v in g.items()}


def rents():
    c = pd.read_csv(download(ABS.format(id="CPI_Q", ver="1.0.0", start=2005), "CPI_Q.csv"), low_memory=False)
    c = c[(c.Measure == "Index Numbers") & (c.Index == "Rents")
          & (c.Region == "Weighted average of eight capital cities") & (c["Adjustment Type"] == "Seasonally Adjusted")]
    return annual(c)


def wages():
    w = pd.read_csv(download(ABS.format(id="WPI", ver="1.2.0", start=2005), "WPI.csv"), low_memory=False)
    w = w[(w.Measure == "Quarterly Index") & (w.Index == "Total hourly rates of pay excluding bonuses")
          & (w.Sector == "Private and Public") & (w.Industry == "All Industries") & (w["Adjustment Type"] == "Original")]
    return {CODES[r]: annual(g) for r, g in w.groupby("Region") if r in CODES}


def population():
    e = pd.read_csv(download(ABS.format(id="ERP_Q", ver="1.0.0", start=2023), "ERP_Q.csv"), low_memory=False)
    e = e[e.Region.isin(CODES)]
    latest = sorted(e.TIME_PERIOD.unique())[-1]
    out = {"period": latest, "states": {}}
    for region, g in e.groupby("Region"):
        tot = g[(g.Sex == "Persons") & (g.Age == "All ages")]
        def val(measure, period=latest):
            s = tot[(tot.Measure == measure) & (tot.TIME_PERIOD == period)].OBS_VALUE
            return float(s.iloc[0]) if len(s) else None
        trend = tot[tot.Measure == "ERP Percentage Change Over Previous Year"].sort_values("TIME_PERIOD")
        pyr = g[(g.TIME_PERIOD == latest) & (g.Measure == "Estimated Resident Population") & g.Age.isin(AGES)]
        pv = pyr.pivot_table(index="Age", columns="Sex", values="OBS_VALUE", aggfunc="first")
        out["states"][CODES[region]] = {
            "name": region,
            "erp": val("Estimated Resident Population"),
            "growth": val("ERP Percentage Change Over Previous Year"),
            "change": val("ERP Change Over Previous Year"),
            "trend": [[p, float(v)] for p, v in zip(trend.TIME_PERIOD, trend.OBS_VALUE)],
            "pyramid": [[a, float(pv.loc[a, "Males"]), float(pv.loc[a, "Females"])] for a in AGES if a in pv.index],
        }
    return out


def main():
    OUT.mkdir(exist_ok=True); RAW.mkdir(exist_ok=True)
    d = {"baseline": "1961–1990", "climate": climate(), "rents": rents(), "wages": wages(), "population": population(),
         "sources": {"climate": BOM.format(s="{state}"), "abs": "https://data.api.abs.gov.au (CPI_Q, WPI, ERP_Q)"}}
    (OUT / "dashboard.json").write_text(json.dumps(d, separators=(",", ":")))
    p = d["population"]
    print("climate", {k: len(v) for k, v in d["climate"].items()})
    print("rents", min(d["rents"]), max(d["rents"]), "| wages", {k: (min(v), max(v)) for k, v in d["wages"].items()})
    print("pop", p["period"], {k: (v["growth"], len(v["pyramid"]), len(v["trend"])) for k, v in p["states"].items()})


if __name__ == "__main__":
    main()
