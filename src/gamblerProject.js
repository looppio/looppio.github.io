// Metadata describes the supplied visual artifacts, without claims about delivery or personal authorship.
// All 12 original static WebP files are preserved unchanged. Provenance stays in work/gambler-case.
export const gamblerProject = {
  id: 'gambler',
  slug: 'gambler',
  title: 'Gambler casino app',
  category: 'iGaming',
  primaryCategory: 'igaming',
  filterCategories: ['igaming'],
  tags: ['iGaming', 'Casino', 'Mobile'],
  description:
    'A mobile casino product connecting poker and roulette with a game lobby, player profiles, progression and collectible rewards.',
  cover: '/assets/covers/gambler.webp',
  coverWidth: 1280,
  coverHeight: 969,
  media: [
    {
      src: '/assets/cases/gambler/roulette-profile.webp',
      type: 'image',
      alt: 'Roulette number selection and player profile on dark mobile screens',
      width: 3840,
      height: 2907,
    },
    {
      src: '/assets/cases/gambler/app-overview.webp',
      type: 'image',
      alt: 'Casino lobby, poker gameplay and collectible detail overview',
      width: 3840,
      height: 2907,
    },
    {
      src: '/assets/cases/gambler/lobby-poker-hero.webp',
      type: 'image',
      alt: 'Mobile casino lobby and poker table mockups',
      width: 3840,
      height: 2907,
    },
    {
      src: '/assets/cases/gambler/game-plan.webp',
      type: 'image',
      alt: 'Product design principles for gameplay, rewards and progression',
      width: 3840,
      height: 3944,
    },
    {
      src: '/assets/cases/gambler/progression-model.webp',
      type: 'image',
      alt: 'Gameplay progression model with competition and collectible rewards',
      width: 3840,
      height: 5115,
    },
    {
      src: '/assets/cases/gambler/player-goals.webp',
      type: 'image',
      alt: 'Player persona with goals, challenges and progression context',
      width: 3840,
      height: 4975,
    },
    {
      src: '/assets/cases/gambler/core-feature-flows.webp',
      type: 'image',
      alt: 'Casino lobby, game tables, roulette, collectibles and player profile flows',
      width: 3840,
      height: 14858,
    },
    {
      src: '/assets/cases/gambler/gameplay-and-player-states.webp',
      type: 'image',
      alt: 'Poker table, roulette round timer and player status details',
      width: 3840,
      height: 6454,
    },
    {
      src: '/assets/cases/gambler/brand-and-controls.webp',
      type: 'image',
      alt: 'App identity, icon sizes and poker action controls',
      width: 3840,
      height: 7578,
    },
    {
      src: '/assets/cases/gambler/mobile-grid.webp',
      type: 'image',
      alt: 'Mobile grid and spacing specification',
      width: 3840,
      height: 5154,
    },
    {
      src: '/assets/cases/gambler/color-system.webp',
      type: 'image',
      alt: 'Casino color palette and visual accents',
      width: 3840,
      height: 3686,
    },
    {
      src: '/assets/cases/gambler/typography.webp',
      type: 'image',
      alt: 'Typography and type hierarchy for the casino interface',
      width: 3840,
      height: 3291,
    },
  ],
  sources: [],
};

export const gamblerDetails = {
  title: 'Gambler casino app',
  summary:
    'A mobile casino product connecting poker and roulette with a game lobby, player profiles, progression and collectible rewards.',
  tags: ['iGaming', 'Casino', 'Mobile'],
  verifiedContribution: true,
  contribution: [
    'I designed the mobile player journey from choosing a game in the lobby to playing poker or roulette and reviewing progress. I brought game selection, balances, live lobbies and rewards into the home screen so players could see where to start and what was available.',
    'I designed gameplay controls around one-handed use, placing chip and betting actions within thumb reach. I used round timers, player status and clear action hierarchy to communicate what was happening at the table and when a decision was needed.',
    'I connected achievements, profiles and collectible rewards to the progression model. I defined reusable game controls, icon sizes, typography, color and a mobile grid to keep the lobby, tables and player screens consistent.',
  ],
  scope: [
    'Mobile casino lobby and game selection',
    'Poker tables and player actions',
    'Roulette number selection and round timers',
    'One-handed chip and betting controls',
    'Player profiles, achievements and collections',
    'Progression and reward journeys',
    'Reusable mobile controls, icon sizes and layout specifications',
  ],
};

export default gamblerProject;
