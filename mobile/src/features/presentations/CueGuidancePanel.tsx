import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { C, F, TONE } from '../../design/tokens';
import { cueState, type CueCategory, type ProfileState, type SlideCue, type Enrichment } from './slideProfiles';

export function CueGuidancePanel({ state, slide, error, busy, onRecover }: {
  state: ProfileState | null; slide: number; error: string | null; busy: boolean;
  onRecover: (action: 'refresh' | 'generate' | 'retry' | 'confirm') => void;
}) {
  const [category, setCategory] = useState<CueCategory>('must_cover');
  const view = cueState(state, slide, category);
  const tone = category === 'must_cover' ? TONE.warn : TONE.info;
  return <View style={styles.panel}>
    <View style={styles.tabs}>
      {(['must_cover','go_deeper'] as const).map(c => <Pressable key={c} accessibilityRole="tab"
        accessibilityLabel={c === 'must_cover' ? 'Must Cover, essential speaking points' : 'Go Deeper, optional suggestions'}
        accessibilityState={{ selected: category === c }} onPress={() => setCategory(c)}
        style={[styles.tab, category === c && {backgroundColor: tone.bg}]}>
        <Text style={[styles.label,{color:category === c ? tone.fg : C.secondary}]}>
          {c === 'must_cover' ? 'Must Cover · Essential' : 'Go Deeper · Optional'}
        </Text>
      </Pressable>)}
    </View>
    <ScrollView key={`${slide}:${category}`} style={styles.scroll} contentContainerStyle={styles.content}>
      {view.cues.map(c => <CueCard key={`${state?.description_set_id}:${slide}:${category}:${c.text}`}
        cue={c} state={state} slide={slide} background={tone.bg} />)}
      {(view.message || error) && <Pressable accessibilityRole="button" accessibilityLabel={error ? 'Refresh AI cues' : view.action === 'confirm' ? 'Confirm AI cue retry' : 'AI cue status'}
        disabled={busy || (!view.action && !error)} onPress={() => {
          if (error) onRecover('refresh'); else if (view.action) onRecover(view.action);
        }}>
        <Text accessibilityLiveRegion="polite" style={styles.status}>{busy ? 'Requesting AI cues…' : error || view.message}
          {(!error && view.action) ? ' · Tap to ' + (view.action === 'generate' ? 'generate' : 'retry') : ''}</Text>
      </Pressable>}
    </ScrollView>
  </View>;
}

function CueCard({cue,state,slide,background}: {cue:SlideCue | Enrichment;state:ProfileState | null;slide:number;background:string}) {
  const [expanded,setExpanded] = useState(false);
  const current = state?.descriptions?.slides.find(s=>s.slide_index===slide);
  const premises = cue.evidence_refs?.map(ref => {
    if (typeof ref !== 'string') return `Slide ${ref.slide_index+1}: ${ref.quote}`;
    const [collection,index] = ref.split('/');
    const fact = collection === 'summary' ? current?.summary : collection === 'key_ideas' ? current?.key_ideas[Number(index)] : current?.visual_facts[Number(index)];
    return fact?.text ?? '';
  }).filter(Boolean) ?? [];
  return <View style={[styles.cue,{backgroundColor:background}]}>
    <Text style={styles.text}>{cue.text}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={expanded ? 'Hide cue evidence and details' : 'Show cue evidence and details'}
      accessibilityState={{expanded}} onPress={()=>setExpanded(v=>!v)}>
      <Text style={styles.detailToggle}>{expanded ? 'Hide details' : 'Details'}</Text>
    </Pressable>
    {expanded && <View>
      {premises.map((p,i)=><Text key={i} style={styles.evidence}>{p}</Text>)}
      {'information_needed' in cue && !!cue.information_needed && <Text style={styles.evidence}>To clarify: {cue.information_needed}</Text>}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  panel:{position:'absolute',left:16,right:16,top:398,height:150},
  tabs:{flexDirection:'row',gap:6,marginBottom:6},
  tab:{flex:1,paddingVertical:9,borderRadius:14,alignItems:'center'},
  label:{fontFamily:F.semibold,fontSize:12},
  scroll:{flex:1}, content:{gap:6,paddingBottom:6},
  cue:{paddingVertical:7,paddingHorizontal:12,borderRadius:14},
  text:{fontFamily:F.semibold,fontSize:13,color:C.body},
  evidence:{fontFamily:F.regular,fontSize:12,color:C.secondary,marginTop:4},
  detailToggle:{fontFamily:F.medium,fontSize:12,color:C.secondary,paddingVertical:7},
  status:{fontFamily:F.regular,fontSize:14,color:C.secondary},
});
