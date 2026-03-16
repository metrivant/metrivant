// ── Historical Intelligence Stories ──────────────────────────────────────────
//
// Catalog of real-world competitive intelligence case studies.
// Used by HistoricalCapsule to teach users why early signal detection matters.
//
// Each story maps to a draggable panel in the radar dashboard.
// Stories are session-deduplicated and randomly ordered.

export type StoryCategory =
  | "collapse"    // company destroyed by missed competitive signals
  | "disruption"  // entire industry disrupted by ignored movement
  | "blindside"   // incumbent blindsided by product launch
  | "misread"     // strategic misread of competitor intent
  | "pivot";      // missed pivot that proved fatal

export type IllustrationKey =
  | "store"      // retail / physical collapse
  | "camera"     // media / film / photography
  | "phone"      // mobile / device transition
  | "glass"      // search / intelligence / direction
  | "deal"       // failed acquisition or partnership
  | "clock"      // timing / too late
  | "server"     // infrastructure / tech platform
  | "map"        // navigation / platform maps
  | "book"       // knowledge / encyclopedia
  | "chart";     // financial / market crash

export type IntelStory = {
  id: string;
  title: string;
  short_hook: string;
  era: string;
  category: StoryCategory;
  illustration: IllustrationKey;
  accent: string;         // hex color for illustration accent
  key_points: [string, string, string];
  lesson: string;
  signals_missed: string[];
  ai_expansion_prompt: string;
};

