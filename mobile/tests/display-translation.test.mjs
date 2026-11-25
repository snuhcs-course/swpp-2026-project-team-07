import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {load,resolve} from './helpers/domain-loader.mjs';
registerHooks({resolve,load});
const {createTranslationCache,sourceLanguage,splitRequest}=await import('../src/features/localization/translationCache.ts');
const {isDisplayWording}=await import('../src/features/localization/displayWording.ts');
const {translatedV3,translatedQuestion,translatedAnswer,translatedProfile,displayProfileCues}=await import('../src/features/localization/generatedProse.ts');
const request={kind:'legacy_qa',resource_id:'archived-run',language:'ko',fields:{'questions.0.question':'Why are there two groups?'}};
const reply=(r,id='b',state='completed')=>Response.json({id:id.repeat(64),language:r.language,state,translations:state==='completed'?Object.fromEntries(Object.keys(r.fields).map(k=>[k,'번역문'])):{}});
const disk=new Map();
const storage={api:'https://test.invalid/api',read:key=>disk.get(key),write:(key,v)=>disk.set(key,structuredClone(v)),wait:async()=>{}};
test('cue display separates pending and unavailable wording from actual cues by category', () => {
  const cue = text => ({ text, evidence_refs: [] });
  const profile = {
    slide_index: 4,
    must_cover: [cue('A ready cue'), cue('Waiting for English cues')],
    go_deeper: [cue('This cue is unavailable in English.')],
  };
  const pending = 'slides.4.must_cover.1.text';
  const unavailable = 'slides.4.go_deeper.0.text';
  const result = displayProfileCues(profile, new Set([pending, unavailable]), new Set([unavailable]));
  assert.deepEqual(result.must_cover, [cue('A ready cue')]);
  assert.deepEqual(result.go_deeper, []);
  assert.deepEqual(result.wording, { must_cover: 'pending', go_deeper: 'unavailable' });
  assert.equal(profile.must_cover.length, 2);
});

test('a cache miss makes a translation-only POST then read-only GET; overlapping readers and offline restarts reuse the result',async()=>{
 const calls=[];let release;
 const cache=createTranslationCache({...storage,fetch:(url,init)=>{calls.push([url,init.method]);return init.method==='POST'?new Promise(done=>{release=()=>done(reply(request,'b','pending'));}):Promise.resolve(reply(request));}});
 const first=cache.load(request,false);const duplicate=cache.load(request,false);
 assert.equal(calls.length,1);release();await Promise.all([first,duplicate]);
 assert.deepEqual(calls,[[storage.api+'/localization/','POST'],[storage.api+'/localization/'+'b'.repeat(64)+'/','GET']]);
 const offline=createTranslationCache({...storage,fetch:()=>assert.fail('offline cache invoked the network')});
 assert.equal(offline.get(request,'questions.0.question',request.fields['questions.0.question']),'번역문');
 await offline.load(request,false);
 assert.equal(offline.get({...request,language:'en'},'questions.0.question',request.fields['questions.0.question']),null);
});
test('first-use translation only aliases fields identified in a supported source language',async()=>{
 const fields={'questions.2.topic':'Carbon cycle','questions.2.question':'Comment circule le carbone ?', 'questions.2.role':'研究者','questions.2.panelist':'Robin'};
 const r={...request,resource_id:'different-source-languages',fields};
 const cache=createTranslationCache({...storage,fetch:async()=>Response.json({id:'4'.repeat(64),language:'ko',state:'completed',
  translations:{'questions.2.topic':'탄소 순환','questions.2.question':'탄소는 어떻게 순환하나요?','questions.2.role':'연구자','questions.2.panelist':'Robin'},
  source_languages:{'questions.2.topic':'en','questions.2.question':'other','questions.2.role':'und','questions.2.panelist':'zxx'}})});
 await cache.load(r,false);
 const offline=createTranslationCache({...storage,fetch:()=>assert.fail('offline cache used network')});
 const english={...r,language:'en'};
 assert.equal(offline.get(english,'questions.2.topic',fields['questions.2.topic']),'Carbon cycle');
 assert.equal(offline.get(english,'questions.2.question',fields['questions.2.question']),null);
 assert.equal(offline.get(english,'questions.2.role',fields['questions.2.role']),null);
 assert.equal(offline.get(english,'questions.2.panelist',fields['questions.2.panelist']),'Robin');
});

