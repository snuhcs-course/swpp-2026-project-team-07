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
const defaults={state,slide:0,error:null,busy:false,onRecover:()=>assert.fail('Navigation must not admit provider work')};
const json=r=>JSON.stringify(r.toJSON());
const button=(r,label)=>r.root.findAllByType('pressable').find(b=>b.props.accessibilityLabel===label);
async function mounted(props,run){let r;try{await act(async()=>{r=create(React.createElement(CueGuidancePanel,{...defaults,...props}));});await run(r);}finally{if(r)await act(async()=>r.unmount());}}

test('cue cards open complete category details without generating or replacing saved playback',async()=>{
  const opened=[];
  await mounted({onSheetOpenChange:value=>opened.push(value)},async r=>{
    assert.match(json(r),/CUES/);assert.match(json(r),/Must cover/);assert.match(json(r),/Further insight/);
    assert.match(json(r),/Explain the change in measured growth/);assert.match(json(r),/Connect the result to a practical example/);
    assert.equal(r.root.findAllByType('scroll').length,0);
    await act(async()=>button(r,'Open Must cover cues').props.onPress());
    assert.equal(r.root.findAllByType('scroll').length,1);assert.ok(r.root.findByType('scroll').findAllByType('text').some(n=>n.props.children==='Explain the change in measured growth'));
    await act(async()=>button(r,'Close cue sheet').props.onPress());
    assert.deepEqual(opened,[true,false]);assert.equal(r.root.findAllByType('scroll').length,0);
  });
});

test('slide navigation updates open details and revisits restore cached cues without regeneration',async()=>{
  await mounted({},async r=>{
    await act(async()=>button(r,'Open Must cover cues').props.onPress());
    assert.ok(r.root.findByType('scroll').findAllByType('text').some(n=>n.props.children==='Explain the change in measured growth'));
    await act(async()=>r.update(React.createElement(CueGuidancePanel,{...defaults,slide:1})));
    assert.match(json(r),/Recap the final result/);assert.match(json(r),/No additional suggestions/);
    assert.doesNotMatch(json(r),/Explain the change|Connect the result|Measured growth/);
    await act(async()=>button(r,'Close cue sheet').props.onPress());
    await act(async()=>r.update(React.createElement(CueGuidancePanel,defaults)));
    assert.match(json(r),/Explain the change/);assert.match(json(r),/Connect the result/);
    assert.doesNotMatch(json(r),/Measured growth/);
  });
});

test('opening and closing either category reports its modal state without requesting provider work',async()=>{
  const opened=[];
  await mounted({onSheetOpenChange:value=>opened.push(value)},async r=>{
    for(const category of ['Must cover','Further insight']){
      await act(async()=>button(r,'Open '+category+' cues').props.onPress());
      assert.equal(r.root.findAllByType('scroll').length,1);
      await act(async()=>button(r,'Close cue sheet').props.onPress());
    }
    assert.deepEqual(opened,[true,false,true,false]);
  });
});

test('missing, outdated and failed cues show explicit status with user initiated recovery only',async()=>{
  const calls=[];
  await mounted({state:null,onRecover:a=>calls.push(a)},async r=>{
    assert.match(json(r),/unavailable offline/);assert.deepEqual(calls,[]);
    await act(async()=>r.update(React.createElement(CueGuidancePanel,{...defaults,state:{...state,stale:true},onRecover:a=>calls.push(a)})));
    assert.doesNotMatch(json(r),/Explain the change|Connect the result/);assert.match(json(r),/out of date/);
    assert.equal(button(r,'Generate AI cues'),undefined);assert.match(json(r),/Status · Tap for detail/);
    await act(async()=>button(r,'Open Must cover cues').props.onPress());assert.deepEqual(calls,[]);
    const generate=button(r,'Generate AI cues');
    assert.ok(r.root.findByType('scroll').findAllByType('pressable').includes(generate));
    assert.equal(generate.props.style.minHeight,44);assert.equal(generate.props.style.position,undefined);
    const message=r.root.findByType('scroll').findAllByType('text').find(n=>typeof n.props.children==='string'&&n.props.children.includes('out of date'));
    assert.ok(message);assert.equal(message.props.numberOfLines,undefined);assert.notEqual(message.props.children,generate.props.accessibilityLabel);
    await act(async()=>generate.props.onPress());assert.deepEqual(calls,['generate']);
    await act(async()=>r.update(React.createElement(CueGuidancePanel,{...defaults,state:{...state,state:'needs_confirmation',requires_confirmation:true,retry_available:true,descriptions:null},onRecover:a=>calls.push(a)})));
    await act(async()=>button(r,'Confirm AI cue retry').props.onPress());assert.deepEqual(calls,['generate','confirm']);
    await act(async()=>r.update(React.createElement(CueGuidancePanel,{...defaults,state:{...state,state:'failed',retry_available:true,descriptions:null},busy:true,onRecover:a=>calls.push(a)})));
    assert.equal(button(r,'Retry AI cues').props.disabled,true);assert.match(json(r),/Requesting AI cues/);
    await act(async()=>r.update(React.createElement(CueGuidancePanel,{...defaults,error:'Saved cues are retained offline',onRecover:a=>calls.push(a)})));
    assert.match(json(r),/Explain the change/);assert.match(json(r),/Saved cues are retained offline/);
    await act(async()=>button(r,'Refresh AI cues').props.onPress());assert.deepEqual(calls,['generate','confirm','refresh']);
  });
});

