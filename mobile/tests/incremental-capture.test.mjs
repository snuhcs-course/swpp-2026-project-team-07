import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./helpers/incremental-loader.mjs', import.meta.url);
const { registerCapture, checkpointCapture, readCapture, syncCapture, refreshCapture, retryCapture, captureFeedback, parseCaptureStatus, manifestIdentity } = await import('../src/features/recording/incremental.ts');
const { saveAttempt, getSavedAttempt } = await import('../src/features/recording/storage.ts');
const { writeStored } = await import('../src/services/storage.ts');
const api='https://server.example/api';
let serial=0;
const segment=(sequence,slide,start,end)=>({sequence,slide_index:slide,start_ms:start,end_ms:end,uri:`file:///s${sequence}.wav`});
const manifest=(segments=[],stopped=false)=>({manifest_uri:'file:///manifest.json',full_uri:'file:///full.wav',duration_ms:segments.at(-1)?.end_ms??0,
 slide_events:[{slide_index:0,at_ms:0}],segments,stopped,isRecording:!stopped,metering:-20,current_slide:0});
function setup(m){const id=`take-${++serial}`;saveAttempt({id,local_deck_id:'local',title:'Test',pdf_uri:'file:///slides.pdf',page_count:3,created_at:'',state:'capturing',recording:{id,audience:'',audio_uri:m.full_uri,duration_ms:m.duration_ms,slide_events:m.slide_events}});registerCapture(id,api,m);writeStored(`capture-outbox:v1:${id}`,{...readCapture(id),deckId:'deck',contextId:null});return id;}
function status(id){return {attempt_id:id,revision:1,stopped:false,finalized:false,audio_uploaded:false,segments:[]};}
const ok=value=>({ok:true,json:async()=>value});
test('declares expected segments before upload; revisits retain distinct sequence and speaking order',async()=>{
 const m=manifest([segment(0,0,0,1000),segment(1,2,1000,2000),segment(2,0,2000,3000)]);
 m.slide_events=[{slide_index:0,at_ms:0},{slide_index:2,at_ms:1000},{slide_index:0,at_ms:2000},{slide_index:1,at_ms:3000}];
 const id=setup(m),calls=[];
 await syncCapture(id,async(url,opts)=>{calls.push([url,opts]);return ok(status(id))});
 assert.deepEqual(calls.map(c=>c[0].split(id)[1]),['/capture/','/segments/0/','/segments/1/','/segments/2/','/capture/']);
 assert.deepEqual(JSON.parse(calls[0][1].body).segments.map(s=>s.slide_index),[0,2,0]);
 assert.deepEqual(readCapture(id).uploaded,[0,1,2]);
 assert.equal(readCapture(id).manifest.stopped,false);
});
test('upload failure retains audio and checkpoints; later retry uses the same segment identity',async()=>{
 const id=setup(manifest([segment(0,0,0,1000)])),urls=[];
 await syncCapture(id,async(url)=>{urls.push(url);if(url.includes('/segments/'))throw Error('fetch failed: java.io.IOException at http://127.0.0.1:8000');return ok(status(id))});
 assert.deepEqual(readCapture(id).uploaded,[]);assert.match(readCapture(id).error,/Connection interrupted/);
 assert.doesNotMatch(readCapture(id).error,/java.io|127.0.0.1/);
 const next=manifest([segment(0,0,0,1000),segment(1,1,1000,2200)]);checkpointCapture(id,next);
 assert.equal(readCapture(id).manifest.segments.length,2);
 writeStored(`capture-outbox:v1:${id}`,{...readCapture(id),retryAt:0});
 await syncCapture(id,async(url)=>{urls.push(url);return ok(status(id))});
 assert.equal(urls.filter(url=>url.endsWith('/segments/0/')).length,2);
 assert.deepEqual(readCapture(id).uploaded,[0,1]);assert.equal(readCapture(id).manifest.full_uri,'file:///full.wav');
});
test('transition during an in-flight upload is declared and uploaded without overwriting its checkpoint',async()=>{
 const id=setup(manifest([segment(0,0,0,1000)]));let complete;const gate=new Promise(r=>complete=r),urls=[];
 const pending=syncCapture(id,async(url)=>{urls.push(url);if(url.endsWith('/segments/0/'))await gate;return ok(status(id))});
 await new Promise(r=>setTimeout(r,10));
 const next=manifest([segment(0,0,0,1000),segment(1,1,1000,2000)],true);checkpointCapture(id,next);complete();await pending;
 assert.equal(readCapture(id).manifest.stopped,true);assert.deepEqual(readCapture(id).uploaded,[0,1]);
 assert.equal(urls.filter(url=>url.endsWith('/capture/audio/')).length,1);
 assert.equal(urls.some(url=>url.endsWith('/process/')),false);
 assert.equal(urls.filter(url=>url.endsWith('/segments/0/')).length,1);
});
test('polling and clock ticks do not repeat successful uploads or final audio',async()=>{
 const m=manifest([segment(0,0,0,1000)],true),id=setup(m),urls=[];
 const transport=async(url)=>{urls.push(url);return ok(status(id))};
 await syncCapture(id,transport);await syncCapture(id,transport);
 assert.equal(urls.filter(u=>u.endsWith('/capture/audio/')).length,1);
 assert.equal(urls.filter(u=>u.endsWith('/segments/0/')).length,1);
 const active=manifest();assert.equal(manifestIdentity(active),manifestIdentity({...active,duration_ms:999}));
});
test('foreign capture responses and regressing native checkpoints cannot replace local recording',()=>{
 assert.throws(()=>parseCaptureStatus(status('foreign'),'take'));
 const id=setup(manifest([segment(0,0,0,1000)]));checkpointCapture(id,manifest());
 assert.equal(readCapture(id).manifest.duration_ms,1000);
});
test('feedback progress is refreshed while a later segment upload is blocked',async()=>{
 const m=manifest([segment(0,0,0,1000),segment(1,1,1000,2000)]),id=setup(m);
 writeStored(`capture-outbox:v1:${id}`,{...readCapture(id),declared:manifestIdentity(m),uploaded:[0]});
 let finish;const gate=new Promise(r=>finish=r);
 const pending=syncCapture(id,async url=>{if(url.endsWith('/segments/1/'))await gate;return ok(status(id));});
 await new Promise(r=>setTimeout(r,10));
 await refreshCapture(id,async()=>ok({...status(id),segments:[{sequence:0,status:'completed',retry_available:false,requires_confirmation:false}]}));
 assert.equal(readCapture(id).remote.segments[0].status,'completed');
 assert.equal(readCapture(id).manifest.stopped,false);
 assert.deepEqual(readCapture(id).uploaded,[0]);
 finish();await pending;
});
test('mismatched full audio remains visible and only explicit retry uploads it again',async()=>{
 const id=setup(manifest([segment(0,0,0,1000)],true));let sends=0, mismatch=true;
 globalThis.captureFetch=async url=>{if(url.endsWith('/capture/audio/'))sends++;return ok({...status(id),stopped:true,audio_uploaded:!mismatch,
  error:mismatch?{code:'audio_mismatch',message:'Upload the original full audio again.'}:null});};
 await syncCapture(id);assert.equal(sends,1);assert.equal(readCapture(id).audioUploaded,false);
 assert.match(readCapture(id).error,/original full audio/);
 await syncCapture(id);assert.equal(sends,1,'no automatic corrupt-file upload loop');
 mismatch=false;await retryCapture(id);assert.equal(sends,2);assert.equal(readCapture(id).audioUploaded,true);
});
test('final server reconciliation uses stopped manifest metadata after an interrupted local save',async()=>{
 const m=manifest([segment(0,0,0,1000),segment(1,1,1000,2300)],true),id=setup(m);
 m.slide_events.push({slide_index:1,at_ms:1000});checkpointCapture(id,m);
 const a=getSavedAttempt(id);saveAttempt({...a,state:'interrupted',recording:{...a.recording,duration_ms:700,slide_events:[{slide_index:0,at_ms:0}]}});
 await syncCapture(id,async()=>ok({...status(id),stopped:true,finalized:true,audio_uploaded:true,feedback:{status:'completed'}}));
 assert.equal(getSavedAttempt(id).recording.duration_ms,2300);
 assert.equal(getSavedAttempt(id).recording.slide_events.length,2);
 assert.equal(getSavedAttempt(id).state,'interrupted');
 assert.equal(readCapture(id).complete,true);
});
test('an offline revisit immediately makes old advice provisional and preserves unrelated slides',()=>{
 const m=manifest([segment(0,0,0,1000),segment(1,1,1000,2000)]),id=setup(m);
 writeStored(`capture-outbox:v1:${id}`,{...readCapture(id),remote:{...status(id),segments:[{sequence:0,status:'completed'},{sequence:1,status:'completed'}]}});
 const old={status:'running',slides:[{slide_index:0,status:'scored',score:80,level:'advanced',improvements:[{action:'Prior advice'}]},{slide_index:1,status:'scored',score:70}]};
 const visible=captureFeedback(readCapture(id),old);
 assert.equal(visible.slides[0].status,'pending');assert.equal(visible.slides[0].score,null);assert.equal(visible.slides[0].reason,'recording');
 assert.deepEqual(visible.slides[0].improvements,old.slides[0].improvements);
 assert.equal(visible.slides[1],old.slides[1]);assert.equal(old.slides[0].score,80,'cache is retained unchanged');
 checkpointCapture(id,manifest([...m.segments,segment(2,0,2000,3000)],true));
 assert.equal(captureFeedback(readCapture(id),old).slides[0].reason,'awaiting_segments');
});
test('successful refresh clears its own connection error and preserves a failed upload error',async()=>{
 const m=manifest([segment(0,0,0,1000)]),id=setup(m);
 writeStored(`capture-outbox:v1:${id}`,{...readCapture(id),declared:manifestIdentity(m),error:'Segment upload failed'});
 await refreshCapture(id,async()=>{throw Error('Temporary polling network error')});
 assert.match(readCapture(id).refreshError,/Temporary polling/);
 await refreshCapture(id,async()=>ok(status(id)));
 assert.equal(readCapture(id).refreshError,undefined);
 assert.equal(readCapture(id).error,'Segment upload failed');
});
test('revised feedback is received before completed segment state can expose an old score',async()=>{
 const m=manifest([segment(0,0,0,1000),segment(1,1,1000,2000),segment(2,0,2000,3000)],true),id=setup(m);
 const old={...status(id),segments:[{sequence:2,status:'transcribing',retry_available:false,requires_confirmation:false}]};
 writeStored(`capture-outbox:v1:${id}`,{...readCapture(id),declared:manifestIdentity(m),remote:old});
 const feedback={slides:[{slide_index:0,status:'pending',provisional:true}]};let received=false;
 globalThis.captureFeedbackReceived=(_api,attempt,_context,body)=>{
  assert.equal(attempt,id);assert.equal(body,feedback);
  assert.equal(readCapture(id).remote.segments[0].status,'transcribing');received=true;
 };
 try {
  await refreshCapture(id,async()=>ok({...status(id),segments:[{sequence:2,status:'completed',retry_available:false,requires_confirmation:false}],feedback}));
  assert.equal(received,true);assert.equal(readCapture(id).remote.segments[0].status,'completed');
 } finally { delete globalThis.captureFeedbackReceived; }
});