test('upgrade repairs a German coaching sentence in the Korean cache while keeping usable wording offline', async () => {
 const resource={kind:'feedback',resource_id:'old-target-test',language:'ko'};
 const key=(path,source)=>JSON.stringify([path,source]);
 const disk=new Map();
 const storeKey='display-translation:v1:'+JSON.stringify([storage.api,JSON.stringify(['feedback',resource.resource_id,'','ko'])]);
 const source='Explain the comparison after “비교 결과”.', bad='Erklären Sie den Vergleich nach “비교 결과”.';
 const good='기준값을 설명하세요.';
 disk.set(storeKey,{[key('slide.action',source)]:bad,[key('slide.why','Explain the baseline.')]:good,
   [key('questions.0.panelist','Robin Park')]:'Robin Park',[key('questions.0.topic','CO₂')]:'CO₂',
   [key('slide.quote','“Each seat counts.”')]:'“Each seat counts.”'});
 const calls=[];
 const cache=createTranslationCache({...storage,read:k=>structuredClone(disk.get(k)),write:(k,v)=>disk.set(k,structuredClone(v)),
  fetch:async(url,init)=>{const payload=JSON.parse(init.body);calls.push([url,payload.fields]);
    return Response.json({id:'8'.repeat(64),language:'ko',state:'completed',translations:{'slide.action':'“비교 결과” 다음에 비교 기준을 설명하세요.'},
      source_languages:{'slide.action':'en'}});}});
 assert.equal(cache.get(resource,'slide.action',source),null);
 assert.equal(cache.get(resource,'slide.why','Explain the baseline.'),good);
 assert.equal(cache.get(resource,'questions.0.panelist','Robin Park'),'Robin Park');
 assert.equal(cache.get(resource,'questions.0.topic','CO₂'),'CO₂');
 assert.equal(cache.get(resource,'slide.quote','“Each seat counts.”'),'“Each seat counts.”');
 await cache.load({...resource,fields:{'slide.action':source,'slide.why':'Explain the baseline.'}},false);
 assert.deepEqual(calls,[[storage.api+'/localization/',{'slide.action':source}]]);
 const offline=createTranslationCache({...storage,read:k=>disk.get(k),fetch:()=>assert.fail('cache reload contacted server')});
 assert.equal(offline.get(resource,'slide.action',source),'“비교 결과” 다음에 비교 기준을 설명하세요.');
 assert.equal(offline.get(resource,'slide.why','Explain the baseline.'),good);
});

test('display checks distinguish coaching from an exact quotation or suggested speaking line', () => {
 const en={kind:'feedback',resource_id:'assessment',language:'en'}, ko={...en,language:'ko'};
 const mixed='Sie sagen, dass der Wert in 서울 steigt.';
 assert.equal(isDisplayWording(ko,'slide.why',mixed,mixed),false);
 assert.equal(isDisplayWording(ko,'slide.why','Compare the alternatives.','다음을 확인하세요. So kann das Publikum die Ergebnisse vergleichen.'),false);
 assert.equal(isDisplayWording(en,'slide.why','청중에게 수치를 설명하세요.',mixed),false);
 assert.equal(isDisplayWording(en,'slide.why','근거로 “das Publikum”을 인용하세요.','Explain the evidence using “das Publikum”.'),true);
 assert.equal(isDisplayWording(ko,'slide.action','Try saying: Each seat counts.','이렇게 말해 보세요: Each seat counts.'),true);
 assert.equal(isDisplayWording(ko,'slide.action','Try saying: Each seat counts.','Sagen Sie stattdessen: Each seat counts.'),false);
 assert.equal(isDisplayWording(ko,'slide.quote',"'Don't forget the comparison.'","'Don't forget the comparison.'"),true);
 assert.equal(isDisplayWording({...ko,kind:'questions'},'questions.0.question','“Why are there two groups?”','“Why are there two groups?”'),false);
 assert.equal(isDisplayWording(ko,'slide.why','지원자 수를 비교하세요.','Compare the groups after “지원자 수”.'),false);
});