test('cue cards expose status and the sheet retains complete playback and synchronization notices',async()=>{
  await mounted({slide:2,playbackNotice:'Audio failed · tap Play to retry',requirementsNotice:'Requirements sync pending'},async r=>{
    assert.match(json(r),/Not enough readable evidence/);assert.match(json(r),/Status · Tap for detail/);
    assert.equal(button(r,'Open Further insight cues').props.accessibilityHint,'Includes cue and recording status.');
    await act(async()=>button(r,'Open Further insight cues').props.onPress());
    const notice=r.root.findByType('scroll').findAllByType('text').find(n=>typeof n.props.children==='string'&&n.props.children.includes('Requirements sync pending'));
    assert.ok(notice);assert.match(notice.props.children,/Audio failed/);assert.equal(notice.props.numberOfLines,undefined);
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


test('long accepted cues remain complete and reachable in each bounded category sheet',async()=>{
  const raw=profileResponse();
  const essential='Explain how the measured change follows from the comparison and describe its limitations before drawing a conclusion about the practical effect shown on this slide';
  const optional='Connect this measured result with a practical decision and ask the audience which additional experiment would test the explanation most clearly under realistic conditions today';
  raw.descriptions.slides[0].must_cover[0].text=essential;
  raw.descriptions.slides[0].go_deeper[0].text=optional;
  await mounted({state:parseProfileState(raw,deckId,3)},async r=>{
    for(const [category,content]of [['Must cover',essential],['Further insight',optional]]){
      await act(async()=>button(r,'Open '+category+' cues').props.onPress());
      const scroll=r.root.findByType('scroll');
      const rendered=scroll.findAllByType('text').find(t=>t.props.children===content);
      assert.ok(rendered);assert.equal(rendered.props.numberOfLines,undefined);
      await act(async()=>button(r,'Close cue sheet').props.onPress());
    }
  });
});

test('both category cards remain side by side and each sheet contains all its cues',async()=>{
  const raw=profileResponse();raw.descriptions.slides[0].must_cover.push({...raw.descriptions.slides[0].must_cover[0],text:'Explain the assumptions behind the measurement'});
  await mounted({state:parseProfileState(raw,deckId,3)},async r=>{
    const must=button(r,'Open Must cover cues'),deeper=button(r,'Open Further insight cues');
    assert.equal(must.parent,deeper.parent);assert.equal(must.parent.props.style.flexDirection,'row');
    assert.equal(must.props.style[0].flex,1);assert.equal(deeper.props.style[0].flex,1);
    await act(async()=>must.props.onPress());
    const scroll=r.root.findByType('scroll');
    assert.ok(scroll.findAllByType('text').some(n=>n.props.children==='Explain the assumptions behind the measurement'));
    assert.equal(r.root.findAllByType('scroll').length,1);
    let sheet=scroll.parent;while(sheet&&!sheet.props.style?.[0]?.maxHeight)sheet=sheet.parent;assert.ok(sheet?.props.style[0].maxHeight>0);
    assert.equal(r.root.findAllByProps({accessibilityRole:'tab'}).length,0);
  });
});
