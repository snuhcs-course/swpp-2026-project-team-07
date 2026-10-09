"""Reflow three existing diagram designs into consecutive A4-width panels."""
from pathlib import Path
import html,json
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
R=Path(__file__).resolve().parents[2]
for n,f in [('Arial','Arial.ttf'),('Arial-Bold','Arial Bold.ttf')]:pdfmetrics.registerFont(TTFont(n,'/System/Library/Fonts/Supplemental/'+f))
class Panel:
 def __init__(self,title,h):
  self.h=h;self.a=[];self.text(6,18,title,14,True)
 def text(self,x,y,t,size=11,bold=False):
  self.a.append(f'<text x="{x}" y="{y}" font-family="Arial" font-size="{size}" font-weight="{"bold" if bold else "normal"}" fill="#111">{html.escape(t)}</text>')
 def wrap(self,t,w,size=11,bold=False):
  out=[]
  for para in t.split('\n'):
   line=''
   for word in para.split():
    test=(line+' '+word).strip()
    if line and pdfmetrics.stringWidth(test,'Arial-Bold' if bold else 'Arial',size)>w:out.append(line);line=word
    else:line=test
   out.append(line)
  return out
 def para(self,x,y,w,t,size=11,bold=False):
  lines=self.wrap(t,w,size,bold)
  for i,line in enumerate(lines):self.text(x,y+i*14,line,size,bold)
  return y+len(lines)*14
 def rect(self,x,y,w,h,dash=False):self.a.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="white" stroke="#555" stroke-width="0.8"'+(' stroke-dasharray="4 3"' if dash else '')+'/>')
 def box(self,x,y,w,title,body,h=None):
  ls=self.wrap(body,w-16);ht=h or 34+14*len(ls);self.rect(x,y,w,ht);self.text(x+8,y+17,title,11,True)
  self.a.append(f'<path d="M{x} {y+25}H{x+w}" fill="none" stroke="#777" stroke-width="0.6"/>')
  self.para(x+8,y+41,w-16,body)
  return ht
 def line(self,points,label='',lx=None,ly=None,dash=False,arrow=True):
  self.a.append('<polyline points="'+' '.join(f'{x},{y}' for x,y in points)+'" fill="none" stroke="#333" stroke-width="0.9"'+(' stroke-dasharray="4 3"' if dash else '')+(' marker-end="url(#arrow)"' if arrow else '')+'/>')
  if label:self.text(lx,ly,label)
 def note(self,x,y,w,t):
  ls=self.wrap(t,w-16);self.rect(x,y,w,len(ls)*14+16);self.para(x+8,y+19,w-16,t)

def save(name,panels):
 h=sum(p.h for p in panels);a=['<svg xmlns="http://www.w3.org/2000/svg" width="500" height="'+str(h)+'" viewBox="0 0 500 '+str(h)+'"><defs><marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8Z" fill="#333"/></marker></defs><rect width="500" height="'+str(h)+'" fill="white"/>'];off=0;crop=[]
 for p in panels:
  content=''.join(p.a)
  if 'Seq' in globals() and isinstance(p,Seq):
   for x in p.x:content=content.replace(f'{x},691',f'{x},{p.h-13}')
  a.append(f'<g transform="translate(0 {off})">'+content+'</g>');crop.append([off,off+p.h]);off+=p.h
 a.append('</svg>');s=''.join(a)
 for sub in ['svg','sources']:(R/f'docs/diagram-review/{sub}/{name}.svg').write_text(s)
 return crop
