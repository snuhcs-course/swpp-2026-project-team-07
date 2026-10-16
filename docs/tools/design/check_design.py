#!/usr/bin/env python3
"""Validate the canonical design source and its generated local artifacts."""
from pathlib import Path
import argparse, hashlib, html, json, re, xml.etree.ElementTree as ET
from PIL import Image, ImageChops
from pypdf import PdfReader
import pdfplumber

parser = argparse.ArgumentParser()
parser.add_argument('--root', type=Path)
args = parser.parse_args()
root = args.root or Path(__file__).resolve().parents[3]
source_path = root / 'docs/product/design-documentation.md'
manifest_path = root / 'docs/tools/design/figure-manifest.json'
build_path = root / 'output/pdf/build-manifest.json'
pdf_path = root / 'output/pdf/OutLoud_Design_Documentation.pdf'
source = source_path.read_text(encoding='utf-8')
spec = json.loads(manifest_path.read_text(encoding='utf-8-sig'))
build = json.loads(build_path.read_text(encoding='utf-8'))
errors = []

def check(value, message):
    if not value:
        errors.append(message)

def normalize(value):
    value = re.sub(r'!?\[([^\[\]\n]+)\]\([^)\n]+\)', r'\1', value)
    value = value.replace('**', '').replace('`', '')
    return re.sub(r'\s+', '', html.unescape(value))

revision = re.search(r'Team 07 \| (Rev\.\d+\.\d+)', source)[1]
check(revision == spec['revision'] == build['revision'], 'revision mismatch')
check(hashlib.sha256(source_path.read_bytes()).hexdigest() == build['markdown_sha256'], 'source changed after build')
check(hashlib.sha256(manifest_path.read_bytes()).hexdigest() == build['figure_manifest_sha256'], 'figure manifest changed after build')

figures = re.findall(r'!\[([^]]+)\]\(([^)]+)\)', source)
check([path for _, path in figures] == [item['path'] for item in spec['figures']], 'source/figure manifest order mismatch')
for item in spec['figures']:
    for relative, expected in item['sha256'].items():
        path = root / relative
        check(path.is_file(), 'missing design asset: ' + relative)
        if path.is_file():
            check(hashlib.sha256(path.read_bytes()).hexdigest() == expected, 'asset hash mismatch: ' + relative)
    svg = source_path.parent / item['path']
    check(svg.is_file(), 'missing source-linked SVG: ' + item['path'])
    if svg.is_file():
        ET.parse(svg)
    png = root / 'docs/assets/design/png' / (item['id'] + '.png')
    check(png.is_file(), 'missing reviewed PNG: ' + str(png.relative_to(root)))
    if png.is_file():
        with Image.open(png) as image:
            image.verify()

wiki = (root / 'output/wiki/Design-Documentation.md').read_text(encoding='utf-8')
wiki_base = 'https://raw.githubusercontent.com/wiki/snuhcs-course/swpp-2026-project-team-07/assets/design/'
check(wiki.replace('(' + wiki_base, '(../assets/design/svg/') == source, 'Wiki design text differs from canonical source')
check((root / 'output/html/design-documentation.html').is_file(), 'HTML preview missing')

reader = PdfReader(pdf_path)
pdf_text = []
for page_number, page in enumerate(reader.pages, 1):
    text = page.extract_text().replace(
        'OutLoud - Design Documentation\n' + revision + '\n' + str(page_number) + '\n', ''
    )
    pdf_text.append(text)
combined = normalize('\n'.join(pdf_text))
missing = []
for block in build['blocks']:
    if block['kind'] == 'image':
        continue
    values = [cell for row in block['rows'] for cell in row] if block['kind'] == 'table' else [block['text']]
    for value in values:
        if normalize(value) not in combined:
            missing.append(value[:90])
check(not missing, 'PDF text missing: ' + repr(missing))

pdf_images = [(number, image.image.convert('RGB')) for number, page in enumerate(reader.pages, 1) for image in page.images]
panels = [panel for block in build['blocks'] if block['kind'] == 'image' for panel in block['pdf_panels']]
check(len(pdf_images) == len(panels), 'PDF image panel count mismatch')
for (_, actual), panel in zip(pdf_images, panels):
    expected = Image.open(root / panel['png']).convert('RGB')
    check(actual.size == expected.size and ImageChops.difference(actual, expected).getbbox() is None,
          'PDF diagram differs: ' + panel['png'])

with pdfplumber.open(pdf_path) as pdf:
    for page_number, page in enumerate(pdf.pages, 1):
        check(abs(page.width - 595.2756) < .02 and abs(page.height - 841.8898) < .02,
              'non-A4 page: ' + str(page_number))
        check(all(12 <= char['top'] and char['bottom'] <= page.height - 12 for char in page.chars),
              'text outside page bounds: ' + str(page_number))

result = {
    'revision': revision,
    'canonical_source': str(source_path.relative_to(root)),
    'pdf_pages': len(reader.pages),
    'uniform_a4': not any(message.startswith('non-A4') for message in errors),
    'pdf_text_parity': 'pass' if not missing else 'fail',
    'figure_ids': [item['id'] for item in spec['figures']],
    'diagram_panels_verified': len(panels),
    'manifest_hashes': 'checked',
    'wiki_mirror': 'local-unpublished',
    'errors': errors,
}
(root / 'output/pdf/document-checks.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps(result, indent=2))
raise SystemExit(bool(errors))
