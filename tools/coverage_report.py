"""Aggregate native coverage counts using the team's approved source groups.

AI-generated with OpenAI Codex, 2026-10-22.
Attribution: docs/ai-collaboration-prompts-iteration-2.md#coverage-setup-and-first-measurement--october-22-2026
"""
import argparse
import configparser
import fnmatch
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def group_for(area, relative):
    if area == "mobile":
        return "mobile_ui" if relative.endswith(".tsx") else "mobile_logic"
    if relative.startswith("rehearsals/services/") or relative in {
        "rehearsals/models.py", "rehearsals/limits.py", "rehearsals/tasks.py"
    }:
        return "backend_logic"
    return "backend_api"


def scope(area):
    base = ROOT / area
    included, excluded = {}, []
    config = configparser.ConfigParser()
    if area == "backend":
        config.read(base / ".coveragerc")
    patterns = config.get("run", "omit").split() if area == "backend" else json.loads((base / ".c8rc.json").read_text())["exclude"]
    files = (base / "src").rglob("*") if area == "mobile" else [base / "manage.py", *(base / "config").rglob("*.py"), *(base / "rehearsals").rglob("*.py")]
    for path in sorted(files):
        if not path.is_file() or (area == "mobile" and path.suffix not in {".ts", ".tsx"}):
            continue
        relative = path.relative_to(base).as_posix()
        reason = None
        if relative.endswith(".d.ts"):
            reason = "Type declaration"
        if any(fnmatch.fnmatch(relative, p) or fnmatch.fnmatch("/" + relative, p) for p in patterns):
            reason = "Type declaration" if area == "mobile" else ("Generated schema migration" if "/migrations/" in relative else "Test or test helper")
        if reason:
            excluded.append({"path": relative, "reason": reason})
        else:
            included[relative] = group_for(area, relative)
    return included, excluded


def aggregate(area, raw, expected, policy):
    groups = {
        name: {**meta, "files": [], "counts": {"lines": {"covered": 0, "total": 0}, "branches": {"covered": 0, "total": 0}}}
        for name, meta in policy["groups"].items() if name.startswith(area + "_")
    }
    observed = set()
    files = raw["files"] if area == "backend" else {k: v for k, v in raw.items() if k != "total"}
    for filename, data in files.items():
        path = Path(filename)
        relative = path.resolve().relative_to(ROOT / area).as_posix() if path.is_absolute() else path.as_posix()
        if relative not in expected:
            raise ValueError("Coverage contains an unexpected source file: " + relative)
        observed.add(relative)
        group = groups[expected[relative]]
        group["files"].append(relative)
        if area == "backend":
            summary = data["summary"]
            counts = {
                "lines": {"covered": summary["covered_lines"], "total": summary["num_statements"]},
                "branches": {"covered": summary["covered_branches"], "total": summary["num_branches"]},
            }
        else:
            counts = {metric: data[metric] for metric in ["lines", "branches"]}
        for metric, values in counts.items():
            for field in ["covered", "total"]:
                group["counts"][metric][field] += values[field]
    missing = sorted(set(expected) - observed)
    if missing:
        raise ValueError("Source files missing from coverage: " + ", ".join(missing))
    for group in groups.values():
        group["passed"] = True
        for metric, values in group["counts"].items():
            if values["total"] == 0:
                raise ValueError("No measurable " + metric + " in " + group["name"])
            values["pct"] = round(100 * values["covered"] / values["total"], 2)
            values["target"] = group[metric]
            values["passed"] = 100 * values["covered"] >= group[metric] * values["total"]
            group["passed"] &= values["passed"]
    return groups


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("area", choices=["mobile", "backend"])
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    policy = json.loads((ROOT / "tools/coverage-policy.json").read_text())
    folder = ROOT / args.area / "coverage"
    raw = json.loads((folder / ("coverage.json" if args.area == "backend" else "coverage-summary.json")).read_text())
    included, excluded = scope(args.area)
    groups = aggregate(args.area, raw, included, policy)
    result = {"area": args.area, "policy": policy, "groups": groups, "included": included, "excluded": excluded}
    (folder / "groups.json").write_text(json.dumps(result, indent=2) + "\n")
    rows = []
    for group in groups.values():
        cells = [html.escape(group["name"]), html.escape(group["maintainer"])]
        for metric in ["lines", "branches"]:
            value = group["counts"][metric]
            cells.append(f'{value["pct"]:.2f}% ({value["covered"]}/{value["total"]}); target {value["target"]}%')
        cells.append("PASS" if group["passed"] else "BELOW TARGET")
        rows.append("<tr>" + "".join("<td>" + c + "</td>" for c in cells) + "</tr>")
        print(group["name"], ":", " | ".join(cells[2:]))
    (folder / "groups.html").write_text(
        '<!doctype html><html lang="en"><meta charset="utf-8"><title>OutLoud coverage</title>'
        '<style>body{font:16px system-ui;margin:40px;color:#222}table{border-collapse:collapse}th,td{padding:16px;border:1px solid #bbb;text-align:left}</style>'
        '<h1>OutLoud coverage: ' + args.area + '</h1><p>Targets approved October 22, 2026. Automated test execution coverage.</p>'
        '<table><tr><th>Group</th><th>Maintainer</th><th>Lines</th><th>Branches</th><th>Outcome</th></tr>'
        + "".join(rows) + '</table><p>See groups.json for source scope and exclusions; native reports remain alongside this page.</p></html>'
    )
    return int(args.check and not all(g["passed"] for g in groups.values()))


if __name__ == "__main__":
    raise SystemExit(main())
