#!/usr/bin/env python3
"""Derive PDF, browser preview and Wiki bundle from Design-Documentation.md.
The Markdown is authoritative. Browser-rendered diagrams are verified against figure-manifest.json.
Run: python docs/design-tools/build_design_pdf.py [--root PATH]
Requires ReportLab and pypdf; uses the approved browser PNGs for PDF embedding.
"""
from pathlib import Path
import argparse, hashlib, html, json, re, shutil
import xml.etree.ElementTree as ET
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.pagesizes import A4, A3, A2
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, NextPageTemplate,
 PageBreak, Paragraph, Spacer, Table, TableStyle, Image, Preformatted, KeepTogether)
from pypdf import PdfReader
from PIL import Image as PILImage

parser=argparse.ArgumentParser();parser.add_argument('--root',type=Path)
ROOT=parser.parse_args().root or Path(__file__).resolve().parents[2]
SRC=ROOT/'Design-Documentation.md';OUT=ROOT/'output/pdf';OUT.mkdir(parents=True,exist_ok=True)
TEXT=SRC.read_text();DIGEST=hashlib.sha256(SRC.read_bytes()).hexdigest()
REVISION=re.search(r'Team 07 \| (Rev\.\d+\.\d+)',TEXT)[1]
FIGURE_MANIFEST=json.loads((ROOT/'docs/design-tools/figure-manifest.json').read_text())
FIGURE_SPECS={f['id']:f for f in FIGURE_MANIFEST['figures']}
assert FIGURE_MANIFEST['revision']==REVISION
for spec in FIGURE_SPECS.values():
 for path,digest in spec['sha256'].items():
  assert (ROOT/path).is_file() and hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==digest, 'Stale or missing diagram: '+path
FONT=Path('/System/Library/Fonts/Supplemental')
for name,file in [('Arial','Arial.ttf'),('Arial-Bold','Arial Bold.ttf'),('Arial-Italic','Arial Italic.ttf'),('Arial-BoldItalic','Arial Bold Italic.ttf')]:
 pdfmetrics.registerFont(TTFont(name,str(FONT/file)))
pdfmetrics.registerFontFamily('Arial',normal='Arial',bold='Arial-Bold',italic='Arial-Italic',boldItalic='Arial-BoldItalic')
STYLES={
 'p':ParagraphStyle('p',fontName='Arial',fontSize=10.5,leading=14,spaceAfter=8),
 'h1':ParagraphStyle('h1',fontName='Arial-Bold',fontSize=21,leading=25,spaceAfter=12,keepWithNext=True),
 'h2':ParagraphStyle('h2',fontName='Arial-Bold',fontSize=15,leading=19,spaceBefore=5,spaceAfter=11,keepWithNext=True),
 'h3':ParagraphStyle('h3',fontName='Arial-Bold',fontSize=12,leading=16,spaceBefore=9,spaceAfter=7,keepWithNext=True),
 'caption':ParagraphStyle('caption',fontName='Arial',fontSize=10.5,leading=14,spaceBefore=7,spaceAfter=11,keepWithNext=True),
 'cell':ParagraphStyle('cell',fontName='Arial',fontSize=10,leading=13),
 'th':ParagraphStyle('th',fontName='Arial-Bold',fontSize=10,leading=13),
 'code':ParagraphStyle('code',fontName='Arial',fontSize=9.5,leading=12,spaceBefore=4,spaceAfter=9),
}
def anchor(t):return re.sub(r'[^\w\- ]','',t.lower()).replace(' ','-')
def inline(t,web=False):
 tokens=[]
 def hold(s):tokens.append(s);return f'ZZTOKEN{len(tokens)-1}ZZ'
 t=re.sub(r'`([^`]+)`',lambda m:hold(('<code>' if web else '')+html.escape(m[1])+('</code>' if web else '')),t)
 def link(m):
  target=html.escape(m[2],quote=True)
  return hold(f'<a href="{target}"'+('' if web else ' color="#111111"')+'>'+html.escape(m[1])+'</a>')
 t=re.sub(r'\[([^\[\]\n]+)\]\(([^)\n]+)\)',link,t)
 t=html.escape(t);t=re.sub(r'\*\*(.*?)\*\*',r'<b>\1</b>',t)
 for i,s in enumerate(tokens):t=t.replace(f'ZZTOKEN{i}ZZ',s)
 return t

