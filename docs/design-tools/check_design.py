#!/usr/bin/env python3
"""Check Markdown, local assets, source links and PDF parity. No application tests."""
from pathlib import Path
import re, json, hashlib, subprocess, argparse, html, xml.etree.ElementTree as ET
from pypdf import PdfReader
import pdfplumber
from PIL import Image, ImageChops
p=argparse.ArgumentParser();p.add_argument('--root',type=Path);p.add_argument('--source-repo',type=Path,required=True);a=p.parse_args()
r=a.root or Path(__file__).resolve().parents[2];s=(r/'Design-Documentation.md').read_text();m=json.loads((r/'output/pdf/build-manifest.json').read_text());errors=[]
def check(ok,msg):
 if not ok:errors.append(msg)
specs=json.loads((r/'docs/design-tools/figure-manifest.json').read_text());expected=specs['figures'];revision=re.search(r'Team 07 \| (Rev\.\d+\.\d+)',s)[1]
def norm(s):
 s=re.sub(r'!?\[([^\[\]\n]+)\]\([^)\n]+\)',r'\1',s);s=s.replace('**','').replace('`','')
 return re.sub(r'\s+','',html.unescape(s))
check(hashlib.sha256(s.encode()).hexdigest()==m['markdown_sha256'],'Markdown differs from build')
figures=re.findall(r'!\[([^]]+)\]\(([^)]+)\)',s);check([path for alt,path in figures]==[f['path'] for f in expected],'Figure manifest and Markdown differ')
check(m['revision']==revision==specs['revision'],'Revision mismatch')
for spec in expected:
 for path,digest in spec['sha256'].items():
  check((r/path).is_file() and hashlib.sha256((r/path).read_bytes()).hexdigest()==digest,'Stale/missing editable source or render: '+path)
links=re.findall(r'(?<!!)\[[^\[\]\n]+\]\(([^)\n]+)\)',s)
anchors={re.sub(r'[^\w\- ]','',x.lower()).replace(' ','-') for x in re.findall(r'^#+ (.+)$',s,re.M)}
source_count=0
for u in links:
 if u.startswith('#'):check(u[1:] in anchors,'Broken anchor '+u)
 elif u.startswith('assets/'):
  check((r/u).is_file(),'Missing local asset '+u)
  check((r/'output/pdf'/u).is_file(),'Missing PDF relative asset '+u)
 elif '/blob/' in u or '/tree/' in u:
  sha,path=re.split('/(?:blob|tree)/',u,1)[1].split('/',1)
  proc=subprocess.run(['git','-C',str(a.source_repo),'cat-file','-e',sha+':'+path],capture_output=True)
  check(proc.returncode==0,'Missing source '+u);source_count+=1
for alt,path in figures:
 ET.parse(r/path);stem=Path(path).stem
 check((r/path).read_bytes()==(r/'docs/diagram-review/svg'/Path(path).name).read_bytes(),'Canonical SVG differs '+path)
 im=Image.open(r/'assets/outloud-design'/(stem+'.png'));im.verify()
wiki=(r/'output/wiki/Design-Documentation.md').read_text();base='https://raw.githubusercontent.com/wiki/snuhcs-course/swpp-2026-project-team-07/'
check(wiki.replace('('+base+'assets/outloud-design/','(assets/outloud-design/')==s,'Wiki text differs')
for raw in re.findall(r'```json\n(.*?)\n```',s,re.S):json.loads(raw)
reader=PdfReader(r/'output/pdf/OutLoud_Design_Documentation.pdf');texts=[]
for i,page in enumerate(reader.pages,1):
 text=page.extract_text();text=text.replace('OutLoud - Design Documentation\n'+revision+'\n'+str(i)+'\n','');texts.append(text)
combined=norm('\n'.join(texts));missing=[]
for b in m['blocks']:
 if b['kind']=='image':continue
 vals=[c for row in b['rows'] for c in row] if b['kind']=='table' else [b['text']]
 for text in vals:
  if norm(text) not in combined:missing.append(text[:90])
check(not missing,'PDF text missing: '+repr(missing))
image_pages=[]
for i,page in enumerate(reader.pages,1):
 for im in page.images:image_pages.append((i,im.image.convert('RGB')))
check(len(image_pages)==len(expected),'PDF image count')
for (page_no,img),(alt,path) in zip(image_pages,figures):
 expected_image=Image.open(r/'assets/outloud-design'/(Path(path).stem+'.png')).convert('RGB')
 check(img.size==expected_image.size and ImageChops.difference(img,expected_image).getbbox() is None,'PDF image differs '+alt)
