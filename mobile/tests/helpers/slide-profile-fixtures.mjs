// Synthetic generated profile responses; no provider or private content.
import {descriptionState,deckId,fact} from './feedback-fixtures.mjs';
export {deckId};
export function profileResponse(extra={}) {
  const value=descriptionState();
  const sources=[{slide_index:0,source_id:'b'.repeat(64)},{slide_index:1,source_id:'c'.repeat(64)},{slide_index:2,source_id:'e'.repeat(64)}];
  Object.assign(value.provenance,{prompt_version:'slide-profile-v5',schema_version:'slide-profile-gemini-v5',sources});
  value.descriptions={slides:sources.map(source=>({
    ...source,deck_id:deckId,slide_kind:'content',summary:fact(source.slide_index===0?'Measured growth':source.slide_index===1?'Final summary':'Unreadable slide'),key_ideas:[],visual_facts:[],
    must_cover:source.slide_index===0?[{text:'Explain the change in measured growth',evidence_refs:['summary']}]:source.slide_index===1?[{text:'Recap the final result',evidence_refs:['summary']}]:[],
    go_deeper:source.slide_index===0?[{text:'Connect the result to a practical example',kind:'question',information_needed:'A suitable experiment',evidence_refs:[{...source,fact_ref:'summary',quote:'Measured growth'}]}]:[],
  }))};
  Object.assign(value.descriptions.slides[2].summary,{uncertain:true,uncertainty:'Low resolution'});
  return Object.assign(value,extra);
}
