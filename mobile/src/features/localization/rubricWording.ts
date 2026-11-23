// The assessment rubric is versioned server copy. Only exact criterion labels and
// anchors use this catalog; a model's explanation and the speaker's words are distinct.
export const rubricKorean: Record<string, string> = {
  'Essential coverage': '핵심 내용 전달',
  'Essential meaning missing or obscured': '핵심 내용이 빠졌거나 분명하게 드러나지 않아요.',
  'Partial meaning with consequential gaps': '내용을 일부 전달했지만 중요한 부분이 빠졌어요.',
  'Essential meaning communicated appropriately': '핵심 내용을 적절하게 전달했어요.',
  'Essential meaning communicated with effective prioritization': '중요한 내용에 우선순위를 두어 핵심을 잘 전달했어요.',
  'Explanation depth': '설명의 깊이',
  'Essential meaning remains unexplained': '핵심 내용이 무엇을 뜻하는지 설명이 부족해요.',
  'Important relationships remain unclear': '중요한 내용들이 서로 어떻게 연결되는지 분명하지 않아요.',
  'Suitable explanations or examples establish meaning': '적절한 설명이나 예시로 의미를 전달했어요.',
  'Explanations connect relationships and implications effectively': '내용 사이의 관계와 그 의미를 잘 연결해 설명했어요.',
  'Clarity and relevance': '명확성과 관련성',
  'Ambiguity or digression obstructs understanding': '표현이 모호하거나 주제를 벗어나서 이해하기 어려워요.',
  'Recurring friction obscures the message': '이해하기 어려운 대목이 반복되어 요점이 잘 드러나지 않아요.',
  'Clear, relevant expression supports understanding': '주제에 맞는 명확한 표현으로 이해를 도왔어요.',
  'Precise, economical expression consistently aids understanding': '정확하고 간결한 표현을 일관되게 사용해 이해하기 쉬워요.',
  'Structure': '구성',
  'Purpose or ending leaves the message unresolved': '발표 목적이나 맺음말이 모호해 요점이 분명하지 않아요.',
  'Opening or conclusion provides weak orientation': '도입부나 결론에서 발표의 방향을 파악하기 어려워요.',
  'Purpose, organization and takeaway are clear': '발표 목적과 구성, 기억해야 할 요점이 분명해요.',
  'Opening and conclusion form an effective framework': '도입부와 결론이 발표 전체를 잘 뒷받침해요.',
  'Coherence': '논리적 연결',
  'Disconnected sequencing obstructs understanding': '내용의 순서가 자연스럽게 이어지지 않아 이해하기 어려워요.',
  'Unexplained jumps interrupt connections': '내용 사이의 전환에 설명이 부족해 흐름이 끊겨요.',
  'Ideas and transitions form a logical sequence': '생각과 생각 사이의 전환이 논리적으로 이어져요.',
  'Relationships and transitions build a coherent whole': '내용 사이의 관계와 자연스러운 전환이 발표를 하나로 묶어 줘요.',
  'Audience suitability': '청중 적합성',
  'Framing substantially obstructs the supplied audience': '설명 방식 때문에 설정한 청중이 내용을 이해하기 어려워요.',
  'Consequential assumptions remain unexplained': '청중의 이해에 중요한 전제를 충분히 설명하지 않았어요.',
  'Context and terminology suit the supplied audience': '배경 설명과 용어가 설정한 청중에게 적절해요.',
  'Framing consistently anticipates audience needs': '청중에게 필요한 내용을 미리 고려해 일관되게 설명했어요.',
  'Delivery': '전달 방식',
  'Supported continuity or timing problems materially obstruct communication': '발표에서 확인된 흐름이나 시간 배분 문제가 내용 전달을 크게 방해해요.',
  'Supported disruptions sometimes impede understanding': '발표 흐름이 끊겨 이해하기 어려운 부분이 있어요.',
  'Continuity and time allocation support understanding': '자연스러운 흐름과 적절한 시간 배분이 이해를 도와요.',
  'Intentional continuity and pacing consistently aid processing and emphasis': '자연스러운 흐름과 속도 조절로 청중의 이해를 돕고 중요한 내용을 강조했어요.',
};

export function rubricWording(kind: string, path: string, source: string, language: 'en' | 'ko'): string | null {
  if (kind !== 'feedback' || !/(?:^|\.)criteria\.\d+\.(?:anchor|label)$/.test(path) || !Object.hasOwn(rubricKorean, source)) return null;
  return language === 'ko' ? rubricKorean[source] : source;
}
