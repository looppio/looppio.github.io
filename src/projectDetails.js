// Case details grounded in the owner's public portfolio, source inventory and approvals.
// Evidence and approvals stay in the private workspace, outside the repository.
// Published durations describe the project or sprint, never calendar dates.
// verifiedContribution means explicit personal attribution or owner-approved copy.
// A false value never implies personal ownership of scope.
// Pending personal contribution is omitted; factual project scope remains visible.
import { cardPlatformDetails } from './cardPlatformProject.js';
import { ndaxDetails } from './ndaxProject.js';
import { gamblerDetails } from './gamblerProject.js';
import { vrMeditationDetails } from './vrMeditationProject.js';
import { adultDetails } from './adultProjects.js';
import { dexsportDetails } from './dexsportProject.js';
import { fifteenMDetails } from './fifteenMProject.js';
import { metaplexDetails } from './metaplexProject.js';

export const projectDetails = {
  dexsport: dexsportDetails,
  '15m': fifteenMDetails,
  gambler: gamblerDetails,
  'vr-meditation': vrMeditationDetails,
  ...adultDetails,
  zircuit: {
    title: 'Zircuit',
    summary:
      'An Ethereum Layer 2 ecosystem connecting product discovery, staking and a non-custodial wallet. A complete design system brings its website, financial interfaces and security communication together.',
    tags: ['Web3', 'FinTech', 'Design systems'],
    verifiedContribution: true,
    contribution: [
      'I designed the website, staking hub and wallet experience, connecting product discovery with the actions people take after connecting a wallet. I organized the ecosystem around clear entry points, asset information and the next step in each flow.',
      'I worked through asset balances, receiving crypto, withdrawals and transaction review. For the wallet, I designed risk simulation indicators shown before signing, bringing security information into the decision itself instead of leaving it separate from the action.',
      'I built the complete design system, including reusable components, interface states, typography, color and layout rules. I applied the system to website and wallet screens, tested component behavior and corrected inconsistencies in styling and interface states.',
    ],
    scope: [
      'Website architecture and ecosystem discovery',
      'Staking hub and non-custodial wallet',
      'Asset balances, receiving crypto and withdrawals',
      'Transaction review and risk indicators before signing',
      'Complete design system and reusable component states',
      'Visual styling, interface testing and design QA',
    ],
  },
  metaplex: metaplexDetails,
  deepreel: {
    title: 'DeepReel',
    summary:
      'An AI video creation platform designed from the ground up, connecting AI chat, project management and a multi-scene editor through a complete design system.',
    tags: ['AI', 'Video creation', 'SaaS'],
    verifiedContribution: true,
    contribution: [
      'I designed DeepReel from the ground up, shaping the AI chat and video creation experience alongside the project dashboard. I connected assisted creation and manual editing so users could start with an idea, generate content and continue working on it within a clear project structure.',
      'I separated global project settings from scene and timeline controls, making the scope of each edit clear. I designed script and audio editing, avatar recording, music selection and media adjustments, keeping the relevant controls close to the content being changed.',
      'I built the complete design system, defining the visual foundations, reusable components and consistent patterns for panels, settings and actions. I carried that system across the dashboard, editor, homepage and pricing pages, with layouts that could adapt to larger tablet screens.',
    ],
    scope: [
      'Product architecture and interface design from the ground up',
      'AI chat, assisted video creation and manual editing',
      'Project dashboard and multi-scene editor',
      'Global settings, scene controls and timeline hierarchy',
      'Script, audio, avatar recording and music workflows',
      'Media positioning, framing and image adjustments',
      'Complete design system and responsive interface patterns',
      'Homepage and pricing experience',
    ],
  },
  'card-platform': cardPlatformDetails,
  ndax: ndaxDetails,
  'crypto-casino': {
    title: 'Crypto casino platform',
    summary:
      'A crypto and fiat casino platform covering registration, game discovery, wallets, payments and player rewards, with a shared design system for desktop, mobile and multiple operator brands.',
    tags: ['Crypto', 'Casino', 'Design systems'],
    role: 'Product Designer',
    duration: '18 months',
    verifiedContribution: true,
    contribution: [
      'I designed the casino experience over an 18-month engagement, connecting registration, the game lobby, wallet and rewards. I organized game categories, search and navigation around finding a game and returning to recently played or saved titles, with layouts adapted for desktop and mobile.',
      'I designed the cashier and account flows for crypto and fiat payments, including currency selection, deposits, identity verification and recovery when a payment provider fails. I also designed bonus claims, rakeback and VIP progression so players could understand their balance, available rewards and next action.',
      'I developed the shared design system behind the product, including navigation, forms, game cards, wallet controls and reward states. I separated reusable interface structure from brand styling so operator themes could change while retaining consistent behavior across the casino.',
    ],
    scope: [
      'Registration and identity verification',
      'Casino lobby, game categories, search and favorites',
      'Crypto and fiat wallets, currency selection and deposits',
      'Cashier recovery when a payment provider fails',
      'Bonuses, rakeback, VIP rewards and claim states',
      'Responsive desktop and mobile interfaces',
      'Shared design system and operator theming',
    ],
  },
  'performance-marketing': {
    title: 'AI campaign workspace',
    summary:
      'A B2B workspace that connects campaign analytics, explainable AI recommendations and campaign creation, helping marketing teams move from a performance signal to a considered action.',
    tags: ['AI', 'AdTech', 'Analytics'],
    role: 'Lead Product Designer',
    duration: '14 weeks',
    contributionLabel: 'My contribution',
    verifiedContribution: true,
    contribution: [
      'I led the product design from research and information architecture through interface design and handoff over 14 weeks. I shaped the main journey around reviewing performance, understanding an AI recommendation, managing campaigns and launching a new strategy, with role-based access for the team.',
      'I moved recommendations into a dedicated priority panel after early testing showed they were being missed inside the chart. Each card presents the issue, proposed action, estimated impact and confidence before the user applies a change. Campaign status tags make emerging problems visible without opening every campaign.',
      'I designed guided campaign creation and two ways to work with the AI assistant: a structured view of the problem, causes and next actions, plus open chat for follow-up questions. I brought these flows into a shared design system and prepared the interface for engineering handoff.',
    ],
    scope: [
      'Product research and information architecture',
      'Campaign performance overview and analytics',
      'AI recommendation hierarchy, impact and confidence signals',
      'Campaign status, controls and management',
      'Guided campaign creation',
      'Structured AI diagnostics and conversational follow-up',
      'Role-based access and team workflows',
      'Design system and engineering handoff',
    ],
  },
  'creator-economy': {
    title: 'Creator agency CRM',
    summary:
      'An AI CRM for creator agencies, combining fan messaging, revenue context, creator onboarding and transparent automation controls in one desktop workspace.',
    tags: ['AI', 'CRM', 'Chat'],
    role: 'Lead UI and UX Designer',
    duration: '8 days',
    contributionLabel: 'My contribution',
    verifiedContribution: true,
    contribution: [
      'I led the MVP redesign from UX audit and competitive analysis through information architecture, detailed interface design and handoff. I separated reporting, daily operations, team management and creator setup, then designed a three-panel messaging workspace with conversations, chat and fan context visible together.',
      'I designed an AI Activity Monitor with an activity feed, explanations and pause or resume controls, alongside clear AI and human message indicators and manual takeover. I placed subscription history, purchases, spending and fan notes beside the conversation so operators could review the relationship before responding.',
      'I designed creator onboarding with progress, optional steps, a conversation-tone preview and a test dialogue. I also designed the performance dashboard and prepared the Figma design system, loading and error states, and automation-state annotations. I reviewed implementation with engineers before the beta release.',
    ],
    scope: [
      'MVP audit, competitive analysis and information architecture',
      'Three-panel messaging and simultaneous conversation tabs',
      'Fan subscriptions, purchases, spending and notes',
      'AI activity, decision explanations and manual takeover',
      'Automation pause and resume controls',
      'Creator onboarding, tone preview and test dialogue',
      'Performance dashboard and reporting filters',
      'Design system, interaction states, developer handoff and design QA',
    ],
  },
  shroomradar: {
    title: 'ShroomRadar marketplace',
    summary:
      'A local vendor marketplace with connected map and list discovery, vendor profiles, product menus, reviews and account tools across desktop and mobile.',
    tags: ['Marketplace', 'Discovery', 'Mobile'],
    role: 'Product Designer',
    verifiedContribution: true,
    contribution: [
      "I designed ShroomRadar's discovery journey across search, map results, vendor lists and profiles. I kept the same filters and results when switching views so users could compare nearby vendors without restarting their search.",
      'I organized vendor cards and profiles around the information needed to make a choice: location, distance, availability, ratings, reviews and product menus. I carried that structure into mobile layouts, adapting map controls, result cards and navigation to smaller screens.',
      'I designed the account interfaces for profile information and review management, including visible review statuses and account actions. I developed reusable Figma components for cards, filters, forms and navigation to keep the customer and vendor experiences consistent.',
    ],
    scope: [
      'Location-based search and vendor discovery',
      'Map and list views with shared filters and results',
      'Sorting, vendor cards and saved favorites',
      'Vendor profiles, product menus and reviews',
      'Registration, profile settings and account actions',
      'Vendor review management and review statuses',
      'Responsive web layouts and reusable Figma components',
    ],
  },
  caregiver: {
    title: 'Caregiver AI assistant',
    summary:
      'An AI family assistant that turns everyday requests into shared tasks and calendar plans, with an iOS app and Apple Watch companion for people coordinating care, work and home.',
    tags: ['AI', 'Chat', 'Mobile'],
    role: 'Lead Product Designer',
    duration: '6 weeks',
    contributionLabel: 'My contribution',
    verifiedContribution: true,
    contribution: [
      'I led product and interface design for the iOS MVP over six weeks. I organized the experience around four clear purposes: talking to the assistant, delegating family tasks, checking the schedule and reviewing activity patterns. This gave each responsibility a place without making users assemble a plan across separate tools.',
      'I designed onboarding as a conversation with text and voice responses. Task creation asks for the context first, while date, time and repeat settings appear when users need to adjust the suggestion. I kept activity categories and colors consistent between chat, task cards and calendar views so the same plan remained recognizable throughout the app.',
      'I created the design system and Apple Watch companion, carrying the same visual language across both surfaces. The watch focuses on the next activity and delegated-task reminders, while the phone provides the detail needed to plan and coordinate family responsibilities.',
    ],
    scope: [
      'Product architecture and iOS MVP design',
      'Conversational onboarding with text and voice input',
      'AI-assisted task creation and progressive disclosure',
      'Shared tasks, delegation and activity cards',
      'Day, week and month calendar views',
      'Consistent activity categories and visual cues',
      'Activity and wellbeing pattern views',
      'Design system and Apple Watch companion',
    ],
  },
  'exchange-redesign': {
    title: 'Nomiswap exchange',
    summary:
      'A Nomiswap website and exchange redesign connecting token swaps, liquidity pools, yield farming and analytics through a consistent set of financial interfaces.',
    tags: ['Crypto', 'DeFi', 'Exchange'],
    verifiedContribution: true,
    contribution: [
      "I redesigned Nomiswap's website and core exchange flows, connecting the product overview with swaps, liquidity and farming. I organized the navigation and page hierarchy around the actions users take and the financial information they need to compare options.",
      'I designed swap and liquidity forms, including token selection, amount entry and calculated values. I carried those patterns into farming, referral and analytics screens so users could recognize the same controls and information hierarchy as they moved between features.',
      'I developed reusable Figma components and the visual foundations behind the interface, including typography, color and responsive grids. This connected the marketing pages with the denser exchange screens and provided a consistent basis for assembling product layouts.',
    ],
    scope: [
      'Website redesign and core feature navigation',
      'AMM token swaps and liquidity pool interfaces',
      'Token selection, amount entry and calculated values',
      'Yield farming, referrals and analytics',
      'Reusable Figma components and visual foundations',
      'Responsive grids and page patterns',
    ],
  },
  'crypto-app': {
    title: 'Glue crypto platform',
    summary:
      'A DeFi lending dashboard for Glue, connecting market discovery, supplied assets and borrowing positions with financial actions and visible liquidation risk.',
    tags: ['Web3', 'Finance', 'Dashboard'],
    verifiedContribution: true,
    contribution: [
      "I designed the lending dashboard around the relationship between available markets and a user's existing positions. I separated supplied balances, borrowing and available capacity, while keeping the health factor visible as part of understanding liquidation risk.",
      'I designed the supply, withdrawal, borrowing and repayment flows, covering asset selection, amounts and operation details. I connected the forms with empty states, errors and completion feedback so the interface explained where the user was in a financial action.',
      'I developed the structure through UX planning and wireframes, then established the visual identity and reusable interface patterns. I used consistent hierarchy for asset data, risk indicators and primary actions across the dashboard and transaction forms.',
    ],
    scope: [
      'DeFi market overview and asset selection',
      'Supplied balances, borrowing positions and capacity',
      'Health factor and liquidation risk indicators',
      'Supply, withdrawal, borrow and repay flows',
      'Empty states, validation errors and completion feedback',
      'UX planning, wireframes, visual identity and shared patterns',
    ],
  },
  'nft-marketplace': {
    title: 'GhostMarket marketplace',
    summary:
      'A multichain NFT marketplace redesign covering asset discovery, collection and item pages, buying and offers, creator profiles and NFT creation.',
    tags: ['NFT', 'Marketplace', 'Web3'],
    contributionLabel: 'My contribution',
    verifiedContribution: true,
    contribution: [
      'I redesigned GhostMarket around the main tasks of collectors and creators: finding assets, evaluating an item and preparing an NFT for sale. I structured the marketplace navigation, discovery filters, collection views, profiles and account areas as connected product flows.',
      'I designed item pages that bring price, blockchain, ownership, collection, offers and transaction history together with the purchase actions. In discovery, I organized filters for blockchain, listing type, currency, price and collection so users could narrow a large catalogue and compare relevant assets.',
      'I designed the NFT creation flow, from choosing a blockchain and uploading media to setting a sale format, price, royalties and collection. I paired the form with an item preview and built reusable Figma cards, fields and controls to keep discovery, item details and creation consistent.',
    ],
    scope: [
      'Marketplace information architecture and account navigation',
      'NFT, collection and creator discovery',
      'Blockchain, listing, currency, price and collection filters',
      'Item details, ownership, attributes, offers and transaction history',
      'Purchase and offer entry points',
      'Multichain NFT creation and sale setup',
      'Media upload, preview, royalties and collection selection',
      'Reusable Figma components and marketplace patterns',
    ],
  },
};

export default projectDetails;