# Figure 6: same responsibilities, arranged as two consecutive views.
p=Panel('Figure 6. Frontend architecture - 1 of 2',618)
p.text(6,37,'Planned controller/layout design; dashed arrows are callbacks.')
p.box(105,51,290,'Expo Router','src/app: route parameters and screen mounting',62)
p.line([(250,113),(250,143)],'Mount feature hosts',263,133)
p.text(6,161,'Shared hosts / controllers own behavior and state',11,True)
p.box(6,173,238,'LibraryScreen / ViewerScreen','useLibraryController / useSetupController\nImport, history, confirmed PDF page.\nPlanned: slide selection and deletion.',112)
p.box(256,173,238,'RehearsalScreen','useRecordingController\nPermission, capture, checkpoints, durable save.',112)
p.box(6,297,238,'SavedAttemptScreen','useSavedReviewController\nOne player, seek, consent, analysis state.\nPlanned: key ideas, delivery, comparison.',112)
p.box(256,297,238,'FeedbackPanel','useFeedbackController\nGeneration, drafts, edits, evidence actions.\nPlanned: practiced-slide scope.',112)
p.line([(250,414),(250,445)],'Display model',263,435)
p.box(44,446,412,'layouts/contracts.ts','Display models and guarded callbacks; opaque native surfaces.\nNo raw services. Planned: selection, analysis and deletion states.',76)
p.line([(250,522),(250,551)],'Render model',263,542)
p.box(44,552,412,'Interchangeable views','activeLayout views and navigation shells (continued in panel 2).',62)
p.line([(44,582),(18,582),(18,421),(118,421),(118,409)],dash=True)
# Explain dashed edge outside busy chart in panel 2.
q=Panel('Figure 6. Frontend architecture - 2 of 2',620)
q.para(6,39,488,'User actions call the hosts through guarded callbacks (dashed return arrow in panel 1).')
q.box(6,70,488,'Layout selection and views','registry.ts + selection.ts: EXPO_PUBLIC_UI_LAYOUT selects once at launch.\nrefactor: Home / Practice; Overview / Slides / Transcript.\ncontract-test: development-only alternate arrangement.',90)
q.text(6,183,'Hosts own the shared integration layer',11,True)
q.box(45,205,449,'Recording / playback','recording/service.ts + stopCapture.ts; transcription/playback.ts.\nHosts own native recorder/player lifetimes.',76)
q.box(45,303,449,'Persistence + media recovery','recording/storage.ts; review caches; expo-sqlite + expo-file-system.\nPlanned: scope and deletion journal.',76)
q.box(45,401,449,'Backend clients','transcription/service.ts; transcription/client.ts + services/api.ts.\nREST operations. Planned: analysis, deletion and auth operations.',76)
q.line([(22,190),(22,439)],arrow=False)
for y in [243,341,439]:q.line([(22,y),(45,y)])
q.para(6,500,488,'Native surfaces: react-native-pdf confirms page changes; expo-audio supplies capture time and one review player.')
q.para(6,542,488,'A layout arranges views and calls supplied commands. It creates no recorder/player and never reads storage or calls APIs. Hosts retain player intent and description drafts across panel changes; native stage surfaces stay mounted during capture/playback.')
result={'figure-6-frontend':save('figure-6-frontend',[p,q])}
# Figure 3A: separate ownership/selection from independent generated runs.
p=Panel('Figure 3A. Proposed data extension - 1 of 2',570)
p.text(6,38,'Planned conceptual entities and fields; PK / FK / UQ shown.')
p.box(120,53,260,'Owner (proposed)','PK id; UQ (issuer, subject)\nMaps validated identity token.',76)
p.box(6,188,238,'Deck (existing + owner)','PK id; FK owner_id [new]\nUQ owner + hash + prep version',76)
p.box(256,188,238,'DeletionOperation (proposed)','PK id; FK owner_id\ntarget_type / target_uuid\nstate; file manifest; progress\nTarget UUID survives row deletion.',118)
p.line([(180,129),(180,151),(125,151),(125,188)],'1 to 0..*',47,166)
p.line([(320,129),(320,151),(375,151),(375,188)],'1 to 0..*',390,166)
p.box(6,322,238,'Attempt (existing)','PK id; FK deck_id\nTranscript and visits stay here.',76)
p.line([(125,264),(125,322)],'1 to 0..*',139,299)
p.box(256,350,238,'AttemptSelection (proposed)','PK/FK attempt_id (one per attempt)\nselected_slide_indexes: JSON\nsource_attempt_id: nullable FK\nFreeze original indexes; keep repeats.\nLegacy attempts may have no row.',132)
p.line([(125,398),(125,443),(256,443)])
p.text(151,421,'1 to 0..1')
p.line([(270,350),(270,335),(244,335)],dash=True)
p.text(265,327,'source attempt: 0..1')
p.para(6,506,488,'Selection records use original deck indexes. Repeated visits remain in Attempt JSON. Deletion blocks new work, removes dependent rows in order, then retries file cleanup from a durable manifest.')
q=Panel('Figure 3A. Proposed data extension - 2 of 2',451)
q.text(6,38,'Planned runs depend on the existing Attempt, independently.')
q.box(120,54,260,'Attempt (existing)','PK id; transcript and slide visits in JSON',62)
q.box(6,176,238,'SummaryRun (proposed)','PK id; FK attempt_id\ngeneration / state / transcript digest\nselection digest; provider / model\nprompt version; per-visit summaries\nWord evidence and failure state',132)
q.box(256,176,238,'DeliveryRun (proposed)','PK id; FK attempt_id\ngeneration / state / source digest\nrule version; metric availability\nRates, timed filler and pause events\nVisit IDs reference Attempt JSON',132)
q.line([(200,116),(200,141),(125,141),(125,176)],'1 to 0..*',50,156)
q.line([(300,116),(300,141),(375,141),(375,176)],'1 to 0..*',390,156)
q.para(6,338,488,'Runs retain independent state and source versions. A failed analysis never replaces the transcript.')
q.para(6,382,488,'Descriptions remain deck-scoped. Existing coaching snapshots need a practiced-scope projection (Section 8.3).')
result['figure-3a-planned-data']=save('figure-3a-planned-data',[p,q])
# Figure 8: UML-style sequence panels preserve order and conditional branches.
class Seq(Panel):
 def __init__(self,title,h):
  super().__init__(title,h);self.x=[48,180,312,444];self.y=97
  for x,t in zip(self.x,['Presenter','Controller /\nlocal journal','Authorized\nDjango API','Cleanup /\nmedia worker']):
   self.rect(x-47,34,94,42);self.para(x-40,50,80,t)
   self.line([(x,76),(x,h-13)],dash=True,arrow=False)
 def msg(self,a,b,t,response=False):
  y=self.y;xa,xb=self.x[a],self.x[b]
  if a==b:
   lines=self.wrap(t,450);self.rect(17,y-11,466,len(lines)*14+22);self.para(25,y+3,448,t);self.line([(xa,y+len(lines)*14+5),(xa+18,y+len(lines)*14+5),(xa+18,y+len(lines)*14+13),(xa,y+len(lines)*14+13)]);self.y+=len(lines)*14+31
  else:
   # Full-width message labels sit above lifeline arrows with a white backing.
   lines=self.wrap(t,474);self.a.append(f'<rect x="8" y="{y-11}" width="484" height="{len(lines)*14}" fill="white"/>');self.para(13,y,474,t)
   ay=y+(len(lines)-1)*14+10;self.line([(xa,ay),(xb,ay)],dash=response);self.y=ay+27
 def cond(self,t):
  self.rect(6,self.y-10,488,26);self.text(14,self.y+7,t,11,True);self.y+=35
 def notehere(self,t):
  lines=self.wrap(t,472);self.note(6,self.y-10,488,t);self.y+=len(lines)*14+24