def parse():
 rows=TEXT.splitlines();i=0;out=[]
 while i<len(rows):
  s=rows[i].strip()
  if not s:i+=1;continue
  if s.startswith('<!--'):i+=1;continue
  m=re.fullmatch(r'!\[([^]]+)\]\(([^)]+)\)',s)
  if m:out.append({'kind':'image','alt':m[1],'path':m[2]});i+=1;continue
  if s.startswith('```'):
   lang=s[3:];i+=1;block=[]
   while i<len(rows) and not rows[i].startswith('```'):block.append(rows[i]);i+=1
   out.append({'kind':'code','lang':lang,'text':'\n'.join(block)});i+=1;continue
  if s.startswith('#'):
   m=re.match(r'(#+) (.*)',s);out.append({'kind':'heading','level':len(m[1]),'text':m[2]});i+=1;continue
  if s.startswith('|'):
   table=[]
   while i<len(rows) and rows[i].strip().startswith('|'):
    cells=[c.strip() for c in rows[i].strip().strip('|').split('|')]
    if not all(re.fullmatch(r':?-+:?',c) for c in cells):table.append(cells)
    i+=1
   out.append({'kind':'table','rows':table});continue
  if s.startswith('- '):out.append({'kind':'list','text':s[2:]});i+=1;continue
  p=[]
  while i<len(rows) and rows[i].strip() and not rows[i].startswith(('#','|','```','- ','![')):
   p.append(rows[i].strip());i+=1
  out.append({'kind':'caption' if p[0].startswith('**Figure ') else 'paragraph','text':' '.join(p)})
 return out
BLOCKS=parse()
# Preserve original SVGs and their paired browser renders, including editable sources.
assets=ROOT/'assets/outloud-design';assets.mkdir(parents=True,exist_ok=True)
for p in (ROOT/'docs/diagram-review/svg').glob('*.svg'):shutil.copy2(p,assets/p.name)
for p in (ROOT/'docs/diagram-review/png').glob('*.png'):
 # Phase 1 browser captures may carry JPEG bytes under .png names.
 # Normalize exported copies to PNG without changing their decoded pixels.
 with PILImage.open(p) as capture:capture.save(assets/p.name,format='PNG')
shutil.copytree(ROOT/'docs/diagram-review/sources',assets/'sources',dirs_exist_ok=True)
figs=[b for b in BLOCKS if b['kind']=='image']
assert [b['path'] for b in figs]==[f['path'] for f in FIGURE_MANIFEST['figures']], 'Markdown/figure manifest mismatch'
for b in figs:
 assert (ROOT/b['path']).exists();ET.parse(ROOT/b['path'])

# Browser preview is a rendering of these same parsed Markdown blocks.
web=[]
for b in BLOCKS:
 k=b['kind']
 if k=='heading':web.append(f'<h{b["level"]} id="{anchor(b["text"])}">{inline(b["text"],True)}</h{b["level"]}>')
 elif k=='image':web.append(f'<a class="figure" href="{b["path"]}"><img src="{b["path"]}" alt="{html.escape(b["alt"])}"></a>')
 elif k=='table':web.append('<table>'+''.join('<tr>'+''.join(f'<{"th" if i==0 else "td"}>{inline(c,True)}</{"th" if i==0 else "td"}>' for c in r)+'</tr>' for i,r in enumerate(b['rows']))+'</table>')
 elif k=='code':web.append('<pre><code>'+html.escape(b['text'])+'</code></pre>')
 elif k=='list':web.append('<div class="toc-item">'+inline(b['text'],True)+'</div>')
 else:web.append('<p>'+inline(b['text'],True)+'</p>')