test('an invalid completed response cannot partially populate either display language', async () => {
 const fields={'slide.action':'Explain the counts.','slide.why':'Let the audience compare the results.'};
 const r={...request,kind:'feedback',resource_id:'wrong-live-target',fields};
 const cache=createTranslationCache({...storage,read:()=>null,write:()=>assert.fail('invalid reply persisted'),fetch:async()=>Response.json({
   id:'9'.repeat(64),language:'ko',state:'completed',source_languages:{'slide.action':'en','slide.why':'en'},
   translations:{'slide.action':'집계 방식을 설명하세요.','slide.why':'So kann das Publikum die Ergebnisse vergleichen.'}})});
 await cache.load(r,false);
 for(const [path,value] of Object.entries(fields)){
  assert.equal(cache.get(r,path,value),null);
  assert.equal(cache.get({...r,language:'en'},path,value),null);
  assert.equal(cache.failed(r,path,value),true);
 }
});

test('cached coaching retains explicit morning and evening times outside protected speech', () => {
 const ko={kind:'feedback',resource_id:'clock-advice',language:'ko'}, en={...ko,language:'en'};
 const source='Compare the 7 and 8 p.m. counts. Try saying: “Meet at 8 p.m.”';
 assert.equal(isDisplayWording(ko,'slide.action',source,'7시와 8시 인원수를 비교하세요. 이렇게 말해 보세요: “Meet at 8 p.m.”'),false);
 for (const pair of ['오후 7시와 8시','저녁 7시 및 8시','19시와 20시']) {
  assert.equal(isDisplayWording(ko,'slide.action',source,pair+' 인원수를 비교하세요. 이렇게 말해 보세요: “Meet at 8 p.m.”'),true,pair);
 }
 const both='Compare 8 a.m. with 9 p.m.';
 assert.equal(isDisplayWording(ko,'slide.action',both,'오후 8시와 오전 9시를 비교하세요.'),false);
 assert.equal(isDisplayWording(ko,'slide.action',both,'오전 8시와 오후 9시를 비교하세요.'),true);
 assert.equal(isDisplayWording(ko,'slide.action','Meet at 12 p.m.','오전 12시에 모이세요.'),false);
 assert.equal(isDisplayWording(ko,'slide.action','Meet at 1 a.m.','밤 1시에 모이세요.'),true);
 assert.equal(isDisplayWording(ko,'slide.action','Meet at 8:30 p.m.','오후 8시 30분에 모이세요.'),true);
 assert.equal(isDisplayWording(ko,'slide.action','Meet at 8:30 p.m.','오후 8시 15분에 모이세요.'),false);
 assert.equal(isDisplayWording(en,'slide.action','오후 7시와 8시를 비교하세요.','Compare the 7 and 8 counts.'),false);
 assert.equal(isDisplayWording(en,'slide.action','오후 7시와 8시를 비교하세요.','Compare the 7 and 8 p.m. counts.'),true);
 assert.equal(isDisplayWording(ko,'slide.why','Keep the quote “Meet at 8 p.m.”.','“Meet at 8 p.m.”라는 인용문을 유지하세요.'),true);
});