p=Seq('Figure 8. Deletion and recovery - 1 of 3 (Planned)',704)
p.msg(0,1,'1. Delete attempt or deck.')
p.msg(1,0,'2. Explain scope: deck deletion includes its attempts and generated data.',True)
p.cond('alt Cancel')
p.msg(0,1,'3. Cancel; preserve all data.')
p.cond('else Confirm - the remaining panels follow this branch')
p.msg(0,1,'4. Confirm target.')
p.msg(1,1,'5. Journal intent, stop playback/upload, hide target.')
p.cond('alt Local-only target')
p.msg(1,1,'6. No server request is required; continue with local cleanup in panel 3.')
p.cond('else Server-backed and offline / unreachable')
p.msg(1,1,'7. Remove local copies; keep a pending-server tombstone.')
p.msg(1,0,'8. Local removal done; server deletion pending. Retry after reconnect.',True)
p.cond('else Server-backed and reachable: continue in panel 2')
p.h=p.y+5
q=Seq('Figure 8. Deletion and recovery - 2 of 3 (Planned)',704)
q.msg(1,2,'9. DELETE attempt/deck with authenticated identity.')
q.msg(2,2,'10. Check owner, lock target, mark deleting; persist DeletionOperation and file manifest.')
q.msg(2,3,'11. Admit cleanup after commit (asynchronous background task).')
q.msg(2,1,'12. Return operation ID and pending status.',True)
q.notehere('Block new child records, jobs and media reads. Workers check deletion before provider calls and final writes, discarding late output. Queue cancellation alone is insufficient.')
q.msg(3,3,'13. Reconcile reservations; remove dependent jobs, results and receipts.')
q.cond('alt Attempt target')
q.msg(3,3,'14. Remove attempt; preserve deck and reusable descriptions.')
q.cond('else Deck target')
q.msg(3,3,'15. Remove attempts, description dependencies, slides, then deck.')
q.notehere('Explicit dependency order resolves current PROTECT references. The current schema deletion policy does not silently change. Continue with file cleanup in panel 3.')
q.h=q.y+5
s=Seq('Figure 8. Deletion and recovery - 3 of 3 (Planned)',704)
s.msg(3,3,'16. Delete manifest files idempotently.')
s.cond('alt File or cleanup failure')
s.msg(3,3,'17. Retain remaining manifest and failure; schedule bounded retry.')
s.cond('else Server cleanup complete')
s.msg(3,3,'18. Mark server complete; keep minimal operation tombstone.')
s.cond('end - reconcile status and finish local cleanup')
s.msg(1,2,'19. Read operation status; retry pending request after reconnect.')
s.msg(2,1,'20. Pending / retryable / server complete.',True)
s.msg(1,1,'21. Purge local audio, results, checkpoints and unreferenced PDFs. Record cleanup progress; retry failed removals.')
s.msg(1,0,'22. Complete only when applicable local and server work is done.',True)
s.notehere('Other devices reconcile tombstones when online. Original files outside the app are untouched. Retention policy remains open.')
s.h=s.y+5
result['figure-8-deletion']=save('figure-8-deletion',[p,q,s])
(R/'docs/design-tools/a4-panels.json').write_text(json.dumps(result,indent=2))
print(result)