(ROOT/'Design-Documentation.html').write_text('''<!doctype html><html lang="en"><meta charset="utf-8"><title>OutLoud Design Documentation - {REVISION}</title><style>
body{font:16px/1.6 Arial,sans-serif;color:#111;max-width:880px;margin:36px auto;padding:0 24px;background:white}h1{font-size:28px}h2{font-size:23px;margin-top:36px}h3{font-size:19px}a{color:#111}table{border-collapse:collapse;width:100%;font-size:14px;margin:18px 0}th,td{text-align:left;vertical-align:top;border:1px solid #999;padding:8px}th{background:white}pre{white-space:pre-wrap;background:white;padding:14px;font-family:Arial}code{font-family:Arial}.figure{display:block;overflow:auto}.figure img{display:block;max-width:100%;height:auto}.toc-item{margin:3px 0} @media(max-width:650px){body{padding:0 14px}}
</style><main>'''.replace('{REVISION}',REVISION)+''.join(web)+'</main></html>')

# A Wiki-only derivative changes asset URLs, not prose. Unpublished assets stay local.
WIKI=ROOT/'output/wiki';WIKI.mkdir(parents=True,exist_ok=True)
wiki_base='https://raw.githubusercontent.com/wiki/snuhcs-course/swpp-2026-project-team-07/'
(WIKI/'Design-Documentation.md').write_text(TEXT.replace('(assets/outloud-design/','('+wiki_base+'assets/outloud-design/'))
shutil.copytree(assets,WIKI/'assets/outloud-design',dirs_exist_ok=True)
shutil.copytree(assets,OUT/'assets/outloud-design',dirs_exist_ok=True)

# Group at major sections/figures; paper changes preserve baseline diagram legibility.
groups=[];pending=[];current=[]
for b in BLOCKS:
 if b['kind']=='heading':
  if (b['level']==2 or b['text'].startswith('8.5 ')) and current:
   groups.append(current);current=[]
  pending.append(b);continue
 if b['kind']=='image':
  # Carry a short subsection introduction with its diagram.
  if len(current)>=2 and current[-2]['kind']=='heading' and current[-1]['kind']=='paragraph':
   pending=current[-2:]+pending;current=current[:-2]
  if current:groups.append(current);current=[]
  current=pending+[b];pending=[];continue
 current+=pending+[b];pending=[]
if current or pending:groups.append(current+pending)
# Keep the title, introduction and revision history on one continuous page.
if groups[0][0].get('level') == 1:
 groups[0] += groups.pop(1)
# Keep the short planned extensions and references in one continuous A4 section.
for i in range(len(groups)-1,0,-1):
 if not any(b['kind']=='image' for b in groups[i]+groups[i-1]):
  if groups[i][0].get('text','').startswith('9.'):
   groups[i-1]+=groups.pop(i)
PAPER={key:spec['paper'] for key,spec in FIGURE_SPECS.items()}
SIZES={'A4':A4,'A3':A3,'A2':A2}
page_manifest=[]
class Doc(BaseDocTemplate):
 def afterFlowable(self,f):
  if hasattr(f,'heading'):
   title,level=f.heading;a=anchor(title);self.canv.bookmarkPage(a)
   self.canv.addOutlineEntry(title,a,level=level,closed=False)
 def afterPage(self):page_manifest.append({'page':self.page,'paper':self.pageTemplate.id})
def page(c,d):
 c.saveState();w,h=d.pageTemplate.pagesize;c.setFont('Arial',8)
 c.drawString(44,h-26,'OutLoud - Design Documentation');c.drawRightString(w-44,h-26,REVISION)
 c.drawCentredString(w/2,23,str(d.page));c.restoreState()
