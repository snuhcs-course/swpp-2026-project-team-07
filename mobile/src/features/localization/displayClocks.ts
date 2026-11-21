// Compare explicit clock times in coaching. A day-period can cover several linked hours.
const hour = String.raw`(?:1[0-2]|0?[1-9])(?::[0-5]\d)?(?:\s*시(?:\s*[0-5]?\d\s*분)?)?`;
const join = String.raw`(?:,\s*(?:and |or )?|and|or|to|through|until|와|과|및|또는|부터|에서|[/&~–—-])`;
const hours = `${hour}(?:\\s*${join}\\s*${hour})*`;
const dayPart = /오전|오후|아침|새벽|저녁|밤|낮|(?:morning|afternoon|evening|night)(?=\s+at\s+)/iu.source;
const after = new RegExp(String.raw`(?:^|[^\d:])(${hours})\s*(a\.?\s*m\b\.?|p\.?\s*m\b\.?|(?:in the |at )?(?:morning|afternoon|evening|night)\b)`, 'giu');
const before = new RegExp(String.raw`(${dayPart})\s*(?:at\s+)?(${hours})(?!\d)`, 'giu');
const beforeMeridiem = new RegExp(String.raw`\b(AM|PM|[AaPp]\.\s*[Mm]\.)\s*(${hours})(?!\d)`, 'gu');
const clockParts = /([0-9]{1,2})(?::([0-5][0-9]))?(?:\s*시(?:\s*([0-5]?[0-9])\s*분)?)?/gu;

function explicitTimes(text: string) {
  const times: number[] = [];
  function add(group: string, period: string) {
    for (const match of group.matchAll(clockParts)) {
      const hour = Number(match[1]);
      const pm = /^(?:p\.?\s*m|오후|저녁|낮)|afternoon|evening/iu.test(period) ||
        (/밤|night/iu.test(period) && hour >= 5 && hour < 12);
      times.push((hour % 12 + (pm ? 12 : 0)) * 60 + Number(match[2] ?? match[3] ?? 0));
    }
  }
  const remainder = text.replace(after, (_span, group: string, period: string) => {
    add(group, period);
    return ' ';
  });
  for (const match of remainder.matchAll(before)) add(match[2], match[1]);
  for (const match of remainder.matchAll(beforeMeridiem)) add(match[2], match[1]);
  return times;
}

export function keepsExplicitTimes(source: string, value: string) {
  if (source === value) return true;
  const expected = explicitTimes(source);
  if (!expected.length) return true;
  const actual = explicitTimes(value);
  // An unambiguous 24-hour reading can express the same time without a day-period.
  const unqualified = value.replace(after, ' ').replace(before, ' ').replace(beforeMeridiem, ' ');
  for (const match of unqualified.matchAll(/(?:^|[^\d:])(2[0-3]|1[3-9]|0\d)(?::([0-5][0-9])|\s*시(?:\s*([0-5]?[0-9])\s*분)?)/gu)) {
    actual.push(Number(match[1]) * 60 + Number(match[2] ?? match[3] ?? 0));
  }
  for (const match of unqualified.matchAll(/정오|\bnoon\b|자정|\bmidnight\b/giu)) actual.push(/정오|noon/iu.test(match[0]) ? 12 * 60 : 0);
  for (const time of expected) {
    const index = actual.indexOf(time);
    if (index < 0) return false;
    actual.splice(index, 1);
  }
  return true;
}
