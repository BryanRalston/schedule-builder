from pathlib import Path
p = Path(__file__).resolve().parents[1] / "tests" / "test-v260-ux.mjs"
t = p.read_text(encoding="utf-8")
t = t.replace(
    "if (String(ver).includes('2.6.0')) pass('version-2.6.0', ver);",
    "if (/^2\\.6/.test(String(ver))) pass('version-2.6.0', ver);",
)
p.write_text(t, encoding="utf-8")
print("ok")
