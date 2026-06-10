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
  // Engineering manufacturing — sheet metal & fabrication (25xx)
  '25110': 'Manufacture of metal structures',
  '25120': 'Manufacture of metal doors & windows',
  '25210': 'Manufacture of central heating radiators',
  '25290': 'Manufacture of metal tanks & containers',
  '25300': 'Manufacture of steam generators',
  '25500': 'Forging, pressing & roll-forming of metal',
  '25610': 'Treatment & coating of metals',
  '25710': 'Manufacture of cutlery',
  '25720': 'Manufacture of locks & hinges',
  '25730': 'Manufacture of tools',
  '25910': 'Manufacture of steel drums & containers',
  '25920': 'Manufacture of light metal packaging',
  '25930': 'Manufacture of wire products & chain',
  '25940': 'Manufacture of fasteners & screw products',
  // Machinery (28xx)
  '28110': 'Manufacture of engines & turbines',
  '28120': 'Manufacture of fluid power equipment',
  '28130': 'Manufacture of pumps & compressors',
  '28140': 'Manufacture of taps & valves',
  '28150': 'Manufacture of bearings & gears',
  '28210': 'Manufacture of ovens & furnaces',
  '28220': 'Manufacture of lifting & handling equipment',
  '28240': 'Manufacture of power-driven hand tools',
  '28250': 'Manufacture of cooling & ventilation equipment',
  '28300': 'Manufacture of agricultural machinery',
  '28410': 'Manufacture of metal forming machinery',
  '28490': 'Manufacture of machine tools',
  '28910': 'Manufacture of machinery for metallurgy',
  '28920': 'Manufacture of mining & construction machinery',
  '28930': 'Manufacture of food & beverage machinery',
  '28940': 'Manufacture of textile & apparel machinery',
  '28950': 'Manufacture of paper machinery',
  '28960': 'Manufacture of plastics & rubber machinery',
  '28990': 'Manufacture of other special purpose machinery',
  // Automotive (29xx)
  '29100': 'Manufacture of motor vehicles',
  '29200': 'Manufacture of vehicle bodies',
  '29310': 'Manufacture of automotive electrical equipment',
  '29320': 'Manufacture of automotive parts & accessories',
  // Aerospace, transport & defence (30xx)
  '30110': 'Building of ships',
  '30120': 'Building of pleasure boats',
  '30200': 'Manufacture of railway rolling stock',
  '30300': 'Manufacture of aircraft & spacecraft',
  '30400': 'Manufacture of military vehicles',
  '30910': 'Manufacture of motorcycles',
  '30920': 'Manufacture of bicycles',
  '30990': 'Manufacture of other transport equipment',
  // Repair & installation (33xx)
  '33110': 'Repair of fabricated metal products',
  '33130': 'Repair of electronic & optical equipment',
  '33140': 'Repair of electrical equipment',
  '33150': 'Repair & maintenance of ships',
  '33160': 'Repair & maintenance of aircraft',
  '33170': 'Repair of other transport equipment',
  '33200': 'Installation of industrial machinery',
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
