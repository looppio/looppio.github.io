// Product scope is supported by the official marketing page and its supplied feature images.
// Personal contribution copy is owner-approved; role and delivery dates remain unspecified.
export const modelxProject = {
  id: 'modelx',
  slug: 'modelx',
  title: 'ModelX creator platform',
  category: 'Creator platforms',
  primaryCategory: 'adult-dating',
  filterCategories: ['adult-dating'],
  filterOnly: true,
  tags: ['Creator platforms', 'Memberships', 'Responsive web'],
  description:
    'A responsive creator platform for selling content, offering recurring memberships and receiving tips, with a storefront, checkout, member account and private feed.',
  cover: '/assets/covers/modelx.webp',
  coverWidth: 1280,
  coverHeight: 792,
  media: [
    {
      src: '/assets/cases/modelx/membership-plans.png',
      type: 'image',
      alt: 'Recurring membership options across desktop and mobile layouts',
      width: 1520,
      height: 940,
    },
    {
      src: '/assets/cases/modelx/tipping-options.png',
      type: 'image',
      alt: 'Preset and custom tipping amounts across desktop and mobile layouts',
      width: 1520,
      height: 940,
    },
    {
      src: '/assets/cases/modelx/social-links.png',
      type: 'image',
      alt: 'Responsive creator social links panel with a non-explicit portrait',
      width: 1520,
      height: 940,
    },
  ],
  sources: [],
};

export const modelxDetails = {
  title: 'ModelX creator platform',
  summary:
    'A responsive creator platform for selling content, offering recurring memberships and receiving tips, with a storefront, checkout, member account and private feed.',
  tags: ['Creator platforms', 'Memberships', 'Responsive web'],
  verifiedContribution: true,
  contribution: [
    'I designed the ModelX creator website experience across content browsing, paid access and fan support. I connected the storefront, membership options and account areas so visitors could distinguish free content, individual purchases and membership-only access.',
    'I designed the subscription and tipping flows as separate payment choices. Membership cards explain the billing period, recurring charge and included access, while tipping offers preset or custom amounts. I carried these choices through the responsive layouts and checkout hierarchy.',
    "I designed reusable Figma components, pricing layouts and responsive grids for the creator pages. Shared navigation, cards, forms and actions connect the storefront, private feed, account and social links while allowing the creator's identity to remain prominent.",
  ],
  scope: [
    'Creator website navigation and content discovery',
    'Free, individually priced and membership-only content',
    'Recurring memberships, billing periods and access benefits',
    'Preset and custom tipping amounts',
    'Storefront, cart and checkout interfaces',
    'Member account, private feed and social links',
    'Responsive layouts and reusable Figma components',
  ],
};

export const vicetempleProject = {
  id: 'vicetemple',
  slug: 'vicetemple',
  title: 'Vicetemple',
  category: 'Adult & Dating',
  primaryCategory: 'adult-dating',
  filterCategories: ['adult-dating'],
  filterOnly: true,
  tags: ['Hosting', 'Web services', 'Responsive web'],
  description:
    'A website for adult hosting and web services, helping customers compare shared hosting, virtual servers and dedicated servers, explore website themes and find support.',
  websiteUrl: 'https://vicetemple.com/',
  cover: '/assets/covers/vicetemple.webp',
  coverWidth: 1280,
  coverHeight: 889,
  media: [
    {
      src: '/assets/cases/vicetemple/plans.png',
      type: 'image',
      alt: 'Hosting plans and service comparison',
      width: 1425,
      height: 990,
    },
    {
      src: '/assets/cases/vicetemple/homepage.png',
      type: 'image',
      alt: 'Website services homepage and product navigation',
      width: 1425,
      height: 990,
    },
    {
      src: '/assets/cases/vicetemple/help.png',
      type: 'image',
      alt: 'Hosting support and frequently asked questions',
      width: 1425,
      height: 990,
    },
  ],
};
export const vicetempleDetails = {
  title: 'Vicetemple',
  summary:
    'A website for adult hosting and web services, helping customers compare shared hosting, virtual servers and dedicated servers, explore website themes and find support.',
  tags: ['Hosting', 'Web services', 'Responsive web'],
  websiteUrl: 'https://vicetemple.com/',
  verifiedContribution: true,
  contribution: [
    "I designed the customer-facing website for Vicetemple's hosting and web services. I organized navigation around hosting, domains, website themes and additional services so customers could find the right starting point for launching or growing their site.",
    'I designed the plan comparison around the decisions customers need to make: service type, monthly price, storage, server resources and included features. I gave each plan a consistent structure and connected it to further service information.',
    'I connected the service pages with theme discovery, frequently asked questions and support access. I used repeatable layouts for offers, pricing cards and help content to make a broad technical catalogue easier to explore across screen sizes.',
  ],
  scope: [
    'Hosting and web services information architecture',
    'Shared hosting, virtual server and dedicated server comparison',
    'Pricing cards and technical feature hierarchy',
    'Domains, website themes and service discovery',
    'Frequently asked questions and support navigation',
    'Responsive page layouts and reusable content patterns',
  ],
};
export const adultProjects = [modelxProject, vicetempleProject];
export const adultDetails = { modelx: modelxDetails, vicetemple: vicetempleDetails };
