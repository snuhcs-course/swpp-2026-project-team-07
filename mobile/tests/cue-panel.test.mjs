import assert from 'node:assert/strict';
import {test} from 'node:test';
import {registerHooks} from 'node:module';
import {resolve,load} from './helpers/cue-panel-loader.mjs';
registerHooks({resolve,load});
const {profileResponse,deckId}=await import('./helpers/slide-profile-fixtures.mjs');
const {parseProfileState}=await import('../src/features/presentations/slideProfiles');
const React=await import('react');
const {act,create}=await import('react-test-renderer');
const {CueGuidancePanel}=await import('../src/features/presentations/CueGuidancePanel');
const {ThemeProvider,useTheme}=await import('../src/design/theme');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const state=parseProfileState(profileResponse(),deckId,3);
const defaults={state,slide:0,error:null,busy:false,onRecover:()=>assert.fail('Navigation must not admit provider work'),canPlayback:true,slidePlaying:false,onPlaySlide:()=>{}};
const json=r=>JSON.stringify(r.toJSON());
const button=(r,label)=>r.root.findAllByType('pressable').find(b=>b.props.accessibilityLabel===label);
async function mounted(props,run){let r;try{await act(async()=>{r=create(React.createElement(CueGuidancePanel,{...defaults,...props}));});await run(r);}finally{if(r)await act(async()=>r.unmount());}}

test('permanent Cues panel displays both generated categories with selected-slide playback',async()=>{
  let played=0;
  await mounted({onPlaySlide:()=>played++},async r=>{
    assert.match(json(r),/Cues/);assert.match(json(r),/Must Cover/);assert.match(json(r),/Go Deeper/);
    assert.match(json(r),/Explain the change in measured growth/);assert.match(json(r),/Connect the result to a practical example/);
    assert.equal(r.root.findAllByProps({accessibilityRole:'tab'}).length,0);
    assert.equal(r.root.findAllByType('scroll').length,1);
    assert.doesNotMatch(json(r),/Measured growth|A suitable experiment/);
    await act(async()=>button(r,'Play slide 1 recording').props.onPress());assert.equal(played,1);
    await act(async()=>r.root.findAllByType('pressable').find(b=>b.props.accessibilityLabel==='Show cue evidence and details').props.onPress());
    assert.match(json(r),/Measured growth/);
  });
});

test('slide navigation resets details and scroll subtree, restores cached cues on revisits, and never regenerates',async()=>{
  await mounted({},async r=>{
    const first=r.root.findByType('scroll');
    await act(async()=>button(r,'Show cue evidence and details').props.onPress());
    assert.match(json(r),/Measured growth/);
    await act(async()=>r.update(React.createElement(CueGuidancePanel,{...defaults,slide:1})));
    assert.notEqual(r.root.findByType('scroll'),first);
    assert.match(json(r),/Recap the final result/);assert.match(json(r),/No additional suggestions/);
    assert.doesNotMatch(json(r),/Explain the change|Connect the result|Measured growth/);
    assert.ok(button(r,'Play slide 2 recording'));
    await act(async()=>r.update(React.createElement(CueGuidancePanel,defaults)));
    assert.match(json(r),/Explain the change/);assert.match(json(r),/Connect the result/);
    assert.doesNotMatch(json(r),/Measured growth/);
  });
});

test('Play switches to Pause and stays unavailable while recording or when saved audio is absent',async()=>{
  await mounted({slidePlaying:true},async r=>{
    assert.equal(button(r,'Pause slide 1 recording').props.disabled,false);
    for(const props of [{canPlayback:false},{onPlaySlide:undefined}]){
      await act(async()=>r.update(React.createElement(CueGuidancePanel,{...defaults,...props})));
      assert.equal(button(r,'Play slide 1 recording').props.disabled,true);
      assert.match(json(r),/Explain the change/);assert.match(json(r),/Connect the result/);
    }
  });
});

test('missing, outdated and failed cues show explicit status with user initiated recovery only',async()=>{
  const calls=[];
  await mounted({state:null,onRecover:a=>calls.push(a)},async r=>{
    assert.match(json(r),/unavailable offline/);assert.deepEqual(calls,[]);
    await act(async()=>r.update(React.createElement(CueGuidancePanel,{...defaults,state:{...state,stale:true},onRecover:a=>calls.push(a)})));
    assert.doesNotMatch(json(r),/Explain the change|Connect the result/);assert.match(json(r),/out of date/);
    await act(async()=>button(r,'Generate AI cues').props.onPress());assert.deepEqual(calls,['generate']);
    await act(async()=>r.update(React.createElement(CueGuidancePanel,{...defaults,state:{...state,state:'needs_confirmation',requires_confirmation:true,retry_available:true,descriptions:null},onRecover:a=>calls.push(a)})));
    await act(async()=>button(r,'Confirm AI cue retry').props.onPress());assert.deepEqual(calls,['generate','confirm']);
    await act(async()=>r.update(React.createElement(CueGuidancePanel,{...defaults,state:{...state,state:'failed',retry_available:true,descriptions:null},busy:true,onRecover:a=>calls.push(a)})));
    assert.equal(button(r,'Retry AI cues').props.disabled,true);assert.match(json(r),/Requesting AI cues/);
    await act(async()=>r.update(React.createElement(CueGuidancePanel,{...defaults,error:'Saved cues are retained offline',onRecover:a=>calls.push(a)})));
    assert.match(json(r),/Explain the change/);assert.match(json(r),/Saved cues are retained offline/);
    await act(async()=>button(r,'Refresh AI cues').props.onPress());assert.deepEqual(calls,['generate','confirm','refresh']);
  });
});

