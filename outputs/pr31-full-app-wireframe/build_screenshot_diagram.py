#!/usr/bin/env python3
"""Build an inspectable diagram from unmodified, real Android screenshots.

AI-generated artifact tooling. This does not run or change the mobile app.
Run: python3 build_screenshot_diagram.py [screenshot-manifest.json]
"""

from __future__ import annotations

import base64
import html
import json
import math
import struct
import sys
import textwrap
from collections import OrderedDict
from pathlib import Path
from urllib.parse import quote


ROOT = Path(__file__).resolve().parent
ROUTE_NAMES = {
    "home": "Home / library",
    "upload": "Add presentation",
    "rehearse": "Rehearsal",
    "review": "Slide review",
    "full": "Full review",
    "compare": "Compare",
    "qa": "Audience questions",
}
ROUTE_ORDER = list(ROUTE_NAMES)
COLORS = {"ink": "#20332f", "muted": "#65726e", "accent": "#ae441e", "line": "#cdd3ce", "paper": "#f4f3eb"}


def esc(value):
    return html.escape(str(value), quote=True)


def png_size(path):
    with path.open("rb") as handle:
        header = handle.read(24)
    if len(header) != 24 or header[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"Capture must be a real PNG file: {path}")
    return struct.unpack(">II", header[16:24])


def wrapped(value, width=53):
    return textwrap.wrap(str(value), width, break_long_words=False, break_on_hyphens=False) or [""]


def svg_text(x, y, value, width=53, size=14, fill=None, weight="normal", line_height=None):
    lines = wrapped(value, width)
    fill = fill or COLORS["ink"]
    line_height = line_height or size * 1.36
    content = "".join(f'<tspan x="{x}" dy="{0 if i == 0 else line_height}">{esc(line)}</tspan>' for i, line in enumerate(lines))
    return f'<text x="{x}" y="{y}" fill="{fill}" font-size="{size}" font-weight="{weight}">{content}</text>', len(lines) * line_height


def inspect_input(path):
    manifest = json.loads(path.read_text())
    captures = manifest.get("captures", [])
    if not captures:
        raise ValueError("No actual captures found in the screenshot manifest.")
    seen = set()
    for capture in captures:
        ident = str(capture["id"])
        if not ident or ident in seen:
            raise ValueError(f"Duplicate or empty capture id: {ident!r}")
        if any(ch.isspace() or ch in '<>\"\'#/\\' for ch in ident):
            raise ValueError(f"Capture id must be a simple HTML anchor: {ident!r}")
        seen.add(ident)
        capture["id"] = ident
        capture.setdefault("title", ident)
        capture.setdefault("screen", "unclassified")
        capture.setdefault("group", ROUTE_NAMES.get(capture["screen"], capture["screen"]))
        capture.setdefault("notes", [])
        capture.setdefault("transitions", [])
        relative = Path(capture["file"])
        absolute = (ROOT / relative).resolve()
        if relative.is_absolute() or not absolute.is_relative_to(ROOT):
            raise ValueError(f"Capture must be relative to the artifact folder: {capture['file']}")
        width, height = png_size(absolute)
        capture["width"] = width
        capture["height"] = height
        capture["url"] = quote(relative.as_posix(), safe="/")
        capture["data_uri"] = "data:image/png;base64," + base64.b64encode(absolute.read_bytes()).decode("ascii")
    for capture in captures:
        for transition in capture["transitions"]:
            if str(transition["to"]) not in seen:
                raise ValueError(f"Transition from {capture['id']} targets uncaptured {transition['to']}")
            transition["to"] = str(transition["to"])
    return manifest


def source_metadata(captures):
    """Read existing route evidence; never reuse schematic screen drawings."""
    frames_path = ROOT / "frames.json"
    navigation_path = ROOT / "navigation.svg"
    frames = json.loads(frames_path.read_text()) if frames_path.exists() else []
    # Retain a provenance check on the original route inventory without importing its art.
    navigation = navigation_path.read_text() if navigation_path.exists() else ""
    lookup = {frame["id"]: frame for group in frames for frame in group.get("frames", [])}
    routes = sorted({frame.get("screen") for frame in lookup.values()} - {None}, key=lambda value: ROUTE_ORDER.index(value) if value in ROUTE_ORDER else 99)
    captured = {capture["id"]: capture for capture in captures}
    edges = OrderedDict()
    for capture in captures:
        origin = capture["screen"]
        for transition in capture.get("transitions", []):
            destination = captured[transition["to"]]["screen"]
            if origin != destination:
                edge = (origin, destination)
                edges.setdefault(edge, []).append(transition.get("label", "Open"))
    return {"routes": routes, "route_edges": edges, "frame_count": len(lookup), "navigation_reference_read": bool(navigation)}


