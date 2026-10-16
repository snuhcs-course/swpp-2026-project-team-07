#!/usr/bin/env python3
"""Check repository Markdown links, heading anchors and retired link targets."""
from pathlib import Path
from urllib.parse import unquote
import re, subprocess, sys

ROOT = Path(__file__).resolve().parents[2]
listed = subprocess.run(
    ['git', '-C', str(ROOT), 'ls-files', '--cached', '--others', '--exclude-standard', '--', '*.md'],
    check=True, capture_output=True, text=True, encoding='utf-8'
).stdout.splitlines()
FILES = [ROOT / relative for relative in listed if relative in {'README.md', 'AGENTS.md'} or relative.startswith(('mobile/', 'docs/'))]
FILES = sorted(path for path in FILES if path.is_file())

RETIRED = {
    'Design-Documentation.md',
    'Design-Documentation.html',
    'Design-Comparison.md',
    'REDESIGN.md',
    'docs/api-contract.md',
    'docs/ai-collaboration-guidelines.md',
    'docs/ai-collaboration-prompts-iteration-2.md',
    'docs/design-tools/',
    'docs/diagram-review/',
    'docs/history/',
    'docs/iteration-1-handoff.md',
    'docs/meeting-log-workflow.md',
    'docs/source-alignment.md',
    'docs/team-work-division.md',
}
EXTERNAL = re.compile(r'^(?:(?:https?|app|codex|ftp)://|(?:mailto|tel|data):)', re.I)
LINK = re.compile(r'!?\[[^\]]*\]\(([^)\s]+)(?:\s+["\'][^"\']*["\'])?\)')
HTML_LINK = re.compile(r'\b(?:href|src)=["\']([^"\']+)["\']', re.I)

def slug(value):
    value = re.sub(r'<[^>]+>', '', value).strip().lower()
    value = re.sub(r'[^\w\- ]', '', value, flags=re.UNICODE)
    return value.replace(' ', '-')

def anchors(path):
    result, counts = set(), {}
    for heading in re.findall(r'^#{1,6}\s+(.+?)\s*#*$', path.read_text(encoding='utf-8-sig'), re.M):
        base = slug(heading)
        number = counts.get(base, 0)
        counts[base] = number + 1
        result.add(base if number == 0 else f'{base}-{number}')
    return result

errors = []
checked = 0
for source in FILES:
    text = source.read_text(encoding='utf-8-sig')
    for raw in LINK.findall(text) + HTML_LINK.findall(text):
        target = unquote(raw.strip('<>'))
        if not target or EXTERNAL.match(target) or target.startswith(('javascript:', 'about:')):
            continue
        checked += 1
        file_part, separator, fragment = target.partition('#')
        normalized = file_part.replace('\\', '/')
        if any(normalized == old or normalized.startswith(old) for old in RETIRED):
            errors.append(f'{source.relative_to(ROOT)}: retired target {target}')
            continue
        destination = source if not file_part else ((ROOT / file_part.lstrip('/')) if file_part.startswith('/') else (source.parent / file_part))
        destination = destination.resolve()
        try:
            destination.relative_to(ROOT.resolve())
        except ValueError:
            errors.append(f'{source.relative_to(ROOT)}: target escapes repository {target}')
            continue
        if not destination.exists():
            errors.append(f'{source.relative_to(ROOT)}: missing target {target}')
            continue
        if fragment and destination.is_file() and destination.suffix.lower() == '.md':
            if fragment.lower() not in anchors(destination):
                errors.append(f'{source.relative_to(ROOT)}: missing anchor {target}')

print(f'Checked {checked} local Markdown links in {len(FILES)} files.')
if errors:
    print('\n'.join(errors))
    sys.exit(1)
print('Documentation links and anchors passed.')
