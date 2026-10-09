export function selectLayout(value: string | undefined, development: boolean): 'refactor' | 'contract-test' {
  if (value === undefined || value === 'refactor') return 'refactor';
  if (value === 'contract-test' && development) return 'contract-test';
  throw new Error(`Invalid EXPO_PUBLIC_UI_LAYOUT=${JSON.stringify(value)}. Use "refactor"${development ? ' or development-only "contract-test"' : ''}. Restart after changing layout configuration.`);
}