def route_map(captures, metadata, standalone=False):
    """Draw only captured routes, with links to their real screenshot destinations."""
    first = {}
    counts = {}
    for capture in captures:
        first.setdefault(capture["screen"], capture["id"])
        counts[capture["screen"]] = counts.get(capture["screen"], 0) + 1
    # Prefer the completed authorized demo when opening its captured routes.
    preferred = {"rehearse": "S29", "review": "S43", "full": "S50", "compare": "S55", "qa": "S44"}
    captured_ids = {capture["id"] for capture in captures}
    for route, ident in preferred.items():
        if ident in captured_ids:
            first[route] = ident
    routes = [route for route in ROUTE_ORDER if route in first] + [route for route in first if route not in ROUTE_ORDER]
    n = len(routes)
    top_n = min(4, n)
    rows = [routes[:top_n], routes[top_n:]] if n > top_n else [routes]
    positions = {}
    for row_number, row in enumerate(rows):
        for index, route in enumerate(row):
            positions[route] = (100 + (index + 0.5) * 1100 / max(len(row), 1), 77 + row_number * 166)
    svg = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1300 365" role="img" aria-labelledby="map-title" class="route-map">', '<title id="map-title">Navigation links between captured app views</title>', '<defs><marker id="nav-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7" fill="#7c8881"/></marker></defs>']
    edges = list(metadata["route_edges"])
    labels = []
    for number, (origin, destination) in enumerate(edges, 1):
        x1, y1 = positions[origin]
        x2, y2 = positions[destination]
        dx, dy = x2 - x1, y2 - y1
        length = math.hypot(dx, dy) or 1
        sx, sy = x1 + dx / length * 61, y1 + dy / length * 33
        ex, ey = x2 - dx / length * 63, y2 - dy / length * 35
        bend = 17 if (destination, origin) in metadata["route_edges"] else 0
        mx, my = (sx + ex) / 2 - dy / length * bend, (sy + ey) / 2 + dx / length * bend
        svg.append(f'<path d="M{sx:.1f} {sy:.1f} Q{mx:.1f} {my:.1f} {ex:.1f} {ey:.1f}" fill="none" stroke="#9ca69f" stroke-width="1.4" marker-end="url(#nav-arrow)"/>')
        labels.append((number, mx, my))
    for number, x, y in labels:
        svg.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="9" fill="#f4f3eb"/><text x="{x:.1f}" y="{y+3.4:.1f}" text-anchor="middle" font-size="10" fill="#65726e">{number}</text>')
    for route, (x, y) in positions.items():
        ident = first[route]
        href = f"#capture-{ident}" if standalone else f"#{ident}"
        label = ROUTE_NAMES.get(route, route)
        svg.append(f'<a href="{esc(href)}"><rect x="{x-99}" y="{y-32}" width="198" height="64" rx="5" fill="#fffef8" stroke="#20332f"/><text x="{x}" y="{y-4}" text-anchor="middle" font-size="16" font-weight="600" fill="#20332f">{esc(label)}</text><text x="{x}" y="{y+18}" text-anchor="middle" font-size="12" fill="#65726e">{counts[route]} real capture{u"s" if counts[route] != 1 else u""} · {esc(ident)}</text></a>')
    svg.append('<text x="100" y="346" font-size="13" fill="#65726e">Arrows link captured views; each node opens an actual screenshot. Numbered actions appear below each screenshot.</text></svg>')
    return "".join(svg), edges, first


