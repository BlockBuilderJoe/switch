// Switch — Blocklist data model
// Each category maps to Cloudflare Gateway DNS policy expressions

export const categories = [
  {
    id: 'social-media',
    name: 'Social Media',
    description: 'Switch off social networking platforms',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 10h.01"/><path d="M12 10h.01"/><path d="M16 10h.01"/></svg>`,
    defaultOn: false,
    cfType: 'content_category',
    cfCategoryIds: [149],
    sites: [
      { id: 'youtube', name: 'YouTube', domains: ['youtube.com', 'youtu.be', 'ytimg.com', 'googlevideo.com', 'yt3.ggpht.com'] },
      { id: 'tiktok', name: 'TikTok', domains: ['tiktok.com', 'tiktokv.com', 'tiktokcdn.com', 'musical.ly'] },
      { id: 'instagram', name: 'Instagram', domains: ['instagram.com', 'cdninstagram.com'] },
      { id: 'facebook', name: 'Facebook', domains: ['facebook.com', 'fbcdn.net', 'fb.com', 'facebook.net', 'fbsbx.com'] },
      { id: 'twitter', name: 'Twitter / X', domains: ['twitter.com', 'x.com', 't.co', 'twimg.com'] },
      { id: 'snapchat', name: 'Snapchat', domains: ['snapchat.com', 'snap.com', 'sc-cdn.net', 'snapkit.co'] },
      { id: 'reddit', name: 'Reddit', domains: ['reddit.com', 'redd.it', 'redditstatic.com', 'redditmedia.com'] },
      { id: 'pinterest', name: 'Pinterest', domains: ['pinterest.com', 'pinimg.com'] },
      { id: 'linkedin', name: 'LinkedIn', domains: ['linkedin.com', 'licdn.com'] },
    ]
  },
  {
    id: 'video-streaming',
    name: 'Video Streaming',
    description: 'Switch off streaming platforms',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>`,
    defaultOn: false,
    cfType: 'content_category',
    cfCategoryIds: [164],
    sites: [
      { id: 'netflix', name: 'Netflix', domains: ['netflix.com', 'nflxvideo.net', 'nflximg.net', 'nflxext.com'] },
      { id: 'disneyplus', name: 'Disney+', domains: ['disneyplus.com', 'disney-plus.net', 'dssott.com', 'bamgrid.com'] },
      { id: 'hulu', name: 'Hulu', domains: ['hulu.com', 'hulustream.com', 'huluim.com'] },
      { id: 'twitch', name: 'Twitch', domains: ['twitch.tv', 'twitchcdn.net', 'jtvnw.net'] },
      { id: 'primevideo', name: 'Prime Video', domains: ['primevideo.com', 'amazonvideo.com'] },
      { id: 'crunchyroll', name: 'Crunchyroll', domains: ['crunchyroll.com', 'vrv.co'] },
    ]
  },
  {
    id: 'ads-trackers',
    name: 'Ads & Trackers',
    description: 'Switch off ads and tracking',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>`,
    defaultOn: false,
    cfType: 'content_category',
    cfCategoryIds: [66],
    sites: [
      { id: 'google-ads', name: 'Google Ads', domains: ['doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'googletagmanager.com'] },
      { id: 'facebook-ads', name: 'Meta Ads', domains: ['facebook.net', 'fbsbx.com'] },
      { id: 'amazon-ads', name: 'Amazon Ads', domains: ['amazon-adsystem.com', 'aax.amazon.com'] },
      { id: 'tiktok-ads', name: 'TikTok Ads', domains: ['analytics.tiktok.com', 'ads.tiktok.com'] },
      { id: 'generic-trackers', name: 'Trackers', domains: ['hotjar.com', 'mixpanel.com', 'segment.io', 'amplitude.com', 'fullstory.com'] },
      { id: 'analytics', name: 'Analytics', domains: ['google-analytics.com', 'analytics.google.com', 'clarity.ms', 'plausible.io'] },
    ]
  },
  {
    id: 'adult-content',
    name: 'Adult Content',
    description: 'Switch off adult material',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`,
    defaultOn: false,
    cfType: 'content_category',
    cfCategoryIds: [67, 125, 133],
    sites: [
      { id: 'pornhub', name: 'Pornhub', domains: ['pornhub.com', 'phncdn.com'] },
      { id: 'xvideos', name: 'XVideos', domains: ['xvideos.com', 'xnxx.com'] },
      { id: 'onlyfans', name: 'OnlyFans', domains: ['onlyfans.com'] },
      { id: 'xhamster', name: 'xHamster', domains: ['xhamster.com'] },
      { id: 'redtube', name: 'RedTube', domains: ['redtube.com'] },
      { id: 'chaturbate', name: 'Chaturbate', domains: ['chaturbate.com'] },
    ]
  },
  {
    id: 'gambling',
    name: 'Gambling',
    description: 'Switch off betting and gambling',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="4"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/><circle cx="16" cy="8" r="1.5" fill="currentColor"/><circle cx="8" cy="16" r="1.5" fill="currentColor"/><circle cx="16" cy="16" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>`,
    defaultOn: false,
    cfType: 'content_category',
    cfCategoryIds: [99],
    sites: [
      { id: 'bet365', name: 'Bet365', domains: ['bet365.com'] },
      { id: 'draftkings', name: 'DraftKings', domains: ['draftkings.com'] },
      { id: 'fanduel', name: 'FanDuel', domains: ['fanduel.com'] },
      { id: 'betfair', name: 'Betfair', domains: ['betfair.com'] },
      { id: 'williamhill', name: 'William Hill', domains: ['williamhill.com'] },
      { id: 'paddypower', name: 'Paddy Power', domains: ['paddypower.com'] },
      { id: 'pokerstars', name: 'PokerStars', domains: ['pokerstars.com', 'pokerstars.net'] },
      { id: 'ladbrokes', name: 'Ladbrokes', domains: ['ladbrokes.com'] },
    ]
  },
  {
    id: 'gaming',
    name: 'Gaming',
    description: 'Switch off gaming platforms',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="6"/><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><circle cx="15" cy="11" r="0.5" fill="currentColor" stroke="none"/><circle cx="17" cy="13" r="0.5" fill="currentColor" stroke="none"/></svg>`,
    defaultOn: false,
    cfType: 'domain',
    cfCategoryIds: [],
    sites: [
      { id: 'steam', name: 'Steam', domains: ['store.steampowered.com', 'steampowered.com', 'steamcommunity.com', 'steamstatic.com'] },
      { id: 'epic', name: 'Epic Games', domains: ['epicgames.com', 'unrealengine.com', 'fortnite.com'] },
      { id: 'roblox', name: 'Roblox', domains: ['roblox.com', 'rbxcdn.com'] },
      { id: 'riot', name: 'Riot Games', domains: ['riotgames.com', 'leagueoflegends.com'] },
      { id: 'ea', name: 'EA Games', domains: ['ea.com', 'origin.com'] },
      { id: 'minecraft', name: 'Minecraft', domains: ['minecraft.net', 'mojang.com'] },
    ]
  },
  {
    id: 'news',
    name: 'News & Doomscrolling',
    description: 'Switch off news and doomscrolling',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><line x1="10" y1="6" x2="18" y2="6"/><line x1="10" y1="10" x2="18" y2="10"/><line x1="10" y1="14" x2="14" y2="14"/></svg>`,
    defaultOn: false,
    cfType: 'content_category',
    cfCategoryIds: [122],
    sites: [
      { id: 'cnn', name: 'CNN', domains: ['cnn.com', 'cnn.io'] },
      { id: 'bbc-news', name: 'BBC News', domains: ['bbc.co.uk', 'bbc.com', 'bbci.co.uk'] },
      { id: 'foxnews', name: 'Fox News', domains: ['foxnews.com', 'foxbusiness.com'] },
      { id: 'dailymail', name: 'Daily Mail', domains: ['dailymail.co.uk', 'mailonline.com'] },
      { id: 'nytimes', name: 'NY Times', domains: ['nytimes.com', 'nyt.com'] },
      { id: 'theguardian', name: 'The Guardian', domains: ['theguardian.com', 'guim.co.uk'] },
      { id: 'buzzfeed', name: 'BuzzFeed', domains: ['buzzfeed.com', 'buzzfeednews.com'] },
      { id: 'huffpost', name: 'HuffPost', domains: ['huffpost.com', 'huffingtonpost.com'] },
    ]
  },
  {
    id: 'dating',
    name: 'Dating',
    description: 'Switch off dating apps and sites',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
    defaultOn: false,
    cfType: 'domain',
    cfCategoryIds: [],
    sites: [
      { id: 'tinder', name: 'Tinder', domains: ['tinder.com', 'gotinder.com'] },
      { id: 'bumble', name: 'Bumble', domains: ['bumble.com'] },
      { id: 'hinge', name: 'Hinge', domains: ['hinge.co'] },
      { id: 'match', name: 'Match.com', domains: ['match.com'] },
      { id: 'okcupid', name: 'OkCupid', domains: ['okcupid.com'] },
      { id: 'grindr', name: 'Grindr', domains: ['grindr.com'] },
    ]
  },
  {
    id: 'shopping',
    name: 'Shopping',
    description: 'Switch off online shopping',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`,
    defaultOn: false,
    cfType: 'domain',
    cfCategoryIds: [],
    sites: [
      { id: 'amazon', name: 'Amazon', domains: ['amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.fr'] },
      { id: 'ebay', name: 'eBay', domains: ['ebay.com', 'ebay.co.uk'] },
      { id: 'aliexpress', name: 'AliExpress', domains: ['aliexpress.com'] },
      { id: 'shein', name: 'Shein', domains: ['shein.com', 'shein.co.uk'] },
      { id: 'temu', name: 'Temu', domains: ['temu.com'] },
      { id: 'asos', name: 'ASOS', domains: ['asos.com'] },
      { id: 'etsy', name: 'Etsy', domains: ['etsy.com'] },
      { id: 'wish', name: 'Wish', domains: ['wish.com'] },
    ]
  },
  {
    id: 'ai',
    name: 'AI',
    description: 'Switch off AI chatbots and tools',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/><path d="M16 14h.01"/><path d="M8 14h.01"/><path d="M12 18v4"/><path d="M8 22h8"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M12 2V0"/></svg>`,
    defaultOn: false,
    cfType: 'domain',
    cfCategoryIds: [],
    sites: [
      { id: 'chatgpt', name: 'ChatGPT', domains: ['chat.openai.com', 'chatgpt.com', 'openai.com'] },
      { id: 'claude', name: 'Claude', domains: ['claude.ai', 'anthropic.com'] },
      { id: 'gemini', name: 'Gemini', domains: ['gemini.google.com', 'bard.google.com'] },
      { id: 'copilot', name: 'Copilot', domains: ['copilot.microsoft.com', 'bing.com'] },
      { id: 'perplexity', name: 'Perplexity', domains: ['perplexity.ai'] },
      { id: 'midjourney', name: 'Midjourney', domains: ['midjourney.com'] },
      { id: 'character-ai', name: 'Character.AI', domains: ['character.ai', 'beta.character.ai'] },
      { id: 'poe', name: 'Poe', domains: ['poe.com'] },
    ]
  },
  {
    id: 'crypto',
    name: 'Crypto',
    description: 'Switch off crypto exchanges and wallets',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    defaultOn: false,
    cfType: 'domain',
    cfCategoryIds: [],
    sites: [
      { id: 'coinbase', name: 'Coinbase', domains: ['coinbase.com'] },
      { id: 'binance', name: 'Binance', domains: ['binance.com', 'binance.us'] },
      { id: 'crypto-com', name: 'Crypto.com', domains: ['crypto.com'] },
      { id: 'kraken', name: 'Kraken', domains: ['kraken.com'] },
      { id: 'opensea', name: 'OpenSea', domains: ['opensea.io'] },
      { id: 'metamask', name: 'MetaMask', domains: ['metamask.io'] },
      { id: 'coingecko', name: 'CoinGecko', domains: ['coingecko.com'] },
      { id: 'coinmarketcap', name: 'CoinMarketCap', domains: ['coinmarketcap.com'] },
    ]
  },
  {
    id: 'security-threats',
    name: 'Security Threats',
    description: 'Switch off malware, phishing, and spyware',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1"/></svg>`,
    defaultOn: true,
    cfType: 'security_category',
    cfCategoryIds: [68, 178, 80, 83, 176, 175, 117, 131, 134, 151, 153],
    sites: [
      { id: 'malware', name: 'Malware', domains: [] },
      { id: 'phishing', name: 'Phishing', domains: [] },
      { id: 'spyware', name: 'Spyware', domains: [] },
      { id: 'cryptomining', name: 'Cryptomining', domains: [] },
      { id: 'botnet', name: 'Botnets', domains: [] },
      { id: 'command-control', name: 'C&C Servers', domains: [] },
    ]
  },
];

// Generate Cloudflare Gateway traffic expression from selections
export function generatePolicies(state) {
  const policies = [];

  for (const category of categories) {
    const catState = state[category.id];
    if (!catState || !catState.enabled) continue;

    // Check if all sites are selected or individual picks
    const allSitesOn = category.sites.length === 0 ||
      category.sites.every(s => catState.sites?.[s.id] !== false);

    if (allSitesOn && category.cfType === 'content_category') {
      policies.push({
        name: `FuseBoard - Off ${category.name}`,
        action: 'block',
        traffic: `any(dns.content_category[*] in {${category.cfCategoryIds.join(' ')}})`,
        enabled: true,
      });
    } else if (allSitesOn && category.cfType === 'security_category') {
      policies.push({
        name: `FuseBoard - Off ${category.name}`,
        action: 'block',
        traffic: `any(dns.security_category[*] in {${category.cfCategoryIds.join(' ')}})`,
        enabled: true,
      });
    } else {
      // Individual site selection — use domain-based rules
      const selectedDomains = category.sites
        .filter(s => catState.sites?.[s.id] !== false)
        .flatMap(s => s.domains);

      if (selectedDomains.length > 0) {
        const domainList = selectedDomains.map(d => `"${d}"`).join(' ');
        policies.push({
          name: `FuseBoard - Off ${category.name} (Custom)`,
          action: 'block',
          traffic: `any(dns.domains[*] in {${domainList}})`,
          enabled: true,
        });
      }
    }
  }

  return policies;
}

// Generate policies for custom domains
export function generateCustomPolicy(domains) {
  if (!domains || domains.length === 0) return null;
  const domainList = domains.map(d => `"${d}"`).join(' ');
  return {
    name: 'FuseBoard - Custom Sites Off',
    action: 'block',
    traffic: `any(dns.domains[*] in {${domainList}})`,
    enabled: true,
  };
}