test('empty evidence, loading, playback and synchronization notices remain visible',async()=>{
  await mounted({slide:2,playbackNotice:'Audio failed · tap Play to retry',requirementsNotice:'Requirements sync pending'},async r=>{
    assert.match(json(r),/Not enough readable evidence/);assert.match(json(r),/Requirements sync pending/);assert.match(json(r),/Audio failed/);
    await act(async()=>r.update(React.createElement(CueGuidancePanel,{...defaults,state:{...state,state:'queued',descriptions:null}})));
    assert.match(json(r),/Preparing AI cues/);assert.doesNotMatch(json(r),/Explain the change/);
  });
});

test('theme changes and reopening retain actual cues without admitting generation',async()=>{
  function Toggle(){const theme=useTheme();return React.createElement('theme-toggle',{onPress:theme.toggle});}
  const tree=()=>React.createElement(ThemeProvider,null,React.createElement(Toggle),React.createElement(CueGuidancePanel,defaults));
  let r;
  try{
    await act(async()=>{r=create(tree());});
    const texts=()=>r.root.findAllByType('text').filter(t=>t.props.children==='Explain the change in measured growth');
    const dark=JSON.stringify(texts()[0].props.style);
    await act(async()=>r.root.findByType('theme-toggle').props.onPress());
    assert.notEqual(JSON.stringify(texts()[0].props.style),dark);
    assert.match(json(r),/Explain the change/);assert.match(json(r),/Connect the result/);
    await act(async()=>r.unmount());r=null;
    await act(async()=>{r=create(tree());});
    assert.match(json(r),/Explain the change/);assert.match(json(r),/Connect the result/);
  }finally{if(r)await act(async()=>r.unmount());}
});


test('long accepted cues remain complete and reachable in the shared scroll panel',async()=>{
  const raw=profileResponse();
  const essential='Explain how the measured change follows from the comparison and describe its limitations before drawing a conclusion about the practical effect shown on this slide';
  const optional='Connect this measured result with a practical decision and ask the audience which additional experiment would test the explanation most clearly under realistic conditions today';
  // Both exceed the former concise display length while remaining valid v5 cues.
  raw.descriptions.slides[0].must_cover[0].text=essential;
  raw.descriptions.slides[0].go_deeper[0].text=optional;
  await mounted({state:parseProfileState(raw,deckId,3)},async r=>{
    for(const content of [essential,optional]){
      const rendered=r.root.findAllByType('text').find(t=>t.props.children===content);
      assert.ok(rendered);assert.equal(rendered.props.numberOfLines,undefined);
    }
    assert.equal(r.root.findAllByType('scroll').length,1);
  });
});

// Layout regression: JSON membership alone previously passed while Go Deeper was offscreen.
test('both category labels stay above a shared scroll and actual cues start side by side',async()=>{
  const raw=profileResponse();raw.descriptions.slides[0].must_cover.push({...raw.descriptions.slides[0].must_cover[0],text:'Explain the assumptions behind the measurement'});
  await mounted({state:parseProfileState(raw,deckId,3)},async r=>{
    const scroll=r.root.findByType('scroll');
    const label=title=>r.root.findAllByType('text').find(t=>t.props.children===title);
    const must=label('Must Cover'),deeper=label('Go Deeper');
    assert.ok(must.parent===deeper.parent,'both labels share the same initial row');
    assert.equal(must.parent.props.style.flexDirection,'row');
    const ancestors=node=>{const result=[];for(let p=node.parent;p;p=p.parent)result.push(p);return result;};
    assert.ok(!ancestors(must).includes(scroll),'category labels stay visible while cues scroll');
    const cue=content=>r.root.findAllByType('text').find(t=>t.props.children===content);
    const first=cue('Explain the change in measured growth'),optional=cue('Connect the result to a practical example');
    const column=leaf=>ancestors(leaf).find(p=>p.props.style?.minWidth===0&&p.props.style?.flex===1);
    assert.ok(column(first));assert.ok(column(optional));assert.ok(column(first)!==column(optional));
    assert.ok(column(first).parent===column(optional).parent);assert.equal(column(first).parent.props.style.flexDirection,'row');
    assert.ok(ancestors(first).includes(scroll));assert.ok(ancestors(optional).includes(scroll));
    assert.equal(r.root.findAllByType('scroll').length,1);assert.equal(r.root.findAllByProps({accessibilityRole:'tab'}).length,0);
  });
});