STYLE = """
:root{--ink:#20332f;--muted:#65726e;--accent:#ae441e;--paper:#f4f3eb;--line:#cdd3ce;--white:#fffef8;color-scheme:light}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:30px}body{margin:0;background:var(--paper);color:var(--ink);font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5}a{color:inherit;text-decoration-thickness:1px;text-underline-offset:3px}button{font:inherit;color:inherit}button,a{touch-action:manipulation}button:focus-visible,a:focus-visible,summary:focus-visible{outline:3px solid var(--accent);outline-offset:5px}button{cursor:pointer}main{width:min(1420px,100%);margin:auto;padding:42px 45px 80px}.eyebrow{font-size:11px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;color:var(--accent);margin:0 0 18px}.masthead{display:grid;grid-template-columns:1.7fr 1fr;gap:55px;padding-bottom:31px;border-bottom:2px solid var(--ink)}h1{font-size:clamp(37px,4.6vw,69px);line-height:1.02;letter-spacing:-.055em;font-weight:600;margin:0 0 22px}h1 span{font-family:Georgia,serif;font-style:italic;font-weight:400}p{margin:0 0 13px}.intro{max-width:650px;color:var(--muted)}.source{font-size:12px;border-top:1px solid var(--ink);padding-top:12px;align-self:end;overflow-wrap:anywhere}.source dl{margin:0;display:grid;grid-template-columns:83px 1fr;column-gap:10px;row-gap:7px}.source dt{color:var(--muted)}.source dd{margin:0}.metrics{display:flex;flex-wrap:wrap;gap:30px;margin:29px 0}.metric{border-left:2px solid var(--accent);padding-left:13px;font-size:12px;color:var(--muted)}.metric strong{display:block;font-size:29px;line-height:1.1;font-weight:500;color:var(--ink)}.toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:22px 0}.toolbar a,.toolbar button{background:transparent;border:1px solid var(--line);padding:8px 13px;border-radius:2px;font-size:12px;text-decoration:none}.toolbar button:hover,.toolbar a:hover{background:var(--white);border-color:var(--ink)}.route-area{padding:20px 0 14px;border-bottom:1px solid var(--line)}h2{font-size:26px;letter-spacing:-.035em;font-weight:500;margin:0 0 7px}.section-caption{color:var(--muted);font-size:13px}.route-map{display:block;width:100%;height:auto;font-family:Arial,Helvetica,sans-serif}.route-legend{columns:3;column-gap:25px;margin:0 0 12px;padding-left:21px;color:var(--muted);font-size:11px}.route-legend li{break-inside:avoid;margin:0 0 4px;padding-left:3px}.coverage{margin:20px 0 32px;padding:14px 18px;border:1px solid var(--line);font-size:12px;color:var(--muted)}.coverage summary{cursor:pointer;color:var(--ink);font-size:13px}.coverage ul{padding-left:18px}.coverage p{margin:8px 0}.group{margin-top:42px}.group-head{display:flex;justify-content:space-between;align-items:baseline;gap:15px;border-bottom:1px solid var(--ink);padding-bottom:12px;margin-bottom:24px}.group-head h2{margin:0}.group-head span{font-size:12px;color:var(--muted)}.sheet{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));column-gap:34px;row-gap:25px;margin:0 0 29px}.print-head{display:none}.capture{min-width:0;scroll-margin-top:25px}.capture-head{display:flex;gap:12px;align-items:baseline;min-height:56px}.capture-id{color:var(--accent);font-family:monospace;font-size:12px;min-width:31px}.capture h3{font-size:17px;font-weight:500;line-height:1.28;letter-spacing:-.02em;margin:0 0 15px}.image-button{display:block;border:0;padding:0;width:100%;background:transparent;position:relative}.capture img{display:block;width:min(100%,285px);height:auto;margin:0 auto;border:1px solid #d8dbd5;box-shadow:0 5px 20px #20332f09}.image-button::after{content:'↗';position:absolute;right:0;bottom:0;background:var(--ink);color:white;padding:3px 10px;font-size:17px}.capture-meta{display:flex;justify-content:space-between;gap:9px;font-family:monospace;font-size:10px;color:var(--muted);margin:13px 0 11px;border-bottom:1px solid var(--line);padding-bottom:8px;overflow-wrap:anywhere}.notes{font-size:12px;line-height:1.5;color:var(--muted);padding-left:16px;margin:0 0 12px}.notes li{margin-bottom:5px}.actions{padding:0;margin:0;list-style:none;counter-reset:none;font-size:11px;line-height:1.5}.actions li{margin:0 0 5px}.action-number{color:var(--accent);font-family:monospace;margin-right:5px}.actions a{font-weight:500}.raw-link{font-size:10px;color:var(--muted)}.footer{font-size:11px;border-top:1px solid var(--ink);margin-top:40px;padding-top:15px;color:var(--muted)}dialog{width:min(1100px,95vw);max-height:94vh;border:1px solid var(--ink);padding:0;background:var(--paper);color:var(--ink)}dialog::backdrop{background:#182622cc;backdrop-filter:blur(4px)}.dialog-bar{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;align-items:start;background:var(--paper);padding:18px 22px;border-bottom:1px solid var(--line);gap:20px}.dialog-bar h2{margin:0;font-size:23px}.dialog-close{background:transparent;border:1px solid var(--line);font-size:13px;padding:5px 12px}.dialog-body{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(220px,1fr);gap:30px;padding:23px}.dialog-image{max-width:100%;width:auto;height:auto;max-height:75vh;display:block;margin:auto}.dialog-content .notes{font-size:14px}.dialog-content .actions{font-size:13px}.dialog-content p{font-size:12px;color:var(--muted)}.dialog-content h3{font-size:13px;margin:25px 0 10px;font-weight:600}.dialog-content .capture-meta{font-size:11px}.no-actions{font-size:11px;color:var(--muted)}.print-only{display:none}
@media(max-width:900px){main{padding:29px 24px 60px}.masthead{grid-template-columns:1fr;gap:28px}.source{max-width:650px}.sheet{column-gap:20px}.route-legend{columns:2}.capture h3{font-size:15px}.capture-head{min-height:64px}.dialog-body{grid-template-columns:1fr 1fr;gap:20px}}
@media(max-width:620px){main{padding:25px 20px 45px}.metrics{gap:19px}.metric{font-size:10px}.metric strong{font-size:25px}.sheet{grid-template-columns:1fr;gap:35px}.capture-head{min-height:0}.capture img{width:min(100%,330px)}.capture h3{font-size:19px}.capture-meta{font-size:11px}.notes{font-size:13px}.actions{font-size:12px}.route-legend{columns:1}.route-map{min-width:650px}.route-scroll{overflow:auto}.dialog-body{grid-template-columns:1fr}.dialog-content{max-width:450px;margin:auto}.dialog-image{max-height:none;width:min(100%,370px)}.group-head{display:block}.group-head span{display:block;margin-top:6px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
@page{size:A3 landscape;margin:12mm}
@media print{html{scroll-behavior:auto}body{background:white;font-size:9pt}main{width:auto;padding:0}.toolbar,.coverage,.footer,dialog,.raw-link{display:none!important}.cover{break-after:page;height:271mm;overflow:hidden}.masthead{grid-template-columns:1.5fr 1fr;padding-bottom:10mm;gap:25mm}h1{font-size:39pt}.eyebrow{margin-bottom:5mm}.source{font-size:9pt}.intro{font-size:11pt}.metrics{margin:7mm 0;gap:16mm}.metric strong{font-size:25pt}.route-area{border:0;padding:0}.route-area h2{font-size:19pt}.route-map{max-height:91mm}.route-legend{columns:3;font-size:7.5pt}.group{margin:0}.group-head{display:none}.sheet{grid-template-columns:repeat(3,minmax(0,1fr));gap:13mm;break-after:page;break-inside:avoid;margin:0;height:271mm;align-content:start}.sheet:last-child{break-after:page}.print-head{display:block;grid-column:1/-1;border-bottom:1px solid var(--ink);padding-bottom:3mm;margin:0;font-size:9pt;color:var(--muted)}.print-head strong{color:var(--ink);font-weight:500}.capture-head{min-height:11mm}.capture h3{font-size:12pt;margin-bottom:3mm}.capture-id{font-size:8pt}.image-button::after{display:none}.capture img{max-width:79mm;width:auto;max-height:170mm;box-shadow:none;border:.2mm solid #ddd}.capture-meta{font-size:6.5pt;margin:3mm 0 2mm;padding-bottom:2mm}.notes{font-size:7pt;line-height:1.35;margin-bottom:2mm}.notes li{margin-bottom:1mm}.actions{font-size:7pt;line-height:1.3}.actions li{margin-bottom:1mm}.no-actions{font-size:7pt}.print-only{display:block}.print-coverage{break-before:page;font-size:10pt}.print-coverage h2{font-size:22pt}.print-coverage li{margin-bottom:4mm}a{text-decoration:none}.route-scroll{overflow:visible}}
"""


