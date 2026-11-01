// Synthetic credentials and native adapters; the recorder child tracks its own lifetime.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';
import React, { useEffect } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { resolve, load } from './helpers/demo-access-native-loader.mjs';
registerHooks({ resolve, load });
process.env.EXPO_PUBLIC_API_URL='https://demo.example.test/api';
process.env.EXPO_PUBLIC_REQUIRE_DEMO_CODE='1';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.__demoAccessStore=new Map();
globalThis.__demoAccessFetch=async()=>Response.json({service:'outloud-api'});
const { DemoAccessGate }=await import('../src/screens/DemoAccessGate.tsx');
const { demoAccess, enterDemoCode, backendFetch }=await import('../src/services/backendFetch.ts');

test('code entry and 401 re-entry retain the same recorder; offline continuation remains available',async()=>{
  let mounts=0,unmounts=0,renderer;
  function Recorder(){useEffect(()=>{mounts++;return()=>{unmounts++}},[]);return React.createElement('Recorder');}
  await act(async()=>{renderer=TestRenderer.create(React.createElement(DemoAccessGate,null,React.createElement(Recorder)));});
  assert.equal(mounts,0);
  assert.ok(JSON.stringify(renderer.toJSON()).includes('Reviewers share this workspace'));
  assert.equal(renderer.root.findByType('TextInput').props.secureTextEntry,true);
  assert.ok(renderer.root.findAllByType('Text').some(text=>text.props.children==='Continue offline'));
  await act(async()=>{await enterDemoCode('synthetic-code')});
  assert.equal(mounts,1);assert.equal(unmounts,0);
  globalThis.__demoAccessFetch=async()=>new Response('',{status:401});
  await act(async()=>{await backendFetch('https://demo.example.test/api/attempts/',{method:'POST',body:'synthetic'})});
  assert.equal(demoAccess.getSnapshot().state,'locked');
  assert.equal(mounts,1);assert.equal(unmounts,0);
  assert.equal(renderer.root.findByType('Modal').props.visible,false);
  await act(async()=>{renderer.root.findByProps({accessibilityLabel:'Enter demo code to reconnect'}).props.onPress()});
  assert.equal(renderer.root.findByType('Modal').props.visible,true);
  assert.equal(mounts,1);assert.equal(unmounts,0);
  await act(async()=>{renderer.root.findByType('Modal').props.onRequestClose()});
  assert.equal(renderer.root.findByType('Modal').props.visible,false);
  assert.equal(mounts,1);assert.equal(unmounts,0);
  globalThis.__demoAccessFetch=async()=>Response.json({service:'outloud-api'});
  await act(async()=>{await enterDemoCode('synthetic-new')});
  assert.equal(mounts,1);assert.equal(unmounts,0);
  await act(async()=>{renderer.unmount()});
  assert.equal(unmounts,1);
});
