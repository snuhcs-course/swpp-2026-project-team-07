// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
// OutLoud redesign: presentation hues and icon ids.

export type HueName = 'blue' | 'violet' | 'mint' | 'amber' | 'pink' | 'cyan' | 'coral' | 'lime' | 'indigo';

/** Order in which new presentations take a hue (first one not already used). */
export const NEW_HUE_ORDER: HueName[] = ['cyan', 'coral', 'lime', 'indigo', 'blue', 'violet', 'mint', 'amber', 'pink'];

export function pickHue(used: readonly HueName[]): HueName {
  const taken = new Set(used);
  for (const hue of NEW_HUE_ORDER) if (!taken.has(hue)) return hue;
  return NEW_HUE_ORDER[used.length % NEW_HUE_ORDER.length];
}

export const isHue = (value: unknown): value is HueName => typeof value === 'string' && (NEW_HUE_ORDER as string[]).includes(value);

export type IconId = 'present' | 'chart' | 'growth' | 'money' | 'bulb' | 'rocket' | 'cap' | 'book' | 'flask' | 'atom' |
  'globe' | 'computer' | 'math' | 'megaphone' | 'team' | 'heart' | 'briefcase' | 'target' | 'calendar' | 'palette';

/** Picker order, with the accessible name of each icon. "present" is the default. */
export const ICONS: readonly (readonly [IconId, string])[] = [
  ['present', 'Presentation'], ['chart', 'Statistics'], ['growth', 'Growth'], ['money', 'Economics'], ['bulb', 'Idea'],
  ['rocket', 'Launch'], ['cap', 'Thesis'], ['book', 'Literature'], ['flask', 'Science'], ['atom', 'Physics'],
  ['globe', 'Global'], ['computer', 'Computer'], ['math', 'Math'], ['megaphone', 'Marketing'], ['team', 'Team'],
  ['heart', 'Health'], ['briefcase', 'Business'], ['target', 'Strategy'], ['calendar', 'Planning'], ['palette', 'Design'],
];

export const isIcon = (value: unknown): value is IconId => typeof value === 'string' && ICONS.some(([id]) => id === value);