def action_html(capture, by_id):
    if not capture["transitions"]:
        return '<p class="no-actions">No outgoing action documented for this capture.</p>'
    items = []
    for index, transition in enumerate(capture["transitions"], 1):
        target = by_id[transition["to"]]
        items.append(f'<li><span class="action-number">{esc(capture["id"])}.{index}</span>{esc(transition.get("label", "Open"))} → <a href="#{esc(target["id"])}">{esc(target["id"])} · {esc(target["title"])}</a></li>')
    return '<ol class="actions">' + "".join(items) + "</ol>"


def notes_html(capture):
    return '<ul class="notes">' + "".join(f"<li>{esc(note)}</li>" for note in capture["notes"]) + "</ul>" if capture["notes"] else ""


def session_label(capture):
    return {
        "earlier saved-data inspection": "Earlier saved data",
        "authorized synthetic demo": "New synthetic demo",
    }.get(capture.get("capture_session"), "")


def build_html(manifest, metadata):
    captures = manifest["captures"]
    source = manifest.get("source", {})
    by_id = {capture["id"]: capture for capture in captures}
    groups = OrderedDict()
    for capture in captures:
        groups.setdefault(capture["group"], []).append(capture)
    map_svg, edges, first = route_map(captures, metadata)
    routes = {capture["screen"] for capture in captures}
    limitations = list(source.get("limitations", []))
    missing = manifest.get("missing_states", [])
    missing_html = "".join(f'<li><strong>{esc(item.get("screen", "State"))}</strong> — {esc(item.get("reason", "Not captured"))}</li>' for item in missing)
    limit_html = "".join(f"<li>{esc(item)}</li>" for item in limitations)
    pr = source.get("pr", "31")
    pr_url = source.get("pr_url", "https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/31")
    sha = str(source.get("sha", "not recorded"))
    coverage = f'{len(captures)} unmodified screenshots · {len(routes)} of {len(metadata["routes"]) or "?"} source screens represented'
    source_fields = [("Source", f'<a href="{esc(pr_url)}">PR #{esc(pr)}</a> · {esc(sha[:12])}'), ("Package", esc(source.get("package", "not recorded"))), ("Device", esc(source.get("device", "not recorded"))), ("Capture", esc(source.get("provenance", "Actual Android device screenshots")))]
    fields_html = "".join(f"<dt>{label}</dt><dd>{value}</dd>" for label, value in source_fields)
    sections = []
    page_number = 1
    for group, items in groups.items():
        sheets = []
        for offset in range(0, len(items), 3):
            cards = []
            for capture in items[offset:offset + 3]:
                cards.append(f'''<article class="capture" id="{esc(capture['id'])}" data-screen="{esc(capture['screen'])}">
<header class="capture-head"><span class="capture-id">{esc(capture['id'])}</span><h3>{esc(capture['title'])}</h3></header>
<button class="image-button" data-open="{esc(capture['id'])}" aria-label="Enlarge {esc(capture['title'])}"><img src="{esc(capture['url'])}" width="{capture['width']}" height="{capture['height']}" alt="Actual app screenshot: {esc(capture['title'])}" loading="lazy"></button>
<div class="capture-meta"><span>{esc(capture['screen'])}{(' · ' + esc(session_label(capture))) if session_label(capture) else ''}</span><span>{capture['width']} × {capture['height']} · PNG</span></div>
{notes_html(capture)}{action_html(capture, by_id)}<a class="raw-link" href="{esc(capture['url'])}" target="_blank" rel="noopener">Open original capture ↗</a></article>''')
            sheets.append(f'<div class="sheet"><p class="print-head"><strong>OutLoud · actual app diagram</strong> / {esc(group)} <span style="float:right">PR #{esc(pr)} · {esc(sha[:8])} · Sheet {page_number}</span></p>{"".join(cards)}</div>')
            page_number += 1
        sections.append(f'<section class="group" aria-label="{esc(group)}"><div class="group-head"><h2>{esc(group)}</h2><span>{len(items)} real screenshot{u"s" if len(items) != 1 else u""}</span></div>{"".join(sheets)}</section>')
    legend = "".join(f'<li>{esc(ROUTE_NAMES.get(origin, origin))} → <a href="#{esc(first[destination])}">{esc(ROUTE_NAMES.get(destination, destination))}</a></li>' for origin, destination in edges)
    json_data = json.dumps([{key: value for key, value in capture.items() if key != "data_uri"} for capture in captures], ensure_ascii=False).replace("<", "\\u003c")
    summary_count = f"{len(missing)} source states not captured" if missing else "Capture scope and limitations"
    script = """
const captures=JSON.parse(document.getElementById('capture-data').textContent);
const lookup=new Map(captures.map(c=>[c.id,c]));
const dialog=document.getElementById('inspect');
const body=document.getElementById('inspect-body');
let lastButton=null;
function openCapture(id){
 const c=lookup.get(id);if(!c)return;
 const card=document.getElementById(id);
 document.getElementById('inspect-title').textContent=c.id+' · '+c.title;
 body.replaceChildren();
 const photo=document.createElement('a');photo.href=c.url;photo.target='_blank';photo.rel='noopener';photo.ariaLabel='Open original screenshot';
 const img=document.createElement('img');img.src=c.url;img.alt='Actual app screenshot: '+c.title;img.className='dialog-image';photo.append(img);body.append(photo);
 const info=document.createElement('div');info.className='dialog-content';
 const meta=document.createElement('p');meta.textContent=c.screen+' · '+(c.capture_session?c.capture_session+' · ':'')+c.width+' × '+c.height+' original PNG';info.append(meta);
 const note=card.querySelector('.notes');if(note)info.append(note.cloneNode(true));
 const heading=document.createElement('h3');heading.textContent='Actions and destinations';info.append(heading);
 const actions=card.querySelector('.actions,.no-actions');if(actions)info.append(actions.cloneNode(true));
 const link=document.createElement('a');link.href=c.url;link.target='_blank';link.rel='noopener';link.textContent='Open unmodified screenshot ↗';info.append(link);body.append(info);
 if(!dialog.open)dialog.showModal();
}
document.addEventListener('click',event=>{const b=event.target.closest('[data-open]');if(b){lastButton=b;openCapture(b.dataset.open)}});
document.getElementById('inspect-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();const a=event.target.closest('a[href^="#"]');if(a)dialog.close()});
dialog.addEventListener('close',()=>{if(lastButton)lastButton.focus({preventScroll:true})});
document.getElementById('print-board').addEventListener('click',()=>window.print());
"""
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OutLoud · actual app screenshot diagram · PR #{esc(pr)}</title><style>{STYLE}</style></head><body>
<a href="#captures" style="position:absolute;left:-9999px" onfocus="this.style.left='12px'" onblur="this.style.left='-9999px'">Skip to screenshots</a>
<main><div class="cover"><p class="eyebrow">Team 07 / OutLoud / PR #{esc(pr)}</p><header class="masthead"><div><h1>The app,<br><span>as captured.</span></h1><p class="intro">A navigable diagram built from the app running on the connected Android phone. Every screen image below is an unmodified device screenshot.</p></div><aside class="source"><dl>{fields_html}</dl></aside></header>
<div class="metrics"><div class="metric"><strong>{len(captures):02d}</strong>Actual screenshots</div><div class="metric"><strong>{len(routes):02d} / {len(metadata['routes']):02d}</strong>App screens represented</div><div class="metric"><strong>{sum(len(c['transitions']) for c in captures):02d}</strong>Action links</div></div>
<nav class="toolbar" aria-label="Diagram tools"><a href="#captures">View screenshots ↓</a><a href="actual-app-diagram.svg">Standalone SVG ↗</a><a href="actual-app-diagram.pdf">Print PDF ↗</a><button id="print-board">Print / save PDF</button><a href="source-wireframe-board.html">Source wireframe board ↗</a></nav>
<section class="route-area" aria-label="Captured app routes"><h2>Across the app</h2><p class="section-caption">Only screens with real captures appear here. Arrows summarize the navigation links between them; each screenshot lists its actions.</p><div class="route-scroll">{map_svg}</div><ol class="route-legend">{legend}</ol></section></div>
<details class="coverage"><summary>{esc(summary_count)} · {esc(coverage)}</summary><p>The source board inventories {metadata['frame_count']} states. A captured app screen does not establish that every conditional state or provider result was reached.</p><ul>{limit_html}{missing_html}</ul></details>
<div id="captures">{"".join(sections)}</div>
<section class="print-only print-coverage"><p class="eyebrow">Capture evidence</p><h2>Scope and limitations</h2><p>{esc(coverage)}.</p><p>The source board inventories {metadata['frame_count']} states. Screen images are real captures; navigation arrows are source-derived and do not certify that every action was executed successfully.</p><ul>{limit_html}{missing_html}</ul></section>
<footer class="footer">{esc(coverage)}. PR #{esc(pr)} · {esc(sha)}. Capture files are retained in <a href="screenshot-manifest.json">the manifest</a>. The earlier source wireframes remain available separately.</footer></main>
<dialog id="inspect" aria-labelledby="inspect-title"><div class="dialog-bar"><h2 id="inspect-title">Actual screenshot</h2><button class="dialog-close" id="inspect-close" aria-label="Close screenshot inspector">Close ✕</button></div><div id="inspect-body" class="dialog-body"></div></dialog>
<script type="application/json" id="capture-data">{json_data}</script><script>{script}</script></body></html>'''


def build_svg(manifest, metadata):
    captures = manifest["captures"]
    source = manifest.get("source", {})
    by_id = {capture["id"]: capture for capture in captures}
    groups = OrderedDict()
    for capture in captures:
        groups.setdefault(capture["group"], []).append(capture)
    width, margin, gap, card_width = 1380, 45, 30, 410
    svg = []
    y = 60
    svg.append(f'<text x="{margin}" y="{y}" fill="{COLORS["accent"]}" font-size="13" letter-spacing="2">OUTLOUD / ACTUAL APP / PR #{esc(source.get("pr", 31))}</text>')
    y += 62
    svg.append(f'<text x="{margin}" y="{y}" font-size="48" font-weight="600" letter-spacing="-2">The app, as captured.</text>')
    y += 35
    value = f'{len(captures)} unmodified phone screenshots · {len(set(c["screen"] for c in captures))} of {len(metadata["routes"])} source screens · PR head {str(source.get("sha", "not recorded"))[:12]}'
    block, _ = svg_text(margin, y, value, 130, 16, COLORS["muted"])
    svg.append(block)
    y += 30
    value = f'{source.get("device", "Device not recorded")} · {source.get("package", "Package not recorded")}'
    block, h = svg_text(margin, y, value, 130, 13, COLORS["muted"])
    svg.append(block)
    y += h + 18
    map_svg, _, _ = route_map(captures, metadata, standalone=True)
    nested_map = map_svg.replace('<svg ', '<svg x="0" y="0" width="1370" height="385" ', 1)
    svg.append(f'<g transform="translate(5 {y})">{nested_map}</g>')
    y += 425
    svg.append(f'<line x1="{margin}" y1="{y}" x2="1335" y2="{y}" stroke="{COLORS["ink"]}"/>')
    y += 42
    for group, items in groups.items():
        block, _ = svg_text(margin, y, group, 95, 27, weight="500")
        svg.append(block)
        y += 30
        for offset in range(0, len(items), 3):
            batch = items[offset:offset + 3]
            row_height = 0
            rendered = []
            for index, capture in enumerate(batch):
                x = margin + index * (card_width + gap)
                cy = y + 29
                group_svg = [f'<g id="capture-{esc(capture["id"])}">']
                group_svg.append(f'<text x="{x+15}" y="{cy}" fill="{COLORS["accent"]}" font-family="monospace" font-size="13">{esc(capture["id"])}</text>')
                block, h = svg_text(x + 57, cy, capture["title"], 31, 19, weight="500")
                group_svg.append(block)
                cy += max(h, 50) + 10
                image_width = 294
                image_height = image_width * capture["height"] / capture["width"]
                image_x = x + (card_width - image_width) / 2
                group_svg.append(f'<a href="{esc(capture["url"])}"><image x="{image_x}" y="{cy}" width="{image_width}" height="{image_height:.2f}" href="{capture["data_uri"]}" preserveAspectRatio="xMidYMid meet"/></a>')
                cy += image_height + 24
                session = session_label(capture)
                block, h = svg_text(x + 15, cy, f'{capture["screen"]}{" · " + session if session else ""} · {capture["width"]} × {capture["height"]} · original PNG', 55, 11, COLORS["muted"])
                group_svg.append(block)
                cy += h + 12
                for note in capture["notes"]:
                    block, h = svg_text(x + 15, cy, "• " + str(note), 57, 12, COLORS["muted"])
                    group_svg.append(block)
                    cy += h + 7
                for number, transition in enumerate(capture["transitions"], 1):
                    target = by_id[transition["to"]]
                    value = f'{capture["id"]}.{number} {transition.get("label", "Open")} → {target["id"]} · {target["title"]}'
                    block, h = svg_text(x + 15, cy, value, 54, 12, COLORS["accent"])
                    group_svg.append(f'<a href="#capture-{esc(target["id"])}">{block}</a>')
                    cy += h + 7
                cy += 18
                group_svg.append("</g>")
                rendered.append((x, cy - y, "".join(group_svg)))
                row_height = max(row_height, cy - y)
            for x, height, content in rendered:
                svg.append(f'<rect x="{x}" y="{y}" width="{card_width}" height="{row_height}" rx="3" fill="#fffef8" stroke="#cdd3ce"/>')
                svg.append(content)
            y += row_height + 28
        y += 30
    limitations = source.get("limitations", [])
    missing = manifest.get("missing_states", [])
    if limitations or missing:
        y += 10
        block, _ = svg_text(margin, y, "Capture scope and limitations", 95, 27, weight="500")
        svg.append(block)
        y += 35
        for value in limitations:
            block, h = svg_text(margin, y, "• " + str(value), 153, 14, COLORS["muted"])
            svg.append(block)
            y += h + 10
        for item in missing:
            value = f'{item.get("screen", "State")}: {item.get("reason", "Not captured")}'
            block, h = svg_text(margin, y, "• " + value, 153, 14, COLORS["muted"])
            svg.append(block)
            y += h + 10
    y += 24
    block, h = svg_text(margin, y, "Screenshots are actual captures. Source navigation does not certify that every action or provider operation completed. Earlier source wireframes are preserved separately.", 150, 12, COLORS["muted"])
    svg.append(block)
    height = math.ceil(y + h + 45)
    return f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 {width} {height}" width="{width}" height="{height}" role="img" aria-label="OutLoud actual app screenshot diagram from PR 31" font-family="Arial,Helvetica,sans-serif"><title>OutLoud — actual app screenshot diagram</title><rect width="100%" height="100%" fill="{COLORS["paper"]}"/>{"".join(svg)}</svg>'


def main():
    path = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT / "screenshot-manifest.json"
    manifest = inspect_input(path)
    metadata = source_metadata(manifest["captures"])
    board = build_html(manifest, metadata)
    (ROOT / "screenshot-board.html").write_text(board)
    (ROOT / "index.html").write_text(board)
    (ROOT / "actual-app-diagram.svg").write_text(build_svg(manifest, metadata))
    summary = {
        "manifest": str(path),
        "actual_captures": len(manifest["captures"]),
        "captured_screens": sorted({capture["screen"] for capture in manifest["captures"]}),
        "source_screens": metadata["routes"],
        "source_states": metadata["frame_count"],
        "action_links": sum(len(capture["transitions"]) for capture in manifest["captures"]),
        "missing_state_entries": len(manifest.get("missing_states", [])),
        "embedded_images": len(manifest["captures"]),
        "source_navigation_reference_read": metadata["navigation_reference_read"],
        "generated": ["index.html", "screenshot-board.html", "actual-app-diagram.svg"],
    }
    (ROOT / "screenshot-build.json").write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