with pdfplumber.open(r/'output/pdf/OutLoud_Design_Documentation.pdf') as pdf:
 for i,page in enumerate(pdf.pages,1):
  check(all(20<=c['x0'] and c['x1']<=page.width-20 and 12<=c['top'] and c['bottom']<=page.height-12 for c in page.chars),'Text outside bounds page '+str(i))
  check(all('Arial' in c['fontname'] for c in page.chars),'Non-Arial text page '+str(i))
  check(all(im['x0']>=40 and im['x1']<=page.width-40 and im['top']>=40 and im['bottom']<=page.height-40 for im in page.images),'Image outside bounds page '+str(i))
  header=''.join(c['text'] for c in page.chars if c['top']<35)
  check('OutLoud - Design Documentation' in header and revision in header,'Missing header page '+str(i))
uris={str(an.get_object()['/A'].get('/URI')) for page in reader.pages for an in page.get('/Annots',[]) if an.get_object().get('/A',{}).get('/S')=='/URI'}
check({u for u in links if not u.startswith('#')}<=uris,'Missing PDF link target')
page_ids={(page.indirect_reference.idnum,page.indirect_reference.generation):i for i,page in enumerate(reader.pages)}
internal_destinations=[]
for page in reader.pages:
 for ref in page.get('/Annots',[]):
  ann=ref.get_object();action=ann.get('/A',{})
  dest=ann.get('/Dest',action.get('/D') if action.get('/S')=='/GoTo' else None)
  if dest is None:continue
  if isinstance(dest,str):
   dest=reader.named_destinations.get(dest)
   page_no=reader.get_destination_page_number(dest) if dest else None
  else:
   target=dest[0];page_no=page_ids.get((target.idnum,target.generation)) if hasattr(target,'idnum') else None
  check(page_no is not None,'Broken internal PDF destination')
  if page_no is not None:internal_destinations.append(page_no)
outline_pages={}
def collect_outlines(items):
 for item in items:
  if isinstance(item,list):collect_outlines(item)
  else:outline_pages[re.sub(r'[^\w\- ]','',item.title.lower()).replace(' ','-')]=reader.get_destination_page_number(item)
collect_outlines(reader.outline)
for link in (u for u in links if u.startswith('#')):
 check(link[1:] in outline_pages and outline_pages[link[1:]] in internal_destinations,'Missing PDF internal link '+link)

check((r/'output/pdf/OutLoud_Design_Documentation.pdf').read_bytes()==(r/'output/pdf/team7-iter1-design.pdf').read_bytes(),'Submission copy differs')
coverage=s.split('| Requirement |',1)[1].split('\n\n',1)[0]
for req in ['US-01','US-02','US-03','US-05','US-06','US-07','US-08','US-10','US-11','NFR-05']:
 check(req in coverage,'Missing mandatory coverage '+req)
check('## 8. Planned Design Beyond Iteration 1' in s and '## 9. References and Maintenance' in s,'Missing planned design / references')
check(not re.search(r'^#+ .*([Tt]esting [Oo]utcomes|[Ee]valuation [Oo]utcomes|[Tt]est [Rr]esults)',s,re.M),'Testing outcomes section restored')
for rel,digest in specs['retained_schema_baseline']['sha256'].items():
 check((r/rel).is_file() and hashlib.sha256((r/rel).read_bytes()).hexdigest()==digest,'Current-schema diagram altered '+rel)
result={'revision':revision,'markdown_primary_source':True,'pdf_pages':len(reader.pages),'figure_ids':[x['id'] for x in expected],'panels':len(expected),'source_link_occurrences_verified':source_count,'unique_source_links':len({u for u in links if '/blob/' in u or '/tree/' in u}),'json_examples':len(re.findall(r'```json',s)),'pdf_text_parity':'pass' if not missing else 'fail','pdf_images_match_canonical_renders':len(image_pages),'local_asset_paths':'checked','wiki_text_parity':'checked','svg_sha256':m['figure_sha256'],'font':'Arial','page_sizes':m['pages'],'internal_pdf_destinations_verified':len(internal_destinations),'requirements_covered':10,'submission_copy_identical':True,'current_schema_diagrams_unchanged':True,'errors':errors}
(r/'output/pdf/document-checks.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2));raise SystemExit(bool(errors))