export const INTEL_STORIES: IntelStory[] = [

  // ── Retail & Media ────────────────────────────────────────────────────────

  {
    id: "blockbuster-netflix",
    title: "The $50M Handshake They Refused",
    short_hook: "In 2000, Netflix offered to sell itself to Blockbuster for $50M. Blockbuster laughed.",
    era: "1997–2010",
    category: "collapse",
    illustration: "store",
    accent: "#3B82F6",
    key_points: [
      "Netflix's subscriber growth was publicly reported — 300K in 2000, 10M by 2009",
      "Blockbuster's own data showed late fees drove 21% of revenue but caused 75% of complaints",
      "Streaming patent filings and DVD-by-mail adoption were visible signals from 2001 onward",
    ],
    lesson: "The signals were public, the trend was clear — the decision was to ignore it.",
    signals_missed: [
      "Netflix quarterly subscriber growth disclosures",
      "Customer satisfaction surveys showing late fee resentment",
      "Broadband adoption rate projections (publicly available from FCC)",
      "Content licensing deals Netflix was quietly signing with studios",
    ],
    ai_expansion_prompt:
      "Tell the story of Blockbuster vs Netflix as a competitive intelligence case study. Cover: (1) the signals Blockbuster could have detected between 1997–2005 using monitoring of Netflix's pricing pages, press releases, and licensing announcements, (2) the 2000 acquisition meeting where Blockbuster's CEO laughed Reed Hastings out of the room, (3) the year-by-year timeline of when Blockbuster could still have pivoted, (4) what specific page changes or announcements a radar like Metrivant would have flagged as high-urgency signals. Make it educational and connect every missed signal to a concrete action Blockbuster could have taken.",
  },

  {
    id: "kodak-digital",
    title: "The Invention They Buried Alive",
    short_hook: "Kodak's own engineer invented the digital camera in 1975. The company shelved it to protect film revenue.",
    era: "1975–2012",
    category: "blindside",
    illustration: "camera",
    accent: "#F59E0B",
    key_points: [
      "Steve Sasson built the first digital camera at Kodak in 1975 — management called it 'cute'",
      "Digital camera unit sales overtook film camera sales by 2003, a decade of visible trend",
      "Sony, Canon, and Fuji were all publicly expanding digital R&D while Kodak monitored film margins",
    ],
    lesson: "Internal invention without strategic action is the same as no invention at all.",
    signals_missed: [
      "Sony Mavica digital camera launch (1981) and subsequent pricing drops",
      "Canon, Nikon digital SLR roadmap announcements",
      "Retail shelf data showing film purchasing plateau in major markets",
      "Fuji's aggressive digital investment press coverage from 1999 onward",
    ],
    ai_expansion_prompt:
      "Tell the Kodak digital photography story as a competitive intelligence failure. Cover: (1) the internal 1975 invention and why management suppressed it, (2) the competitor signals from Sony, Canon, and Fuji that should have forced action in the 1990s, (3) the exact moment the trend became irreversible (around 2002–2003), (4) what a competitive radar would have flagged from public sources — product announcements, pricing page changes, patent filings. Explain why Kodak's focus on protecting existing revenue made them blind to competitor movement.",
  },

  {
    id: "nokia-iphone",
    title: "The Brick Phone Empire's Last Stand",
    short_hook: "Nokia controlled 40% of the global phone market in 2007. The iPhone launched that same year.",
    era: "2005–2013",
    category: "disruption",
    illustration: "phone",
    accent: "#EF4444",
    key_points: [
      "Apple filed multi-touch patent applications in 2004 — three years before the iPhone launch",
      "Nokia's internal research had prototyped touchscreen phones but prioritized hardware keyboards",
      "App store economics were being experimented by Palm, Microsoft, and carriers — publicly",
    ],
    lesson: "Nokia saw the signals. Their own engineers prototyped touchscreens. The organization chose not to act.",
    signals_missed: [
      "Apple multi-touch patent applications (2004–2006)",
      "Consumer satisfaction surveys showing frustration with T9 keyboards",
      "Google's acquisition of Android Inc. in 2005 and subsequent hiring surge",
      "App developer migration away from Symbian and toward web-based platforms",
    ],
    ai_expansion_prompt:
      "Tell the Nokia collapse story as a competitive intelligence case study. Cover: (1) the Apple multi-touch patents filed 2004–2006 that were public record, (2) Google's 2005 Android acquisition and what that signaled, (3) Nokia's internal touchscreen prototypes that were cancelled, (4) the hiring signals and developer conference shifts that indicated the ecosystem was moving away from Symbian. Explain how a systematic competitor monitoring approach would have aggregated these signals into a high-urgency movement indicator by 2006.",
  },

  {
    id: "yahoo-google",
    title: "When Yahoo Chose to Be a Media Company",
    short_hook: "Yahoo had multiple chances to buy Google for under $5B. Each time, they declined.",
    era: "1998–2008",
    category: "misread",
    illustration: "glass",
    accent: "#8B5CF6",
    key_points: [
      "Google approached Yahoo for acquisition in 2002 — asking price was $1B, Yahoo countered $500M, talks collapsed",
      "Yahoo's search market share dropped from 30% to 17% between 2005–2008 while Google grew",
      "Google's AdWords revenue growth was publicly reported every quarter — the trajectory was visible",
    ],
    lesson: "Misreading a competitor as a potential acquisition target rather than an existential threat is a fatal category error.",
    signals_missed: [
      "Google AdWords quarterly revenue growth disclosures",
      "Search market share shift data from comScore and Nielsen (public)",
      "Google's aggressive hiring across advertising and infrastructure engineering",
      "PageRank patent filings and academic paper citations indicating technical superiority",
    ],
    ai_expansion_prompt:
      "Tell the Yahoo vs Google story as a competitive intelligence failure. Cover: (1) the 2002 acquisition talks and why Yahoo's leadership underestimated Google, (2) the year-by-year signals Yahoo could have monitored — AdWords revenue, search share, engineer hiring velocity, (3) the 2008 Microsoft $44B acquisition offer that Yahoo also rejected (and Google actively lobbied against), (4) how systematic monitoring of Google's pricing page changes, product launches, and job postings would have indicated the scale of the threat much earlier.",
  },

  {
    id: "blackberry-iphone",
    title: "The Keyboard That Wouldn't Bend",
    short_hook: "BlackBerry's CEO held an iPhone in 2007 and said the battery life would never satisfy business users. RIM was worth $83B in 2008. Then $400M by 2016.",
    era: "2007–2016",
    category: "disruption",
    illustration: "phone",
    accent: "#F97316",
    key_points: [
      "RIM's own enterprise customers were requesting consumer-grade UI features by 2008",
      "App developer interest in iPhone SDK (announced 2008) far exceeded BlackBerry's developer stats",
      "IT department surveys showed employees increasingly requesting personal iPhone use for work",
    ],
    lesson: "Defining your moat by a feature your competitor is eliminating is a signal of imminent disruption.",
    signals_missed: [
      "iPhone SDK launch and App Store developer enrollment numbers (public)",
      "Enterprise IT policy surveys showing BYOD pressure increasing",
      "Consumer satisfaction scores for BlackBerry UI declining vs iPhone (J.D. Power public reports)",
      "Carrier negotiations favoring iPhone's data plan model over BlackBerry's BES server model",
    ],
    ai_expansion_prompt:
      "Tell the BlackBerry vs iPhone story as a competitive intelligence case study. Cover: (1) the specific signals in 2007–2009 that indicated the enterprise market was shifting, (2) the App Store launch and developer adoption metrics that should have been alarming to RIM, (3) the BYOD trend and IT policy shifts that were documented in industry reports, (4) how competitor page monitoring — specifically Apple's developer portal updates, pricing page changes, enterprise page copy changes — would have provided early warning. Include the quote from Mike Lazaridis about iPhone battery life and explain what signals he was filtering out.",
  },

  {
    id: "myspace-facebook",
    title: "The Social Network That Forgot About People",
    short_hook: "MySpace had 75M users and a $580M News Corp acquisition. Facebook had 100K college students. Within four years, the positions were reversed.",
    era: "2006–2011",
    category: "collapse",
    illustration: "chart",
    accent: "#3B82F6",
    key_points: [
      "Facebook's university rollout strategy was documented in press coverage from 2004 onward",
      "MySpace user engagement metrics were declining while page view counts still looked healthy",
      "Facebook's clean profile design vs MySpace's customizable chaos was measurable via user research",
    ],
    lesson: "Vanity metrics (page views, registered accounts) masked the engagement signal that mattered.",
    signals_missed: [
      "Facebook's campus-by-campus expansion announcements (trackable, public)",
      "Time-on-site and engagement metrics diverging from raw traffic (published research)",
      "Developer platform interest shifting to Facebook API after its 2007 launch",
      "Advertiser pricing premium for Facebook vs MySpace placements",
    ],
    ai_expansion_prompt:
      "Tell the MySpace vs Facebook story as a competitive intelligence failure. Cover: (1) the signals from Facebook's methodical university expansion (2004–2006) that indicated a superior network effect model, (2) the 2007 Facebook Platform launch and developer ecosystem signals, (3) how advertiser willingness-to-pay divergence between the two platforms was a leading indicator of which network was winning, (4) what MySpace's product team could have monitored on Facebook's public pages — pricing, features, developer docs — to detect the strategic threat earlier.",
  },

  {
    id: "borders-amazon",
    title: "The Bookstore That Outsourced Its Future",
    short_hook: "In 2001, Borders outsourced its online sales to Amazon. By 2011, Borders was bankrupt.",
    era: "2001–2011",
    category: "collapse",
    illustration: "store",
    accent: "#6366F1",
    key_points: [
      "Borders signed a 10-year deal with Amazon to run its online store, ceding digital customer data",
      "Amazon's book pricing page was aggressively updated to undercut physical retail by 20–40%",
      "Kindle launch in 2007 was preceded by years of public Amazon investment in e-reader technology",
    ],
    lesson: "Outsourcing a channel to your competitor to reduce short-term cost is a strategic concession you cannot recover.",
    signals_missed: [
      "Amazon pricing page changes showing systematic undercutting of physical book prices",
      "Amazon's job postings for hardware engineers 3 years before Kindle launch",
      "E-reader patent filings from Sony, Amazon, and others from 2004 onward",
      "Declining foot traffic data in mall-based bookstores (publicly available retail reports)",
    ],
    ai_expansion_prompt:
      "Tell the Borders vs Amazon story as a competitive intelligence case study focused on the fatal outsourcing decision. Cover: (1) the 2001 decision to let Amazon run Borders.com and what competitive intelligence data was available at that time, (2) Amazon's pricing strategy signals visible from their pricing page throughout the 2000s, (3) the Kindle launch signals that were detectable 2–3 years in advance through patent filings and job postings, (4) how systematic monitoring of Amazon's product and pricing pages, hiring patterns, and press releases would have shown the existential threat by 2005.",
  },

  // ── Technology Platforms ──────────────────────────────────────────────────

  {
    id: "netscape-ie",
    title: "The Browser That Became a Bundling Lesson",
    short_hook: "Netscape had 80% browser market share in 1996. Microsoft shipped Internet Explorer free with Windows. By 1998, the war was over.",
    era: "1994–1998",
    category: "disruption",
    illustration: "server",
    accent: "#06B6D4",
    key_points: [
      "Microsoft's IE development team size grew from 6 to 1,000 engineers in 18 months — visibly",
      "Windows 95 licensing agreements required OEMs to bundle IE — contract terms that leaked to press",
      "Netscape's revenue model depended on browser sales that bundling would immediately destroy",
    ],
    lesson: "When a competitor with an installed-base advantage announces 'free', model the revenue impact before it ships.",
    signals_missed: [
      "Microsoft IE team hiring surge visible through job postings and conference appearances",
      "OEM licensing negotiations reported in industry press (InfoWorld, PC Magazine)",
      "Microsoft's public statements about internet strategy throughout 1995 ('internet tidal wave' memo was internal but signaled strategic priority)",
      "IE pricing announcements and feature roadmap at developer conferences",
    ],
    ai_expansion_prompt:
      "Tell the Netscape vs Internet Explorer story as a competitive intelligence case study. Cover: (1) the specific signals from 1994–1996 that Microsoft was making IE a strategic priority, (2) the OEM bundling strategy and how it was visible in licensing negotiations reported in trade press, (3) the developer conference signals where Microsoft was telegraphing its internet strategy, (4) how monitoring Microsoft's careers page, developer documentation updates, and pricing announcements would have shown the bundling threat clearly before it destroyed Netscape's business model.",
  },

  {
    id: "mapquest-google-maps",
    title: "The Map That Forgot to Update Itself",
    short_hook: "MapQuest had 84% of the online mapping market in 2004. Google Maps launched in 2005 and never looked back.",
    era: "2004–2009",
    category: "disruption",
    illustration: "map",
    accent: "#10B981",
    key_points: [
      "Google acquired Keyhole (satellite imagery) in 2004 — the exact capability MapQuest lacked",
      "Google Maps API launched free for developers in 2005, rapidly building the embedded mapping ecosystem",
      "Google's hiring of mapping engineers and cartographers was trackable through LinkedIn and job boards",
    ],
    lesson: "A free API with better data is not a product decision — it is an ecosystem acquisition strategy.",
    signals_missed: [
      "Google's $35M Keyhole acquisition announcement (2004)",
      "Google Maps API terms — free vs MapQuest's paid licensing model",
      "Satellite/street-level imagery investment signals from Google's infrastructure announcements",
      "Developer adoption metrics for Google Maps API in early web 2.0 apps",
    ],
    ai_expansion_prompt:
      "Tell the MapQuest vs Google Maps story as a competitive intelligence failure. Cover: (1) the Google-Keyhole acquisition in 2004 and what it signaled about Google's mapping ambitions, (2) the Google Maps API free launch strategy and why making it free was a competitive moat signal, (3) the satellite imagery and street view investment signals visible from Google's announcements, (4) what monitoring Google's product and developer pages from 2004 onward would have revealed about the threat to MapQuest's paid API model.",
  },

  {
    id: "encarta-wikipedia",
    title: "The Encyclopedia That Couldn't Be Crowdsourced",
    short_hook: "Microsoft Encarta was the dominant digital encyclopedia. Wikipedia launched in 2001. By 2009, Microsoft shut Encarta down completely.",
    era: "2001–2009",
    category: "disruption",
    illustration: "book",
    accent: "#A78BFA",
    key_points: [
      "Wikipedia's article count growth was publicly tracked — it hit 1M English articles by 2006",
      "User-generated content cost structure made Wikipedia's model impossible to compete with on price",
      "Google search result placement for Wikipedia entries was measurable and showed steady gains from 2003",
    ],
    lesson: "When a competitor's cost structure is zero, your pricing strategy is structurally obsolete.",
    signals_missed: [
      "Wikipedia article growth rate (publicly tracked, exponential 2001–2006)",
      "Google SERP ranking data showing Wikipedia displacing Encarta entries",
      "University citation acceptance policies for Wikipedia (indicating trust signal)",
      "Open-source content model adoption rates in adjacent knowledge domains",
    ],
    ai_expansion_prompt:
      "Tell the Microsoft Encarta vs Wikipedia story as a competitive intelligence case study. Cover: (1) the signals from 2001–2004 that Wikipedia's growth rate was accelerating exponentially, (2) the cost structure asymmetry and why Microsoft could not compete on price once Wikipedia became free, (3) Google's SERP placement signals showing Wikipedia winning the distribution battle, (4) what systematic monitoring of Wikipedia's public metrics, Google search trends, and university policy pages would have shown Encarta's team by 2004.",
  },

  {
    id: "altavista-google",
    title: "The Search Engine That Became a Portal",
    short_hook: "AltaVista was the most powerful search engine in 1997. Then it decided to become a web portal instead of a better search engine.",
    era: "1996–2003",
    category: "misread",
    illustration: "glass",
    accent: "#F43F5E",
    key_points: [
      "Google's academic paper on PageRank was published in 1998 — describing a demonstrably superior algorithm",
      "AltaVista deliberately cluttered its homepage with content to compete with Yahoo, abandoning search focus",
      "Google's minimal homepage and faster load time were user satisfaction signals that were measurable",
    ],
    lesson: "Pivoting away from your core competency in response to a competitor's strategy is capitulation disguised as adaptation.",
    signals_missed: [
      "Google's 1998 Stanford paper on PageRank (publicly available academic research)",
      "User satisfaction surveys showing load speed as primary search engine preference driver",
      "AltaVista's own search quality declining as spam index gaming increased",
      "Google's rising press mentions and tech community adoption from 1998–2000",
    ],
    ai_expansion_prompt:
      "Tell the AltaVista vs Google story as a competitive intelligence failure. Cover: (1) the 1998 PageRank paper and what AltaVista's product team could have understood from it, (2) the strategic mistake of copying Yahoo's portal model instead of improving search quality, (3) user adoption signals visible in tech press coverage 1998–2000, (4) how monitoring Google's homepage simplicity as a product signal, their growing press mentions, and developer community adoption would have shown AltaVista's leadership the threat before it was irreversible.",
  },

  {
    id: "palm-ios",
    title: "The Smartphone Pioneer Who Finished Last",
    short_hook: "Palm invented the PDA in 1992 and had the first smartphone-ready OS. Apple, Google, and Microsoft all built on Palm's foundational ideas — and then replaced it.",
    era: "2002–2010",
    category: "disruption",
    illustration: "phone",
    accent: "#8B5CF6",
    key_points: [
      "Palm had 1M developers on its platform in 2007 — they all migrated to iPhone and Android by 2010",
      "Palm's WebOS was technically praised but launched 18 months after the iPhone, chasing instead of leading",
      "HP acquired Palm for $1.2B in 2010 and discontinued WebOS 18 months later",
    ],
    lesson: "Technical merit without ecosystem timing is a product without a market.",
    signals_missed: [
      "Apple developer conference announcements and iPhone SDK terms (2008)",
      "Google Android developer program launch and OEM partnership announcements",
      "Developer migration signals from Palm forums and conference attendance data",
      "Carrier negotiation outcomes favoring iPhone and Android device subsidies over Palm",
    ],
    ai_expansion_prompt:
      "Tell the Palm vs iOS/Android story as a competitive intelligence case study. Cover: (1) the iPhone SDK launch signals in 2008 and why Palm's developer ecosystem was at risk, (2) Google's Android OEM partnership announcements and what they meant for Palm's hardware business, (3) developer conference attendance and sentiment signals from Palm's own platform events, (4) how monitoring Apple's developer portal updates, Android partner announcements, and carrier negotiation press releases would have shown the ecosystem collapse coming.",
  },

  // ── Failed Acquisitions & Strategic Missteps ──────────────────────────────

  {
    id: "yahoo-microsoft-offer",
    title: "The $44 Billion 'No'",
    short_hook: "Microsoft offered to buy Yahoo for $44.6B in 2008. Yahoo turned it down. Today Yahoo is worth about $5B.",
    era: "2008",
    category: "misread",
    illustration: "deal",
    accent: "#F59E0B",
    key_points: [
      "Google publicly lobbied against the merger — a clear competitive signal of how threatening it would be",
      "Yahoo's board rejected the offer at $31/share; the stock never returned to that level",
      "Microsoft's subsequent Bing launch and Yahoo search deal (2009) was worth a fraction of the acquisition",
    ],
    lesson: "When your main competitor actively opposes an acquisition, that is a signal of its strategic value.",
    signals_missed: [
      "Google's lobbying activity and public statements against the Yahoo-Microsoft deal",
      "Yahoo search market share trajectory showing continued decline",
      "Microsoft's own search traffic and ad revenue signals showing the strategic need",
      "Post-rejection stock performance data that validated Microsoft's valuation thesis",
    ],
    ai_expansion_prompt:
      "Tell the Yahoo-Microsoft acquisition story as a competitive intelligence case study. Focus on: (1) why Google's lobbying against the deal was a signal of its strategic importance, (2) the search market share trajectory data available before and during the negotiation, (3) what Microsoft's subsequent Bing investment signals revealed about their strategic intent, (4) how monitoring Google's ad revenue announcements, search market share reports, and competitive statements would have helped Yahoo's board understand the real value of the deal being declined.",
  },

  {
    id: "blockbuster-final-chance",
    title: "The Year Blockbuster Almost Won",
    short_hook: "In 2004, Blockbuster launched Total Access — a service better than Netflix. Their own board killed it to protect store revenue.",
    era: "2004–2007",
    category: "pivot",
    illustration: "clock",
    accent: "#06B6D4",
    key_points: [
      "Blockbuster's Total Access program had more subscribers than Netflix by Q1 2007 — they were winning",
      "The board fired the CEO who built Total Access and reinstated store-first strategy in 2007",
      "Netflix's price dropped from $21.99 to $9.99/month in 2008 — the exact move Blockbuster could have countered",
    ],
    lesson: "Being right about the strategy and wrong about the internal politics is just as fatal as missing the signal.",
    signals_missed: [
      "Netflix pricing page changes showing aggressive price reduction strategy",
      "Total Access subscriber growth vs store rental revenue (internal, but investor disclosures showed the gap)",
      "Reed Hastings public interviews describing Netflix's long-term streaming strategy",
      "Streaming bandwidth cost trend data showing viability timeline",
    ],
    ai_expansion_prompt:
      "Tell the story of Blockbuster Total Access (2004–2007) as a competitive intelligence case study about internal strategy failure. Cover: (1) the data showing Total Access was outcompeting Netflix on metrics, (2) Netflix's pricing page changes and public statements that indicated their streaming pivot timeline, (3) the board decision to kill Total Access and what signals they were interpreting incorrectly, (4) how monitoring Netflix's pricing page, streaming technology announcements, and executive interview statements would have provided the data needed to defend the Total Access strategy internally.",
  },

  // ── Financial & Market Signals ────────────────────────────────────────────

  {
    id: "dotcom-bubble",
    title: "The Eyeball Economy",
    short_hook: "In 1999, companies with no revenue and only 'eyeballs' had billion-dollar valuations. Then, in 18 months, $5 trillion in market value evaporated.",
    era: "1999–2001",
    category: "misread",
    illustration: "chart",
    accent: "#EF4444",
    key_points: [
      "P/E ratios across the NASDAQ averaged 200x in early 2000 — a signal visible in public filings",
      "Customer acquisition costs were exceeding lifetime customer values at dozens of public companies",
      "Pets.com spent $1.20 to acquire $1 of revenue — their financials were in their public prospectus",
    ],
    lesson: "Public financial filings contain the signal. Most people choose not to read them.",
    signals_missed: [
      "Public S-1 filings showing negative unit economics at scale",
      "Customer acquisition cost to lifetime value ratios disclosed in earnings reports",
      "Inventory and burn rate data in quarterly filings showing survival timelines",
      "Federal Reserve interest rate signals indicating the cost of capital was about to change",
    ],
    ai_expansion_prompt:
      "Tell the dot-com bubble as a competitive intelligence and signal-reading failure. Cover: (1) the specific metrics in public filings that showed unsustainable economics (CAC vs LTV, burn rates), (2) the competitive signals showing customer acquisition wars were destructive rather than strategic, (3) the macro signals from Federal Reserve policy that indicated the credit environment was changing, (4) how a systematic approach to reading competitor financial filings and pricing page changes would have revealed the structural fragility of the eyeball economy.",
  },

  {
    id: "financial-crisis-2008",
    title: "The Mortgage That Was Watched Globally",
    short_hook: "The 2008 financial crisis destroyed $10 trillion in US household wealth. The signals were in public filings, researcher warnings, and default rate data — years before.",
    era: "2005–2008",
    category: "misread",
    illustration: "chart",
    accent: "#DC2626",
    key_points: [
      "Economist Nouriel Roubini predicted the collapse at an IMF conference in 2006 — he was publicly mocked",
      "Subprime delinquency rates were rising visibly from 2006 in Federal Reserve reports",
      "Short sellers like Michael Burry were betting against CDOs from 2005 — positions that were public record",
    ],
    lesson: "Contrarian signals from minority analysts are often the most accurate early warning the market provides.",
    signals_missed: [
      "Federal Reserve delinquency rate disclosures showing subprime stress from 2006",
      "CDO tranche pricing divergence from historical correlation models",
      "Short interest data on mortgage-backed securities",
      "Research papers from academic economists on housing price sustainability",
    ],
    ai_expansion_prompt:
      "Tell the 2008 financial crisis as a competitive intelligence failure about ignoring public signals. Cover: (1) the specific public data signals from 2005–2007 that showed systemic risk accumulating, (2) the contrarian analysts who were correct and why their signals were dismissed, (3) the timing of when the signals were unambiguous versus when the crash happened, (4) how systematic monitoring of public financial disclosures, regulatory filings, and market pricing data would have provided actionable warning years before the collapse.",
  },

  // ── AI & Software ─────────────────────────────────────────────────────────

  {
    id: "ai-disruption-saas",
    title: "The SaaS Stack That Became Prompts",
    short_hook: "Enterprise software companies spent a decade building complex workflows. Then GPT-4 shipped, and a single API call could replace whole product categories.",
    era: "2022–2024",
    category: "disruption",
    illustration: "server",
    accent: "#2EE6A6",
    key_points: [
      "OpenAI's GPT-4 launch pricing was 100x cheaper per task than the equivalent human workflow cost",
      "Startup companies building LLM-native replacements for category leaders were visible on GitHub and Product Hunt",
      "Enterprise software companies' own changelog pages showed AI features being added reactively, not leading",
    ],
    lesson: "When a new technology makes your pricing model look expensive and your complexity look unnecessary, the category is repricing.",
    signals_missed: [
      "OpenAI API pricing page changes showing rapid cost reduction quarter-over-quarter",
      "GitHub repository creation rates for LLM-based alternatives to established SaaS tools",
      "Product Hunt leaderboard patterns showing AI-native competitors entering every category",
      "Job posting shifts at incumbents — adding 'AI' to existing roles rather than building new ones",
    ],
    ai_expansion_prompt:
      "Tell the AI disruption of SaaS as a competitive intelligence story happening in real time. Cover: (1) the OpenAI pricing page signals from 2022–2024 showing API costs dropping dramatically, (2) the GitHub and Product Hunt signals showing AI-native competitors entering established categories, (3) the job posting signals showing which incumbents were adapting vs reacting, (4) how monitoring OpenAI's API pricing page, model announcement blog posts, and competitor changelog pages would have given SaaS incumbents early warning of which product categories were most at risk.",
  },

  {
    id: "ibm-pc-microsoft",
    title: "The Operating System IBM Didn't Want",
    short_hook: "IBM hired Microsoft to provide an OS for the PC. IBM retained hardware rights. Microsoft retained software rights. It was the most consequential licensing deal in technology history.",
    era: "1980–1995",
    category: "misread",
    illustration: "server",
    accent: "#3B82F6",
    key_points: [
      "Microsoft's retention of OS licensing rights was in the publicly filed agreement — IBM dismissed it as immaterial",
      "Clone manufacturers began shipping IBM-compatible PCs by 1982 — a visible market signal",
      "IBM's own customer surveys showed software compatibility was the primary hardware purchase driver",
    ],
    lesson: "The most dangerous competitive terms are the ones you negotiate away because you don't believe they matter yet.",
    signals_missed: [
      "IBM-compatible clone market entry (Compaq, etc.) from 1982 — publicly announced products",
      "Software compatibility becoming primary PC purchase driver in market research",
      "Microsoft's licensing revenue growth vs IBM's hardware margin compression (both in public filings)",
      "OS distribution deals Microsoft was signing with multiple hardware manufacturers",
    ],
    ai_expansion_prompt:
      "Tell the IBM-Microsoft deal as a competitive intelligence case study about misreading strategic value. Cover: (1) why IBM's engineers saw hardware as the value and didn't read the software licensing terms as a threat, (2) the Compaq and clone signals from 1982–1985 that showed the hardware commodity risk, (3) Microsoft's early licensing deal announcements with other manufacturers, (4) how monitoring Microsoft's public licensing announcements, developer conference statements, and clone manufacturer partnerships would have shown IBM's strategic position eroding years before it became irreversible.",
  },

  {
    id: "sears-amazon",
    title: "The Original Everything Store",
    short_hook: "Sears was Amazon before Amazon existed. They pioneered mail-order retail, had catalog logistics, and over 3,000 stores. They filed for bankruptcy in 2018.",
    era: "1994–2018",
    category: "collapse",
    illustration: "store",
    accent: "#64748B",
    key_points: [
      "Sears had a functioning online store in 1996, earlier than most competitors — then deprioritized it",
      "Amazon's pricing page consistently undercut Sears by 15–35% in major categories from 2005 onward",
      "Customer retention and loyalty card data showed Sears losing the 25–40 demographic from 2008",
    ],
    lesson: "The original market leader in a category has every structural advantage — logistics, brand, data. Sometimes that makes the disruption signal harder to believe.",
    signals_missed: [
      "Amazon category expansion signals — each new product category launch announcement",
      "Sears own loyalty program data showing demographic decline in key cohorts",
      "Competitor pricing page monitoring showing systematic undercutting",
      "Real estate data showing declining mall foot traffic trends",
    ],
    ai_expansion_prompt:
      "Tell the Sears collapse as a competitive intelligence story about structural advantages becoming liabilities. Cover: (1) Sears's 1996 early online store and why it was deprioritized, (2) Amazon's category-by-category expansion signals that were visible in product page and pricing launches, (3) demographic and loyalty data signals showing who Sears was losing, (4) how systematically monitoring Amazon's product and pricing page changes, category expansion announcements, and fulfillment center announcements would have shown the competitive threat compounding year by year.",
  },

  // ── Device & Platform ─────────────────────────────────────────────────────

  {
    id: "toys-amazon",
    title: "The Toy Store That Taught Amazon Fulfillment",
    short_hook: "Toys'R'Us signed an exclusive deal with Amazon in 2000 to be the only toy seller on the platform. Amazon then let other sellers list toys anyway. Toys'R'Us sued and won — but lost the war.",
    era: "2000–2017",
    category: "collapse",
    illustration: "store",
    accent: "#F59E0B",
    key_points: [
      "Amazon's third-party seller program grew from 2% to 40% of sales between 2000–2010 — public disclosures",
      "Toys'R'Us's exclusivity lawsuit victory in 2004 cost Amazon nothing strategically",
      "Amazon's own toy category investment signals were visible in their seasonal logistics hiring",
    ],
    lesson: "Winning a legal battle against a platform that controls your distribution is winning the wrong war.",
    signals_missed: [
      "Amazon third-party seller program announcements and growth metrics",
      "Seasonal fulfillment center hiring patterns showing Amazon's own toy inventory expansion",
      "Consumer reviews and product selection data showing Amazon marketplace depth exceeding Toys'R'Us",
      "Amazon Prime membership growth showing customer captivity moving to the platform",
    ],
    ai_expansion_prompt:
      "Tell the Toys'R'Us vs Amazon story as a competitive intelligence failure about platform dependency. Cover: (1) the signals from Amazon's third-party seller program that should have told Toys'R'Us their exclusivity was worthless, (2) the Amazon logistics investment signals showing they were building toy category dominance, (3) the customer captivity signals from Prime membership growth, (4) how monitoring Amazon's pricing pages, third-party seller announcements, and logistics center press releases would have shown the platform relationship turning adversarial.",
  },

  {
    id: "rim-app-ecosystem",
    title: "The Enterprise That Forgot Consumers Exist",
    short_hook: "RIM believed enterprise security would protect BlackBerry forever. Every enterprise IT department then started letting employees bring iPhones to work.",
    era: "2009–2014",
    category: "blindside",
    illustration: "phone",
    accent: "#EF4444",
    key_points: [
      "BYOD (Bring Your Own Device) policy adoption at Fortune 500 companies was documented in HR surveys from 2009",
      "App Store had 100,000 apps by 2009; BlackBerry App World launched the same year with 1,000",
      "Enterprise MDM vendors were publicly building iOS and Android support ahead of BlackBerry support",
    ],
    lesson: "B2B moats built on institutional inertia are disrupted from below — by consumers influencing enterprise procurement.",
    signals_missed: [
      "BYOD policy adoption surveys in enterprise HR publications (publicly available)",
      "Apple App Store app count vs BlackBerry App World — publicly tracked",
      "MDM vendor product roadmaps showing iOS/Android support being prioritized",
      "Enterprise software vendors (Salesforce, Microsoft) releasing iOS apps before BlackBerry apps",
    ],
    ai_expansion_prompt:
      "Tell the RIM/BlackBerry enterprise collapse as a competitive intelligence story about bottom-up disruption. Cover: (1) the BYOD policy signals from 2009–2011 showing enterprise demand shifting to consumer devices, (2) the App Store developer ecosystem signals showing BlackBerry App World was losing the ecosystem war, (3) enterprise software vendor decisions to build iOS apps before BlackBerry apps, (4) how monitoring Apple's enterprise page updates, MDM vendor changelogs, and Salesforce/Microsoft app release announcements would have shown the institutional barrier eroding before BlackBerry's revenue declined.",
  },

  {
    id: "circuit-city",
    title: "The Electronics Retailer That Fired Its Best Staff",
    short_hook: "In 2007, Circuit City laid off 3,400 of its highest-paid hourly workers to cut costs. Best Buy hired them all. Within 18 months, Circuit City filed for bankruptcy.",
    era: "2007–2008",
    category: "collapse",
    illustration: "store",
    accent: "#DC2626",
    key_points: [
      "Best Buy's customer satisfaction scores were already 8 points higher than Circuit City before the layoffs",
      "Circuit City's gross margin was 5 points below Best Buy — a visible gap in public earnings reports",
      "Consumer electronics category margin compression was documented in supplier and retail industry reports",
    ],
    lesson: "Cost-cutting in customer-facing roles when your competitor is investing in customer experience is an acceleration toward irrelevance.",
    signals_missed: [
      "Best Buy earnings reports showing customer satisfaction investments and their revenue impact",
      "Consumer electronics margin compression data in industry analyst reports",
      "Amazon consumer electronics expansion pricing signals — each category where Amazon entered",
      "Real estate and store footprint data showing which format was winning (Best Buy big box vs Circuit City)",
    ],
    ai_expansion_prompt:
      "Tell the Circuit City collapse as a competitive intelligence case study about cost-cutting vs investment signals. Cover: (1) the Best Buy customer satisfaction and investment signals that were visible before Circuit City's layoff decision, (2) Amazon's consumer electronics expansion and pricing page signals that showed margin compression was accelerating, (3) the financial signals in Circuit City's own filings that showed the structural problem couldn't be solved by cost cuts, (4) how monitoring Best Buy's hiring announcements, pricing page changes, and customer service investments alongside Amazon's electronics category expansion would have shown Circuit City the correct strategic response.",
  },

  {
    id: "polaroid-digital",
    title: "The Instant Photo Company That Missed Instant Sharing",
    short_hook: "Polaroid invented instant photography in 1948. They also held digital camera patents in the 1980s. They filed for bankruptcy in 2001.",
    era: "1980–2001",
    category: "blindside",
    illustration: "camera",
    accent: "#F59E0B",
    key_points: [
      "Polaroid held digital imaging patents from the 1980s but couldn't cannibalize film revenue",
      "Digital camera market grew at 80% per year from 1995–2001 — visible in public market reports",
      "Consumer preference for sharing photos digitally was documented in ISP and email usage data",
    ],
    lesson: "Owning the future's patents while protecting the present's revenue is a choice to let someone else own the future.",
    signals_missed: [
      "Digital camera market share growth rate data from Consumer Electronics Association",
      "Competitor pricing page drops showing digital cameras becoming mainstream affordable",
      "Internet adoption rates correlating with consumer shift toward digital sharing",
      "Film development volume data showing plateau then decline",
    ],
    ai_expansion_prompt:
      "Tell the Polaroid story as a competitive intelligence failure about patent ownership vs market timing. Cover: (1) Polaroid's early digital patents and why they didn't use them, (2) the digital camera market growth signals from 1995–2001 that were in public reports, (3) the internet adoption and photo-sharing behavior signals that showed where consumer demand was moving, (4) how monitoring competitor pricing pages for digital cameras, film development volume data, and consumer electronics market reports would have given Polaroid the evidence to justify cannibalizing their own film business before the market did it for them.",
  },

  {
    id: "compaq-dell",
    title: "The Computer That Forgot It Was Selling Efficiency",
    short_hook: "Compaq was the world's largest PC maker in 1995. Dell built computers to order and shipped direct. By 2002, Compaq had merged with HP at a fraction of its peak value.",
    era: "1995–2002",
    category: "disruption",
    illustration: "server",
    accent: "#6366F1",
    key_points: [
      "Dell's build-to-order model eliminated inventory risk — a structural cost advantage visible in margin data",
      "Compaq's channel distribution model had 30–60 day inventory cycles vs Dell's 4-day cycle",
      "Dell's direct sales website was publicly showing faster delivery and lower prices from 1994 onward",
    ],
    lesson: "A competitor with a structurally lower cost base does not need to match your marketing. They just need to wait.",
    signals_missed: [
      "Dell's gross margin reports showing structural cost advantage widening every quarter",
      "Dell's direct pricing page showing consistent price undercuts on identical configurations",
      "Inventory turnover rate differences in public filings — a direct supply chain efficiency signal",
      "Corporate IT procurement surveys showing Dell preference increasing among Fortune 500",
    ],
    ai_expansion_prompt:
      "Tell the Compaq vs Dell story as a competitive intelligence failure about supply chain signals. Cover: (1) the inventory turnover and margin data in public filings that showed Dell's structural cost advantage, (2) Dell's pricing page strategy and how consistent undercutting was a signal not just of pricing but of cost structure, (3) the corporate procurement signals showing Dell winning enterprise accounts, (4) how systematically monitoring Dell's pricing pages, delivery time commitments, and public financial ratios alongside Compaq's own inventory metrics would have shown the structural gap compounding.",
  },

  {
    id: "motorola-razr",
    title: "The Coolest Phone That Forgot to Be Clever",
    short_hook: "The Motorola RAZR sold 130M units and was the coolest phone in the world in 2005. Motorola let it coast. Apple filed 200 patents. History was written in 2007.",
    era: "2005–2008",
    category: "misread",
    illustration: "phone",
    accent: "#F97316",
    key_points: [
      "Apple's design patent filings for phone-shaped devices began in 2005 — publicly available records",
      "Motorola's own consumer research showed satisfaction declining after the RAZR's first year",
      "Carriers were publicly negotiating different device subsidy structures with Apple vs other manufacturers",
    ],
    lesson: "A hit product is a starting point, not an ending point. Every hit is also a clock that starts counting down.",
    signals_missed: [
      "Apple patent filing activity in mobile device design (2005–2006)",
      "Carrier negotiation signals in telecom press about Apple's preferred distributor terms",
      "Consumer electronics trade show announcements showing shrinking innovation from Motorola",
      "Developer community sentiment shifting away from Motorola platforms",
    ],
    ai_expansion_prompt:
      "Tell the Motorola RAZR complacency story as a competitive intelligence failure. Cover: (1) Apple's patent filing signals from 2005–2006 that showed iPhone development in progress, (2) carrier negotiation dynamics that were reported in telecom trade press, (3) consumer satisfaction data showing RAZR excitement fading, (4) how monitoring Apple's patent applications, developer conference announcements, and carrier partner press releases would have shown Motorola that the RAZR's window was closing — and that a fundamentally different device was being prepared.",
  },

  {
    id: "aol-social",
    title: "The Internet That Thought It Was the Internet",
    short_hook: "AOL had 35 million subscribers and delivered the internet to most Americans in the early 2000s. It was acquired for $182B in 2000. By 2015, Verizon bought it for $4.4B.",
    era: "2000–2010",
    category: "misread",
    illustration: "server",
    accent: "#3B82F6",
    key_points: [
      "Broadband adoption rates were published quarterly by FCC — and showed dial-up's structural decline from 2001",
      "AOL's subscriber churn rate was rising while broadband competitor subscriber additions were accelerating",
      "Social networking sites (Friendster, then MySpace) were showing explosive growth from 2003",
    ],
    lesson: "Confusing access infrastructure with destination content is a category error that broadband makes fatal.",
    signals_missed: [
      "FCC broadband adoption rate reports showing quarterly acceleration from 2001",
      "AOL subscriber and churn metrics visible in public earnings reports",
      "Friendster and MySpace user growth rates reported in tech press",
      "Competitor ISP broadband pricing showing AOL's dial-up tier becoming uncompetitive",
    ],
    ai_expansion_prompt:
      "Tell the AOL decline as a competitive intelligence story about infrastructure vs destination confusion. Cover: (1) the FCC broadband data signals from 2001–2004 that showed dial-up's irreversible decline, (2) the social networking signals from Friendster, MySpace, and later Facebook that showed where user time was moving, (3) AOL's own churn metrics and what they indicated about subscriber confidence, (4) how monitoring competitor broadband pricing pages, social platform growth announcements, and content platform launches would have shown AOL's leadership that the dial-up subscription model had a finite lifespan.",
  },

];
