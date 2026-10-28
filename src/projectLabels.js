// Compact names for the archive. Detailed case titles remain unchanged.
const labels = {
  dexsport: 'Dexsport',
  '15m': '15M',
  gambler: 'Gambler',
  'crypto-casino': 'Crypto Casino',
  caregiver: 'Caregiver AI',
  zircuit: 'Zircuit',
  metaplex: 'Metaplex',
  'card-platform': 'Private Cards',
  ndax: 'Ndax',
  'exchange-redesign': 'Nomiswap',
  'crypto-app': 'Glue',
  shroomradar: 'ShroomRadar',
  'nft-marketplace': 'GhostMarket',
  deepreel: 'DeepReel',
  'performance-marketing': 'AI Campaigns',
  'vr-meditation': 'VR Meditation',
  modelx: 'ModelX',
  vicetemple: 'Vicetemple',
  'creator-economy': 'Creator CRM',
};

export const projectLabel = (project) => labels[project.id] || project.title;
