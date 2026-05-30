export const SIC_TIERS = {
  tier1: ['43210', '43220', '49410', '69201', '70229', '71121', '71129'],
  tier2: [
    '25620', '25990', '28290', '33120', '33190',
    '41201', '41202', '42110', '43320', '43390', '43999',
    '47190', '47910',
    '52103', '52290',
    '56101', '56102', '56290',
    '69202',
  ],
  tier3: ['62012', '62020', '62090'],
} as const;

export const SIC_DESCRIPTIONS: Record<string, string> = {
  '41201': 'Construction – Commercial buildings',
  '41202': 'Construction – Domestic buildings',
  '42110': 'Construction – Roads & motorways',
  '43210': 'Electrical installation',
  '43220': 'Plumbing, heat & air-conditioning',
  '43320': 'Joinery installation',
  '43390': 'Building completion & finishing',
  '43999': 'Specialised construction',
  '25620': 'Machining',
  '25990': 'Fabricated metal products',
  '28290': 'Special-purpose machinery',
  '33120': 'Repair of machinery',
  '33190': 'Repair of other equipment',
  '71121': 'Engineering design',
  '71129': 'Other engineering activities',
  '49410': 'Freight transport by road',
  '52103': 'Warehousing & storage',
  '52290': 'Transportation support',
  '69201': 'Accounting & auditing',
  '69202': 'Bookkeeping',
  '70229': 'Management consultancy',
  '74909': 'Other professional activities',
  '62012': 'Software development',
  '62020': 'IT consultancy',
  '62090': 'Other IT services',
  '56101': 'Licensed restaurants',
  '56102': 'Restaurants & cafes',
  '56290': 'Other food services',
  '47190': 'Non-specialised retail',
  '47910': 'E-commerce / Mail order',
};

export const PRIORITY_SIC_CODES: string[] = [...SIC_TIERS.tier1];

export const ALL_TRACKED_SIC_CODES: string[] = [
  ...SIC_TIERS.tier1,
  ...SIC_TIERS.tier2,
  ...SIC_TIERS.tier3,
];

export function getSicTier(sicCode: string): 1 | 2 | 3 | null {
  if ((SIC_TIERS.tier1 as readonly string[]).includes(sicCode)) return 1;
  if ((SIC_TIERS.tier2 as readonly string[]).includes(sicCode)) return 2;
  if ((SIC_TIERS.tier3 as readonly string[]).includes(sicCode)) return 3;
  return null;
}

export function getSicDescription(sicCode: string): string {
  return SIC_DESCRIPTIONS[sicCode] ?? `SIC ${sicCode}`;
}

export function getBestSicTier(sicCodes: string[]): 0 | 1 | 2 | 3 {
  if (sicCodes.some((c) => (SIC_TIERS.tier1 as readonly string[]).includes(c))) return 1;
  if (sicCodes.some((c) => (SIC_TIERS.tier2 as readonly string[]).includes(c))) return 2;
  if (sicCodes.some((c) => (SIC_TIERS.tier3 as readonly string[]).includes(c))) return 3;
  return 0;
}
