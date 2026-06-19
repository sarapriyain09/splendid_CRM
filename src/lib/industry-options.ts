export const INDUSTRY_OPTIONS = [
  'Industrial Automation',
  'System Integration',
  'Controls Engineering',
  'Machine Building',
  'Manufacturing',
  'Engineering Consultancy',
  'Software',
  'Information Technology',
  'Energy & Utilities',
  'OEM',
  'Robotics',
  'Automotive',
  'Aerospace',
  'Pharmaceuticals',
  'Food & Beverage',
] as const;

export function splitIndustryValue(value: string): [string, string] {
  const parts = value
    .split(/\s*\|\s*|\s*,\s*/)
    .map((x) => x.trim())
    .filter(Boolean);
  return [parts[0] ?? '', parts[1] ?? ''];
}

export function joinIndustryValue(primary: string, secondary: string): string {
  const first = primary.trim();
  const second = secondary.trim();
  if (!first && !second) return '';
  if (!first) return second;
  if (!second || second === first) return first;
  return `${first} | ${second}`;
}
