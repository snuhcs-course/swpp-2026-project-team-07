#!/usr/bin/env python3
"""Prepare an unpublished local Wiki mirror from canonical repository sources."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'output/wiki'
OUT.mkdir(parents=True, exist_ok=True)

copies = {
    ROOT / 'docs/product/requirements-and-specifications.md': OUT / 'Requirements-&-Specifications.md',
    ROOT / 'docs/ai-collaboration/iteration-2/prompt-log.md': OUT / 'AI-Collaboration-Prompt-Log-Iteration-2.md',
}
for source, destination in copies.items():
    shutil.copy2(source, destination)

report = (ROOT / 'docs/ai-collaboration/iteration-2/report-draft.md').read_text(encoding='utf-8')
report = report.replace('(prompt-log.md)', '(AI-Collaboration-Prompt-Log-Iteration-2)')
(OUT / 'AI-Collaboration-Report-Iteration-2-DRAFT.md').write_text(report, encoding='utf-8')

index = """# OutLoud Wiki mirror - local preview

**Status: Unpublished.** This bundle is prepared for team review only. It does not
authorize or prove GitHub Wiki publication.

- [Requirements & Specifications](Requirements-&-Specifications)
- [Design Documentation](Design-Documentation)
- [AI Collaboration Report - Iteration 2 - DRAFT](AI-Collaboration-Report-Iteration-2-DRAFT)
- [Iteration 2 Prompt Log](AI-Collaboration-Prompt-Log-Iteration-2)

Testing Documentation is intentionally absent until the team confirms named component
owners and predeclared coverage targets. Daily Standup Meeting Log content remains on
the existing Wiki and was not downloaded or modified by this documentation task.
Requirements retains its existing Wiki-hosted wireframe image URLs; verify those
remote assets during the authorized synchronization review.
"""
(OUT / 'README.md').write_text(index, encoding='utf-8')
print(f'Prepared unpublished Wiki mirror at {OUT}')
