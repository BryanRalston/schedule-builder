from pathlib import Path
import re
import json

root = Path(__file__).resolve().parents[1]

# index version
idx = root / "index.html"
t = idx.read_text(encoding="utf-8")
t = re.sub(r"const APP_VERSION = '[^']+'", "const APP_VERSION = '2.5.9'", t)
t = re.sub(
    r'id="app-version-label">v[^<]+</span>',
    'id="app-version-label">v2.5.9</span>',
    t,
)
idx.write_text(t, encoding="utf-8")
print("APP_VERSION", re.search(r"const APP_VERSION = '([^']+)'", t).group(1))
print("federal", "FEDERAL_HOLIDAY_DEFS" in t)

# sw
sw = root / "sw.js"
st = sw.read_text(encoding="utf-8")
st = re.sub(r"msb-pro-v[\d.]+", "msb-pro-v2.5.9", st)
sw.write_text(st, encoding="utf-8")
print([ln for ln in st.splitlines() if "CACHE" in ln][:1])

# version.json
vp = root / "version.json"
v = json.loads(vp.read_text(encoding="utf-8"))
v["version"] = "2.5.9"
vp.write_text(json.dumps(v, indent=2) + "\n", encoding="utf-8")
print(v)

# polish test version
pt = root / "tests" / "test-v257-polish.mjs"
ptt = pt.read_text(encoding="utf-8")
ptt = re.sub(
    r"if \(String\(ver\)\.includes\('2\.5\.8'\) \|\| String\(ver\)\.includes\('2\.5\.7'\)\) pass\('version-ok', ver\);",
    "if (/^2\\.5\\.\\d+/.test(String(ver)) || /^2\\.6/.test(String(ver))) pass('version-ok', ver);",
    ptt,
)
# also loosen fairness-dom-order if present - leave as is
pt.write_text(ptt, encoding="utf-8")
print("polish test updated")
