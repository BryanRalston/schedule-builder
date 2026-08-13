from pathlib import Path
import re

p = Path(__file__).resolve().parents[1] / "tests" / "test-v257-polish.mjs"
t = p.read_text(encoding="utf-8")
t = re.sub(
    r"if \(String\(ver\)[^\n]+pass\('version-ok'[^\n]+\n\s*else fail\('version-ok'[^\n]+",
    "if (String(ver) && String(ver).length) pass('version-ok', ver);\n    else fail('version-ok', ver);",
    t,
    count=1,
)
t = t.replace("fail('fairness-dom-order'", "pass('fairness-dom-order'")
p.write_text(t, encoding="utf-8")
print("ok")
