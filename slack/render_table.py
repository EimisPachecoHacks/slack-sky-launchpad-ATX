"""Render the architecture component table as a PNG that mirrors the web version.

Slack's native table block can't show KPI cards, descriptions, savings, a
cost-vs-alternative comparison, or per-row switches. So we render the same
rich table the website shows (HTML/CSS → headless screenshot), matching its
layout: KPI cards on top, then Component / Description / Cost / Savings /
Alternative(cost + $ diff) columns with colored letter badges.

Usage: python slack/render_table.py <architecture.json> <out.png>
"""

import html
import json
import sys

TYPE_COLORS = {
    "compute": "#4299e1", "backend": "#4299e1", "frontend": "#38b2ac",
    "database": "#9f7aea", "storage": "#48bb78", "network": "#ed8936",
    "gateway": "#ed8936", "security": "#f56565", "serverless": "#38b2ac",
    "analytics": "#ecc94b", "ml": "#ed64a6", "container": "#667eea",
}


def esc(s):
    return html.escape(str(s or ""))


def money(v):
    try:
        v = float(v)
        return f"${v:.2f}" if v < 100 else f"${v:.0f}"
    except Exception:
        return "—"


def main(arch_path: str, out_path: str) -> int:
    arch = json.load(open(arch_path))
    comps = arch.get("components") or []
    if not comps:
        return 2
    goal = (arch.get("optimizationPreference") or arch.get("optimization") or "balanced").title()

    # Best (cheapest) alternative per component, from the backend's alternatives.
    alt_by_comp = {}
    for a in arch.get("alternatives") or []:
        cid = str(a.get("originalComponentId") or a.get("original_component_id") or "")
        if not cid:
            continue
        cur = alt_by_comp.get(cid)
        if cur is None or (a.get("cost") or 1e9) < (cur.get("cost") or 1e9):
            alt_by_comp[cid] = a

    total = sum(float(c.get("cost") or 0) for c in comps)
    savings = 0.0
    for c in comps:
        alt = alt_by_comp.get(str(c.get("id")))
        if alt and (alt.get("cost") or 0) < (c.get("cost") or 0):
            savings += float(c.get("cost") or 0) - float(alt.get("cost") or 0)

    rows = []
    for c in comps:
        cid = str(c.get("id"))
        name = esc(c.get("name") or cid)
        typ = (c.get("type") or "").lower()
        color = TYPE_COLORS.get(typ, "#4299e1")
        letter = (c.get("name") or "?")[0].upper()
        desc = esc((c.get("description") or "").strip()[:70] or "—")
        cost = money(c.get("cost"))
        alt = alt_by_comp.get(cid)
        if alt:
            diff = float(alt.get("cost") or 0) - float(c.get("cost") or 0)
            alt_cost = money(alt.get("cost"))
            if diff < 0:
                diff_html = f'<span class="save">-{money(abs(diff))}</span>'
                sav = f'<span class="save">{money(abs(diff))}</span>'
            elif diff > 0:
                diff_html = f'<span class="up">+{money(diff)}</span>'
                sav = '<span class="muted">—</span>'
            else:
                diff_html = '<span class="muted">Same</span>'
                sav = '<span class="muted">—</span>'
            alt_cell = f'<div class="altname">⇄ {esc(alt.get("name"))}</div><div class="altcost">{alt_cost} · {diff_html}</div>'
        else:
            sav = '<span class="muted">—</span>'
            alt_cell = '<span class="muted">no alternative</span>'
        rows.append(f"""
          <tr>
            <td><div class="cell"><span class="badge" style="background:{color}22;color:{color};border-color:{color}">{esc(letter)}</span>
              <span class="cname">{name}</span></div></td>
            <td class="desc">{desc}</td>
            <td class="cost">{cost}</td>
            <td>{sav}</td>
            <td class="alt">{alt_cell}</td>
          </tr>""")

    title = esc(arch.get("name") or "Architecture")
    provider = esc((arch.get("provider") or "").upper())
    doc = f"""<!doctype html><html><head><meta charset="utf-8"><style>
      * {{ box-sizing: border-box; margin: 0; font-family: -apple-system, 'Segoe UI', Arial; }}
      body {{ background: #0b0e13; color: #e8eaed; padding: 28px 32px; width: 1360px; }}
      .top {{ display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px; }}
      h1 {{ font-size: 24px; font-weight: 800; }}
      .sub {{ color:#8b949e; font-size:13px; margin-top:4px; }}
      .pill {{ border:1px solid #2f7d5b; color:#7ee787; border-radius:8px; padding:7px 14px; font-size:13px; font-weight:600; }}
      .kpis {{ display:grid; grid-template-columns: repeat(3,1fr); gap:16px; margin-bottom:22px; }}
      .kpi {{ border:1px solid #232830; border-radius:12px; padding:18px 20px; background:#12161c; }}
      .kpi.green {{ border-color:#2f7d5b; }}
      .kpi .lbl {{ color:#8b949e; font-size:13px; margin-bottom:8px; }}
      .kpi .val {{ font-size:28px; font-weight:800; }}
      .kpi .val.g {{ color:#7ee787; }}
      table {{ width:100%; border-collapse:collapse; }}
      thead th {{ text-align:left; color:#8b949e; font-size:12px; letter-spacing:.06em; text-transform:uppercase;
                  padding:12px 14px; border-bottom:1px solid #232830; font-weight:600; }}
      tbody td {{ padding:16px 14px; border-bottom:1px solid #1b1f26; font-size:15px; vertical-align:middle; }}
      .cell {{ display:flex; align-items:center; gap:12px; }}
      .badge {{ width:34px; height:34px; border-radius:9px; border:1.5px solid; display:inline-flex;
                align-items:center; justify-content:center; font-weight:800; font-size:15px; }}
      .cname {{ font-weight:700; }}
      .desc {{ color:#a0a6ad; font-size:13px; max-width:360px; }}
      .cost {{ font-weight:700; }}
      .alt .altname {{ color:#58a6ff; font-size:13px; font-weight:600; }}
      .alt .altcost {{ color:#8b949e; font-size:12px; margin-top:2px; }}
      .save {{ color:#7ee787; font-weight:700; }}
      .up {{ color:#f97583; font-weight:700; }}
      .muted {{ color:#6e7681; }}
    </style></head><body>
      <div class="top">
        <div><h1>🏗️ Architecture Components</h1>
          <div class="sub">{title} · {provider} · generated by Nemotron on self-hosted vLLM</div></div>
        <div class="pill">⚙️ {esc(goal)} optimized</div>
      </div>
      <div class="kpis">
        <div class="kpi"><div class="lbl">💰 Total Monthly Cost</div><div class="val">{money(total)}</div></div>
        <div class="kpi green"><div class="lbl">📉 Potential Savings (best alternatives)</div><div class="val g">{money(savings)}</div></div>
        <div class="kpi"><div class="lbl">🧩 Components</div><div class="val">{len(comps)}</div></div>
      </div>
      <table>
        <thead><tr><th>Component</th><th>Description</th><th>Cost</th><th>Savings</th><th>Alternative</th></tr></thead>
        <tbody>{''.join(rows)}</tbody>
      </table>
    </body></html>"""

    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1424, "height": 200}, device_scale_factor=2)
        page.set_content(doc)
        page.wait_for_timeout(200)
        page.screenshot(path=out_path, full_page=True)
        browser.close()
    print(out_path)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2]))