test('late old content cannot replace a newer translation and failed requests require an explicit retry',async()=>{
 const key='questions.1.question', old={...request,fields:{[key]:'First source'}}, fresh={...request,fields:{[key]:'Revised source'}};
 let calls=0, releaseOld;
 const cache=createTranslationCache({...storage,fetch:async(_url,init)=>{
  const payload=JSON.parse(init.body);calls++;
  if(payload.fields[key]==='First source')return new Promise(done=>{releaseOld=()=>done(Response.json({id:'a'.repeat(64),language:'ko',state:'completed',translations:{[key]:'이전 버전'}}));});
  return reply(payload,'c',payload.retry?'completed':'failed');
 }});
 const oldJob=cache.load(old,false);await cache.load(fresh,false);await cache.load(fresh,false);
 assert.equal(calls,2);assert.equal(cache.failed(fresh,key,'Revised source'),true);
 await cache.load(fresh,true);releaseOld();await oldJob;
 assert.equal(cache.get(old,key,'First source'),'이전 버전');assert.equal(cache.get(fresh,key,'Revised source'),'번역문');
});
test('projects only generated coaching and Q&A, keeping examples, evidence chronology, transcripts, names and identities exact',()=>{
 const fields={}, t=(k,v)=>{fields[k]=v;return '번역 '+v;};
 const e={kind:'speech',id:'s1.1',slide_index:0,start_ms:120,end_ms:750,text:'The original quotation.'};
 const slide={slide_index:0,status:'scored',reason:'title_slide_profile',score:71,criteria:[],must_cover:[{point:'Explain the comparison',status:'covered',evidence:[e]}],strength:{text:'Strong opening',evidence:[e]},improvements:[{criterion:'clarity',problem:'Unclear order',action:'State the reason',example:'First, we split the two groups.',gain_slide_points:4,evidence:[e]}]};
 const translated=translatedV3(slide,t,'slides.0');
 assert.equal(translated.score,71);assert.equal(translated.reason,slide.reason);assert.deepEqual(translated.improvements[0].evidence,[e]);
 assert.equal(translated.improvements[0].example,slide.improvements[0].example);assert.match(translated.improvements[0].action,/^번역/);
 assert.ok(!Object.values(fields).includes(e.text));assert.ok(!Object.values(fields).includes(slide.improvements[0].example));
 assert.ok(!Object.values(fields).includes(slide.reason));
 const q={id:'stable-q',panelist:'P1',slide_index:0,role:'Researcher',topic:'Assumptions',question:'Why this sample?',follow_up:'What next?'};
 const dq=translatedQuestion(q,t,0);assert.equal(dq.id,q.id);assert.equal(dq.panelist,q.panelist);assert.equal(dq.follow_up,'번역 '+q.follow_up);
 assert.ok(!Object.hasOwn(fields,'questions.0.panelist'));
 const role=translatedQuestion({...q,panelist:'City resident'},(k,v)=>k.endsWith('.panelist')?'도시 주민':v,0);
 assert.equal(role.panelist,'도시 주민');assert.equal(role.id,q.id);
 const a={transcript:{text:'Original answer',words:[]},verdict:'answered',did:'You compared both groups.',evidence:'Your evidence supported the answer.',clarify:'Add a detail.',duration_ms:11000};
 const da=translatedAnswer(a,t,0,1);assert.equal(da.transcript,a.transcript);assert.equal(da.verdict,a.verdict);assert.equal(da.clarify,'번역 '+a.clarify);
 const cue=translatedProfile({slide_index:0,must_cover:[{text:'Cover the baseline',supporting_detail:'Mention the control',evidence_refs:['summary']}],go_deeper:[{text:'Add context',information_needed:'When did it begin?',evidence_refs:[{quote:'Source fact'}]}]},t);
 assert.deepEqual(cue.go_deeper[0].evidence_refs,[{quote:'Source fact'}]);assert.match(cue.must_cover[0].supporting_detail,/^번역/);
 assert.equal(sourceLanguage('¿Cuál es el propósito?'),null);assert.equal(sourceLanguage('結果を説明してください。'),null);
 for(const text of ['Support 민수 during rehearsal', 'Que compare ce graphique ?', '시장 y crecimiento de ventas', '시장 日本語の説明', 'AI와 PDF의 차이는 무엇인가요?'])assert.equal(sourceLanguage(text),null,text);
 assert.equal(sourceLanguage('Compare the outcomes for “서울”.'),'en');
 assert.equal(sourceLanguage('서울에서 어떤 결과가 나왔나요?'),'ko');
 const many=Object.fromEntries(Array.from({length:100},(_,i)=>['questions.'+i+'.question','a'.repeat(420)]));
 assert.ok(splitRequest(request,many).every(batch=>Object.keys(batch.fields).length<=32&&Object.values(batch.fields).join('').length<=12000));
});