def render(b,width):
 k=b['kind']
 if k=='heading':
  p=Paragraph('<a name="'+anchor(b['text'])+'"/>'+inline(b['text']),STYLES['h'+str(min(b['level'],3))]);p.heading=(b['text'],0 if b['level']<3 else 1);return [p]
 if k=='image':
  stem=Path(b['path']).stem;png=assets/(stem+'.png');im=Image(str(png));natural=ET.parse(ROOT/b['path']).getroot();nw=float(natural.get('width').replace('px',''));nh=float(natural.get('height').replace('px',''));factor=im.imageWidth/nw;maxheight=SIZES[PAPER[stem]][1]-420;scale=min(width/im.imageWidth,maxheight/im.imageHeight,.72/factor);im.drawWidth=im.imageWidth*scale;im.drawHeight=im.imageHeight*scale;im.hAlign='CENTER';im.keepWithNext=True
  b['pdf_scale']=scale;b['pdf_png']=str(png.relative_to(ROOT));return [im]
 if k=='code':return [Preformatted(b['text'],STYLES['code'])]
 if k=='table':
  rows=b['rows'];n=len(rows[0]);ratios=[.35,.65] if n==2 else [.23,.25,.52]
  if rows[0][0]=='API group':ratios=[.17,.47,.36]
  if rows[0][0]=='Proposed operation':ratios=[.40,.28,.32]
  if rows[0][0]=='Requirement':ratios=[.30,.19,.51]
  if rows[0][0]=='Version':ratios=[.16,.19,.65]
  if rows[0][0]=='Component':ratios=[.23,.37,.40]
  if rows[0][0]=='Layer':ratios=[.16,.40,.44]
  cells=[[Paragraph(inline(c),STYLES['th' if i==0 else 'cell']) for c in r] for i,r in enumerate(rows)]
  t=Table(cells,colWidths=[width*r for r in ratios],repeatRows=1,hAlign='LEFT');t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.white),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),6),('RIGHTPADDING',(0,0),(-1,-1),6),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5),('GRID',(0,0),(-1,-1),.4,colors.HexColor('#999999'))]));return [t,Spacer(1,10)]
 paragraph=Paragraph(('&#8226; ' if k=='list' else '')+inline(b['text']),STYLES['caption' if k=='caption' else 'p'])
 return [KeepTogether([paragraph])] if b['text'].startswith('**Status legend') else [paragraph]
story=[]
for index,g in enumerate(groups):
 fig=next((b for b in g if b['kind']=='image'),None);paper=PAPER[Path(fig['path']).stem] if fig else ('A3' if g[0].get('text','').startswith('4. Backend') else 'A4')
 if index:story.extend([NextPageTemplate(paper),PageBreak()])
 width=SIZES[paper][0]-88
 for b in g:story.extend(render(b,width))
doc=Doc(str(OUT/'OutLoud_Design_Documentation.pdf'),pagesize=A4,leftMargin=44,rightMargin=44,topMargin=48,bottomMargin=43,title='OutLoud Design Documentation - '+REVISION,author='Team 07')
for label,size in SIZES.items():
 w,h=size;doc.addPageTemplates(PageTemplate(id=label,pagesize=size,frames=[Frame(44,43,w-88,h-91,id=label+'-frame',leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)],onPage=page))
doc.build(story)
shutil.copy2(OUT/'OutLoud_Design_Documentation.pdf',OUT/'team7-iter1-design.pdf')
assert hashlib.sha256(SRC.read_bytes()).hexdigest()==DIGEST,'Build must not modify Markdown'
manifest={'revision':REVISION,'figure_manifest_sha256':hashlib.sha256((ROOT/'docs/design-tools/figure-manifest.json').read_bytes()).hexdigest(),'source':'Design-Documentation.md','markdown_sha256':DIGEST,'pages':page_manifest,'blocks':BLOCKS,'figure_sha256':{b['path']:hashlib.sha256((ROOT/b['path']).read_bytes()).hexdigest() for b in figs},'wiki_asset_base':wiki_base+'assets/outloud-design/','published':False}
(OUT/'build-manifest.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps({'pdf':str(OUT/'OutLoud_Design_Documentation.pdf'),'pages':len(PdfReader(OUT/'OutLoud_Design_Documentation.pdf').pages),'page_sizes':page_manifest,'markdown_sha256':DIGEST}))
