import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {resolve,load} from './helpers/qa-screen-loader.mjs';registerHooks({resolve,load});
const React=await import('react');const {act,create}=await import('react-test-renderer');
const {QAScreen}=await import('../src/screens/QAScreen.tsx');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const question=i=>({id:String(i).padStart(32,'a'),panelist:'Audience',role:'Student',slide_index:0,topic:'Topic',question:'Question '+i,follow_up:'Follow '+i});
function setup(count,state='completed'){
 globalThis.qaScreenRoutes=[];globalThis.qaScreenModel={transcribed:true,transcripts:new Map(),stages:new Map(),deck:{id:'screen-'+count,hue:'blue',pages:[],slides:[]},state:{run:{id:'run-'+count,parts:[]}}};
 globalThis.qaScreenValue={requirements:{audience:'General audience',requiredDurationSeconds:300},requirementsDirty:false,state:{state,stale:false,attempt_id:'take',requirements:{audience:'General audience'},result:state==='completed'?{job_id:count,stale:false,questions:Array.from({length:count},(_,i)=>question(i+1))}:null},notice:'',busy:false,generate:()=>{throw new Error('Navigation must not generate')},refresh:()=>{}};
 // The actual token name comes from the app constants.
}
const text=r=>JSON.stringify(r.toJSON());
test('one/two/three ready questions navigate and stop at actual last question',async()=>{
 for(const count of [1,2,3]){
  setup(count);let r;
  try{await act(async()=>{r=create(React.createElement(QAScreen));});
   for(let i=0;i<count;i++){
    assert.match(text(r),new RegExp('Question '+(i+1)+' of '+count));
    const pan=r.root.findByType('pan');
    await act(async()=>{pan.props.onMoveShould({nativeEvent:{pageY:200}},{dx:-100,dy:0});pan.props.onMove({}, {dx:-100,dy:0});pan.props.onRelease();});
   }
   assert.match(text(r),new RegExp('Question '+count+' of '+count));
   assert.match(text(r),/Last question/);
  }finally{if(r)await act(async()=>r.unmount());}
 }
});
test('pending Q&A does not advertise next navigation or recording',async()=>{
 setup(3,'submitted');let r;try{await act(async()=>{r=create(React.createElement(QAScreen));});
 assert.match(text(r),/being prepared/);assert.doesNotMatch(text(r),/"text":"Next"/);
 assert.equal(r.root.findByType('record-button').props.disabled,true);
 }finally{if(r)await act(async()=>r.unmount());}
});

test('pending to complete batch becomes navigable without leaving or regenerating',async()=>{
 setup(3,'submitted');let r;
 try{
  await act(async()=>{r=create(React.createElement(QAScreen));});
  const model=globalThis.qaScreenModel;setup(3);globalThis.qaScreenModel=model;
  await act(async()=>r.update(React.createElement(QAScreen)));
  assert.match(text(r),/Question 1 of 3/);
  for(let i=0;i<2;i++)await act(async()=>{const pan=r.root.findByType('pan');pan.props.onMoveShould({nativeEvent:{pageY:200}},{dx:-100,dy:0});pan.props.onMove({}, {dx:-100,dy:0});pan.props.onRelease();});
  assert.match(text(r),/Question 3 of 3/);assert.match(text(r),/Last question/);
  await act(async()=>{const pan=r.root.findByType('pan');pan.props.onMoveShould({nativeEvent:{pageY:200}},{dx:100,dy:0});pan.props.onMove({}, {dx:100,dy:0});pan.props.onRelease();});
  assert.match(text(r),/Question 2 of 3/);
 }finally{if(r)await act(async()=>r.unmount());}
});

const action=(r,label)=>r.root.findAllByType('pressable').find(n=>n.props.accessibilityLabel===label);
test('failed Q&A read keeps the saved audience visible without falsely requiring audience entry',async()=>{
 setup(0,'absent');globalThis.qaScreenValue.state=null;globalThis.qaScreenValue.requirements.audience='Synthetic saved audience';globalThis.qaScreenValue.notice='Q&A could not read the selected run.';let reads=0;globalThis.qaScreenValue.refresh=()=>{reads++;};let r;
 try{await act(async()=>{r=create(React.createElement(QAScreen));});assert.match(text(r),/Synthetic saved audience/);assert.doesNotMatch(text(r),/Audience not set|audience is missing/);assert.equal(!!action(r,'Edit presentation time and audience'),false);const refresh=action(r,'Refresh audience questions status');assert.ok(refresh);await act(async()=>refresh.props.onPress());assert.equal(reads,1);assert.equal(globalThis.qaScreenRoutes.length,0);}finally{if(r)await act(async()=>r.unmount());}
});
test('unfinished selected sources show recording recovery and open the first unready slide without generating',async()=>{
 setup(0,'absent');const model=globalThis.qaScreenModel;model.transcribed=false;model.state.run.parts=[{attemptId:'ready'},null,{attemptId:'waiting'},{attemptId:'ready'}];model.transcripts.set('ready',{});model.stages.set('waiting','processing');globalThis.qaScreenValue.state=null;globalThis.qaScreenValue.notice='Offline or unavailable. Saved Q&A is retained.';let r;
 try{await act(async()=>{r=create(React.createElement(QAScreen));});assert.match(text(r),/upload|transcrib/i);assert.doesNotMatch(text(r),/Offline|Audience not set|audience is missing/);const review=action(r,'Review selected recordings');assert.ok(review);await act(async()=>review.props.onPress());assert.deepEqual(globalThis.qaScreenRoutes,[['review',{nav:null,deckId:model.deck.id,sel:2}]]);assert.ok(action(r,'Refresh audience questions status'));}finally{if(r)await act(async()=>r.unmount());}
});
test('question batch retains its historical audience when current presentation audience differs',async()=>{
 setup(1);globalThis.qaScreenValue.requirements.audience='Current presentation audience';globalThis.qaScreenValue.state.requirements.audience='Historical audience';let r;
 try{await act(async()=>{r=create(React.createElement(QAScreen));});assert.match(text(r),/Question 1 of 1.*Historical audience/);assert.doesNotMatch(text(r),/Current presentation audience/);}finally{if(r)await act(async()=>r.unmount());}
});
test('tapping the mounted Q&A Back hint returns to its selected Review without generating',async()=>{
 setup(3);let r;
 try{await act(async()=>{r=create(React.createElement(QAScreen));});const hint=r.root.findByType('hints').props.hints.find(h=>h.text==='Back');assert.equal(typeof hint?.onPress,'function');await act(async()=>hint.onPress());assert.deepEqual(globalThis.qaScreenRoutes,[['review',{nav:null,deckId:'screen-3',sel:0}]]);}finally{if(r)await act(async()=>r.unmount());}
});
