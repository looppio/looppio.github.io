// Public case metadata. Original case assets and provenance stay under work.
// Images 01, 09, 10 and 11 were anonymized with ImageGen before inclusion.
// No original video is included in the public selection.
export const cardPlatformProject = {
  id: 'card-platform',
  slug: 'card-platform',
  title: 'Private card platform',
  category: 'FinTech and payments',
  primaryCategory: 'fintech-web3',
  filterCategories: ['fintech-web3'],
  tags: ['FinTech', 'Payments', 'Mobile'],
  description:
    'A private financial app that brings multi-currency accounts, card controls, transfers and membership services into one mobile experience, supported by a responsive website.',
  cover: '/assets/covers/card-platform.webp',
  coverWidth: 1280,
  coverHeight: 847,
  media: [
    {
      src: '/assets/card-platform/card-platform-09.png',
      type: 'image',
      alt: 'Multi-currency account details with private values obscured',
      width: 1542,
      height: 1020,
    },
    {
      src: '/assets/card-platform/card-platform-01.png',
      type: 'image',
      alt: 'Mobile account overview with balance, funding actions and recent transactions',
      width: 1586,
      height: 992,
    },
    {
      src: '/assets/card-platform/card-platform-02.png',
      type: 'image',
      alt: 'Responsive website sections across three mobile layouts',
      width: 1370,
      height: 1096,
    },
    {
      src: '/assets/card-platform/card-platform-04.png',
      type: 'image',
      alt: 'Membership payment modal comparing yearly and monthly billing',
      width: 816,
      height: 1096,
    },
    {
      src: '/assets/card-platform/card-platform-06.png',
      type: 'image',
      alt: 'Multi-currency account options',
      width: 1094,
      height: 814,
    },
    {
      src: '/assets/card-platform/card-platform-10.png',
      type: 'image',
      alt: 'Card management with freeze controls, spending limits and recent transactions',
      width: 1542,
      height: 1020,
    },
    {
      src: '/assets/card-platform/card-platform-03.png',
      type: 'image',
      alt: 'Funding method selection sheet',
      width: 816,
      height: 1096,
    },
    {
      src: '/assets/card-platform/card-platform-05.png',
      type: 'image',
      alt: 'Mobile top-up flow with amount entry and account selection',
      width: 1370,
      height: 1096,
    },
    {
      src: '/assets/card-platform/card-platform-11.png',
      type: 'image',
      alt: 'Bank transfer progress and transaction details with private values obscured',
      width: 1542,
      height: 1020,
    },
    {
      src: '/assets/card-platform/card-platform-07.png',
      type: 'image',
      alt: 'Concierge venue card with location and discovery categories',
      width: 1094,
      height: 814,
    },
    {
      src: '/assets/card-platform/card-platform-08.png',
      type: 'image',
      alt: 'Concierge booking categories for dining and travel',
      width: 1094,
      height: 814,
    },
  ],
  sources: [],
};

export const cardPlatformDetails = {
  title: 'Private card platform',
  summary:
    'A private financial app that brings multi-currency accounts, card controls, transfers and membership services into one mobile experience, supported by a responsive website.',
  tags: ['FinTech', 'Payments', 'Mobile'],
  verifiedContribution: true,
  contribution: [
    'I designed account and card management around the information people need to use their money: balances, currencies, recent activity and available actions. I kept account details and card controls connected while giving freeze controls and spending limits a clear place in the interface.',
    'I designed funding and transfer flows, from choosing a method and entering an amount to following settlement progress. I worked on SEPA and SWIFT transfer tracking so a payment retained its status and details after it was sent, alongside interfaces for fiat and crypto accounts.',
    'I carried the same interaction patterns into membership billing and service discovery, and aligned them with the mobile website. Shared controls, typography and spacing kept financial tasks and membership features consistent.',
  ],
  scope: [
    'Multi-currency fiat and crypto account interfaces',
    'Card management, freeze controls and spending limits',
    'Funding methods, top-up forms and transfer details',
    'SEPA and SWIFT settlement tracking',
    'Membership billing and concierge discovery',
    'Responsive website and reusable interface patterns',
  ],
};

export default cardPlatformProject;
