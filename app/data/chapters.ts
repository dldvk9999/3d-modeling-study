// The chapters of the original edition, in order, with the copy each one ships.
// `lead` is the chapter's opening feature; `features` are the cards under it.

export type Feature = {
  title: string;
  body: string;
  cta?: string;
};

export type Chapter = {
  id: string;
  name: string;
  tagline: string;
  /** background palette: [warm, cool] */
  palette: [string, string];
  lead: Feature;
  features: Feature[];
};

export const CHAPTERS: Chapter[] = [
  {
    id: "agentic",
    name: "Agentic",
    tagline: "The only platform you need to be in every AI channel",
    palette: ["#d19a57", "#75a8c2"],
    lead: {
      title: "Your products optimized for AI",
      body: "Shopify gets your products in AI channels automatically. See how you're performing, track sales, and get guidance on what's missing to drive conversion.",
      cta: "Learn about selling in AI",
    },
    features: [
      {
        title: "Product data structured for agents",
        body: "Shopify Catalog automatically standardizes and enriches your product data. Data syndicated by Shopify drives 2x more conversion in AI chats.",
        cta: "Read help doc",
      },
      {
        title: "Checkout on more surfaces",
        body: "Shopping in Copilot, and soon Meta ads, is powered by the Universal Commerce Protocol. Customers can purchase directly in chat and pay with Shop Pay in Copilot.",
        cta: "Read help doc",
      },
      {
        title: "Agentic plan",
        body: "Businesses not on Shopify can sync their products to Shopify Catalog and sell across AI channels and in the Shop app.",
        cta: "Learn more",
      },
      {
        title: "Sponsored products with Catalog API",
        body: "Earn revenue on sales made in your agentic experiences with Catalog API. Developer preview coming soon.",
        cta: "Read dev docs",
      },
      {
        title: "Catalog API image search",
        body: "Agents can pass images directly to the Catalog API to return visually similar products and enhance search capabilities.",
        cta: "Read dev docs",
      },
      {
        title: "Richer product data in agentic experiences",
        body: "Agents can show product details from the Catalog API, including media, variants, availability, and offers from multiple sellers.",
        cta: "Read dev docs",
      },
      {
        title: "The open protocol for agentic commerce",
        body: "Build agentic shopping experiences from discovery to purchase with Catalog, Cart, and Checkout MCPs powered by the Universal Commerce Protocol.",
        cta: "Explore dev docs",
      },
      {
        title: "Catalog API supports Shop sign-in",
        body: "Add Shop sign-in to experiences built with Catalog API, so shoppers can connect their Shop account. Personalized search results coming soon.",
        cta: "Read dev docs",
      },
      {
        title: "Experiences built with Catalog API and UCP",
        body: "Create new ways to shop. Check out our demos: plan for a trip, ask an agent for board games, get inspiration from shows, browse photo lookalikes, and shop your star sign.",
        cta: "Read dev docs",
      },
      {
        title: "Catalog API product lookup",
        body: "Use the product ID or URL to retrieve real-time data, like pricing and availability, for up to 50 products in a single request.",
        cta: "Read dev docs",
      },
    ],
  },
  {
    id: "sidekick",
    name: "Sidekick",
    tagline: "Sidekick works with your apps",
    palette: ["#9d7fd6", "#6f8fd8"],
    lead: {
      title: "Sidekick works with your apps",
      body: "Starting with Judge.me, Klaviyo, Loop, Smile, and more top partners, Sidekick can answer questions about and take action in your apps.",
      cta: "Explore apps",
    },
    features: [
      {
        title: "Actionable guidance from Sidekick",
        body: "Start every admin session with tips to attract customers, improve conversion, and drive repeat sales.",
        cta: "Read help doc",
      },
      {
        title: "Sidekick on Apple Watch",
        body: "Ask Sidekick to look up information about your business from your Apple Watch.",
        cta: "Read help doc",
      },
      {
        title: "Follow-up questions from Sidekick",
        body: "Sidekick presents multiple choice answers when it needs more information, so you can quickly clarify the task.",
        cta: "Read help doc",
      },
      {
        title: "Multi-task with Sidekick",
        body: "Sidekick keeps working in the background, even when you start a new task, run multiple chats, or close the window.",
        cta: "Read help doc",
      },
      {
        title: "Sidekick everywhere in the Shopify app",
        body: "Type or talk with Sidekick on any screen to get help in context as you edit your store from your phone.",
        cta: "Read help doc",
      },
      {
        title: "Automation tests with Sidekick",
        body: "Generate test events for Shopify Flow automations with Sidekick, and verify your logic works.",
        cta: "Read help doc",
      },
      {
        title: "Improved editing for Sidekick-generated apps",
        body: "Edit code, preview on desktop and mobile, and track version history in Sidekick's app editor.",
        cta: "Read help doc",
      },
      {
        title: "Sidekick creates customers",
        body: "Describe your customer in plain language, and Sidekick automatically fills out the form.",
        cta: "Read help doc",
      },
    ],
  },
  {
    id: "online",
    name: "Online",
    tagline: "Your AI sales associate",
    palette: ["#5fb0a6", "#6f8fd8"],
    lead: {
      title: "Your AI sales associate",
      body: "Help drive sales with an AI assistant on your online store from our messaging tool Shopify Inbox. For customers signed in with Shop, it recommends products based on their history.",
      cta: "Get Shopify Inbox",
    },
    features: [
      {
        title: "Storefront search delivers more results",
        body: "Even when shoppers search on your store using typos or unusual phrasing, they'll get relevant results.",
        cta: "Read help doc",
      },
      {
        title: "AI-powered store analysis on any theme",
        body: "Analyze a single theme to get ideas from AI-simulated shoppers on ways to improve your store with SimGym.",
        cta: "Read help doc",
      },
      {
        title: "A/B tests on online store and checkout",
        body: "Publish a new theme, checkout configuration, or customer accounts setup at a scheduled time or as an A/B test using Rollouts.",
        cta: "Read help doc",
      },
      {
        title: "Better online store editing on mobile",
        body: "Edit your store in the Shopify app with controls designed for mobile, a preview that stays on-screen as you edit, and Sidekick built right in.",
        cta: "Read help doc",
      },
      {
        title: "Refreshed customer accounts",
        body: "Customer account pages feature intuitive navigation, branded sign-in, and recommendations for first-time shoppers.",
        cta: "Learn more",
      },
      {
        title: "B2B features on more plans",
        body: "Access company profiles, volume pricing, up to three B2B catalogs, and more from your admin at no extra cost.",
        cta: "Read help doc",
      },
      {
        title: "Visualized markets graph",
        body: "Understand your Shopify Markets setup with a clearer view across discounts, products, and other settings for each market in one graph.",
        cta: "Read help doc",
      },
      {
        title: "Variant-level publishing for products",
        body: "Control which product variants are published by channel and per market without any workarounds.",
        cta: "Read help doc",
      },
      {
        title: "Discounts by market",
        body: "Run targeted promotions for customers across specific regions, different retail locations, and B2B setups.",
        cta: "Read help doc",
      },
      {
        title: "Product compliance disclosure",
        body: "Add mandatory warnings on products and display them on your store, in AI channels, and the Shop app.",
        cta: "Read help doc",
      },
      {
        title: "365-day sessions for customer accounts",
        body: "Customers stay signed in for a full year, making it easier for them to pick up where they left off.",
        cta: "Read help doc",
      },
      {
        title: "Shopify Smart Pricing app",
        body: "Get product-level pricing tips based on your store's sales, inventory, costs, seasonality.",
        cta: "Get app",
      },
    ],
  },
  {
    id: "retail",
    name: "Retail",
    tagline: "Our fastest-ever POS",
    palette: ["#e0894f", "#c2607a"],
    lead: {
      title: "Our fastest-ever POS",
      body: "Save over a minute when creating new customers, adding products, and checking out in a cart that's always present. The line never stops, and staff focus on customers.",
      cta: "Read about our latest version",
    },
    features: [
      {
        title: "Scannable discounts in Shopify POS",
        body: "Generate QR codes in the admin, share them with customers, then scan those codes at checkout to apply discounts in store.",
        cta: "Read help doc",
      },
      {
        title: "Verifone Victa Mobile for Shopify POS",
        body: "Scan barcodes, take payments, and run Shopify POS on the new handheld that doubles as a terminal when docked. Pre-order available for US and Canada.",
        cta: "Pre-order now",
      },
      {
        title: "Returns and exchanges in one cart",
        body: "Process refunds, exchanges, and new sales in one cart with smart grid actions and modular workflows in Shopify POS.",
      },
      {
        title: "In-person pickup orders",
        body: "Create orders for pickup at any retail location in Shopify POS. Notify customers, and mark orders as fulfilled. Exclusive to POS Pro.",
        cta: "Read help doc",
      },
      {
        title: "Multi-entity selling across retail locations",
        body: "Operate multiple retail locations within a single country from different legal entities, all managed from one Shopify store. Exclusive to Shopify Plus.",
        cta: "Read help doc",
      },
      {
        title: "Cash visibility and control in Shopify POS",
        body: "Set cash rules and reason codes, track all drawer opens and activity across registers, require mid-session cash counts, and reconcile with audit trails. Exclusive to POS Pro.",
        cta: "Read help doc",
      },
      {
        title: "Faster search in Shopify POS",
        body: "Find products, customers, and orders faster with inline suggestions and reduced latency across every search page.",
        cta: "Learn more",
      },
      {
        title: "Gift card cashout",
        body: "Cash out low-balance gift cards directly from Shopify POS to meet local redemption laws.",
        cta: "Read help doc",
      },
      {
        title: "Keyboard shortcuts for Shopify POS",
        body: "Build carts and navigate products, orders, and customers faster with a keyboard.",
        cta: "Read help doc",
      },
      {
        title: "In-store only discounts",
        body: "Create code-based and automatic discounts that only apply in person, keeping in-store promotions separate from online.",
        cta: "Read help doc",
      },
      {
        title: "Receive and fulfill transfers",
        body: "Receive incoming purchase orders and fulfill outgoing transfers to your locations in Shopify POS. Exclusive to POS Pro.",
        cta: "Read help doc",
      },
    ],
  },
  {
    id: "marketing",
    name: "Marketing",
    tagline: "Introducing Campaign Autopilot",
    palette: ["#d76f8d", "#8b7fd6"],
    lead: {
      title: "Introducing Campaign Autopilot",
      body: "Run campaigns across channels with AI-powered marketing that learns, optimizes, and drives performance. Set guardrails to stay in control, and track results over time.",
      cta: "Read about automating your marketing",
    },
    features: [
      {
        title: "Shop Campaigns on more channels",
        body: "Run one campaign across channels with Shop Campaigns, including ChatGPT, programmatic ads via Microsoft Monetize, and Pinterest.",
        cta: "Read help doc",
      },
      {
        title: "WhatsApp marketing channel",
        body: "Create and manage WhatsApp marketing campaigns in Shopify Messaging.",
        cta: "Read help doc",
      },
      {
        title: "SMS and marketing automations",
        body: "Create and manage marketing automations in Shopify Messaging, now including SMS automations.",
        cta: "Read help doc",
      },
      {
        title: "Smart email delivery",
        body: "Shopify Messaging intelligently prioritizes which messages to send and hold back, optimizing for conversion.",
        cta: "Read help doc",
      },
      {
        title: "Marketing data in analytics",
        body: "View marketing reports in analytics with spend, ROAS, impressions, and sessions alongside sales.",
        cta: "Read help doc",
      },
      {
        title: "Fixed bundles on Google Shopping and Meta",
        body: "Publish pre-configured bundles across Google search and ads, YouTube, Facebook, and Instagram.",
        cta: "Read help doc",
      },
      {
        title: "Simplified setup and bidding in Shop Campaigns",
        body: "Set up one campaign with custom bids for segments like new or lapsed customers, and run it across channels.",
        cta: "Read help doc",
      },
      {
        title: "Standardized ads billing for Shop Campaigns",
        body: "Shop Campaigns charges appear on your Shopify invoice with centralized reporting and billing in the admin.",
        cta: "Read help doc",
      },
      {
        title: "Discount links attributed to campaigns",
        body: "Attribute discount links to their associated campaign to accurately track traffic and conversion.",
        cta: "Read help doc",
      },
      {
        title: "Marketing consent on sign-in",
        body: "Capture email marketing opt-ins on your customer sign-in page.",
        cta: "Read help doc",
      },
      {
        title: "WhatsApp consent management",
        body: "Control WhatsApp marketing consent in each customer's profile alongside their email and SMS consent.",
        cta: "Read help doc",
      },
    ],
  },
  {
    id: "operations",
    name: "Operations",
    tagline: "More vibe-coding partners",
    palette: ["#c9a25e", "#5f9fb0"],
    lead: {
      title: "More vibe-coding partners",
      body: "Describe your business and spin up a Shopify store with Manus, Replit, V0, or Lovable.",
    },
    features: [
      {
        title: "Store management with agents",
        body: "Run your store inside Claude, ChatGPT, or Perplexity. Add products, create collections, and manage orders from the chat.",
      },
      {
        title: "Better context for your store's data",
        body: "Understand your numbers, so you can take action, with daily insights and more context on your store in analytics.",
        cta: "Read what's new",
      },
      {
        title: "Enhanced inventory management",
        body: "Make purchasing decisions with Sidekick, scan barcodes to receive shipments, keep counts accurate across channels, and turn returns into data.",
        cta: "Read what's new",
      },
      {
        title: "Batch fulfillment workflow",
        body: "Group orders into batches and fulfill them through a customizable pick, pack, scan, and ship workflow.",
        cta: "Fulfill your orders in batches",
      },
      {
        title: "Managed Markets in the UK and Canada",
        body: "Businesses in the UK and Canada can sell globally with support for duties, taxes, compliance and more.",
      },
      {
        title: "Code editor in Shopify Flow",
        body: "Write code faster with syntax highlighting, autocomplete, and formatting in Liquid variables for Shopify Flow.",
        cta: "Read help doc",
      },
      {
        title: "Shopify AI Toolkit",
        body: "Manage your store from AI platforms like Claude Code, Codex, Cursor, VS Code, and more.",
      },
      {
        title: "New data visualizations in analytics",
        body: "Get a deeper understanding of your data with scatter plots, radars, bubble charts, and sunbursts.",
        cta: "Read help doc",
      },
      {
        title: "Daily insights in analytics",
        body: "Shopify analyzes your data and surfaces the most important trends in the analytics overview.",
        cta: "Read help doc",
      },
      {
        title: "Automatic shipping label purchasing",
        body: "Create rules in Shopify Flow that buy shipping labels when specific triggers occur.",
        cta: "Read help doc",
      },
      {
        title: "Shipment-level barcode receiving",
        body: "Scan shipment barcodes like GS1-128 to receive inventory transfers faster in the admin.",
        cta: "Read help doc",
      },
      {
        title: "Duty calculation breakdown",
        body: "See how duties are calculated with a detailed breakdown of each factor that contributes to the final amount.",
        cta: "Read help doc",
      },
    ],
  },
  {
    id: "shop-app",
    name: "Shop app",
    tagline: "Search designed around shoppers",
    palette: ["#7d6fe0", "#4f97d8"],
    lead: {
      title: "Search designed around shoppers",
      body: "Discover, compare, and research products through conversation. Recommendations are shaped by shoppers' tastes and history on Shop and get smarter over time.",
      cta: "Try it",
    },
    features: [
      {
        title: "Online to in person with the Shop app",
        body: "Connect local shoppers from Shop to your retail store. Get discovered, offer in-store pickup, and easy returns.",
        cta: "Read help doc",
      },
      {
        title: "Shop skill for personal AI agents",
        body: "Shoppers using OpenClaw, Hermes, and other AI agents can discover products across Shopify and approve purchases through Shop.",
        cta: "Learn more",
      },
      {
        title: "Blocks in Shop Editor",
        body: "Customize your product detail pages in Shop with content like slideshows, collections, videos, and media.",
        cta: "Read help doc",
      },
      {
        title: "Demand indicators and inventory alerts",
        body: "Product detail pages in Shop show demand indicators like whether an item is trending and flag when inventory's low.",
      },
      {
        title: "Posts in the Shop app",
        body: "Create posts that get seen by active shoppers in the home feed, their following feeds, and on your store in Shop.",
        cta: "Read help doc",
      },
      {
        title: "Shop Minis across the app",
        body: "Shoppers can interact with Shop Minis from the home feed, top navigation, and product pages, so more of your products show up in new ways.",
        cta: "Learn more",
      },
      {
        title: "Merchandised categories",
        body: "Shoppers can browse products and brands curated by category to find what they're looking for in Shop.",
        cta: "Try it",
      },
      {
        title: "Seamless Shop sign-in and account experience",
        body: "Shop sign-in works with more customer accounts and features are consistent across sign-in experiences.",
        cta: "Read help doc",
      },
    ],
  },
  {
    id: "payments",
    name: "Payments",
    tagline: "Shop Pay available to any brand on any platform",
    palette: ["#6f7fe0", "#59b3a9"],
    lead: {
      title: "Shop Pay available to any brand on any platform",
      body: "Businesses of all sizes can offer Shop Pay at checkout even if they aren't using Shopify's online store. Get access to 250M+ shoppers and one-click purchasing. Now with simplified onboarding.",
      cta: "Get Shop Pay",
    },
    features: [
      {
        title: "Managed payment methods",
        body: "Shopify Payments dynamically orders payment methods in each checkout, displaying the options most likely to convert.",
        cta: "Read help doc",
      },
      {
        title: "Ship and pick up in one checkout",
        body: "Customers can select shipping and in-store pickup for different items within a single checkout.",
        cta: "Read help doc",
      },
      {
        title: "Deeper dispute insights",
        body: "Find out why a dispute was opened, won, or lost, and get tailored evidence to resolve chargebacks.",
        cta: "Read help doc",
      },
      {
        title: "Higher-converting, redesigned checkout",
        body: "A tighter checkout makes delivery options easier to scan, elevates the pay button, and reduces scrolling on mobile.",
      },
      {
        title: "Accept more USDC",
        body: "Customers can pay with USDC on Ethereum, Base, or other chains. Funds bridge automatically.",
        cta: "Read help doc",
      },
      {
        title: "Enhanced fraud prevention for card testing",
        body: "Shopify Payments uses improved machine learning models to block card testing attacks by scoring transactions for decline and fraud risk.",
        cta: "Read article",
      },
      {
        title: "Shop Pay includes more local payment methods",
        body: "Businesses around the globe can offer customers local and regional payment methods in one wallet with Shop Pay.",
        cta: "Read help doc",
      },
      {
        title: "Multi-currency payouts",
        body: "Businesses in the US, Hong Kong, and Singapore can settle in more currencies, saving on conversion fees. Coming soon to France.",
        cta: "Read help doc",
      },
      {
        title: "Chargeback health monitoring",
        body: "Manage and reduce your chargeback rate with proactive alerts and guidance to improve your standing.",
        cta: "Read help doc",
      },
      {
        title: "VAT ID validation at checkout",
        body: "Collect and validate buyer VAT IDs at checkout with Shopify Tax in the EU and UK.",
        cta: "Read help doc",
      },
      {
        title: "Customized branding in checkout, accounts, and sign-in",
        body: "Set your logo, colors, and typography once, and it gets applied consistently across checkout, customer account, and sign-in pages.",
        cta: "Read help doc",
      },
      {
        title: "Quick Sale supports tipping, shipping, and payment links",
        body: "Collect tips, calculate change for cash payments, add shipping, and send payment links from the Shopify app.",
        cta: "Read help doc",
      },
    ],
  },
  {
    id: "finance",
    name: "Finance",
    tagline: "Cashback on ad spend from Shopify Balance",
    palette: ["#5fae7a", "#5f9fb0"],
    lead: {
      title: "Cashback on ad spend from Shopify Balance",
      body: "Earn cashback on qualifying payments made by ACH or wire transfer from your Shopify Balance account for Meta and Google ads. US only.",
      cta: "See cashback rewards",
    },
    features: [
      {
        title: "Shopify Tax available in Canada",
        body: "Auto-calculate Canadian sales tax using your product categories and track liability thresholds in the admin.",
        cta: "Read help doc",
      },
      {
        title: "Cash in Shopify Balance",
        body: "Add cash to your Shopify Balance account at participating retailers using a barcode generated in the Shopify app. US only.",
        cta: "Read help doc",
      },
      {
        title: "Funding paid with Shopify Payments",
        body: "Repay Shopify Capital funding from your Shopify Payments balance instead of bank account debits.",
        cta: "Read help doc",
      },
      {
        title: "Repayment control for Shopify Capital flex account",
        body: "Borrow up to your remaining capacity and adjust your repayment rate anytime. US only.",
        cta: "Read help doc",
      },
      {
        title: "Shopify Capital available in France",
        body: "Businesses in France can access flexible funding with automatic repayment through daily sales.",
        cta: "Read help doc",
      },
      {
        title: "Domestic wire transfers",
        body: "Send domestic wire transfers to vendors from Shopify Balance for $10 per transfer. US only.",
        cta: "Read help doc",
      },
      {
        title: "Gift cards in local currencies",
        body: "Sell and redeem gift cards in your customers' local currencies across markets from one store.",
        cta: "Read help doc",
      },
    ],
  },
  {
    id: "developer",
    name: "Developer",
    tagline: "Commerce skills for your favorite agent",
    palette: ["#8f8f9e", "#4f97d8"],
    lead: {
      title: "Commerce skills for your favorite agent",
      body: "Build and manage storefronts, apps, and themes from AI tools like Claude Code, Codex, Cursor, Hermes, and more.",
      cta: "Get setup",
    },
    features: [
      {
        title: "More control over events",
        body: "Configure triggers to fire webhooks only on specific field changes, and use custom GraphQL queries to receive only the data you need.",
        cta: "Read dev docs",
      },
      {
        title: "GraphQL and bulk operations from the CLI",
        body: "Run queries and bulk operations from agents or your terminal using Shopify CLI, with automatic auth and built-in status tracking.",
        cta: "Read dev docs",
      },
      {
        title: "All partner stores in Dev Dashboard",
        body: "Dev, client transfer, and collaborator stores live in the Dev Dashboard. It's the new home for building.",
        cta: "Read dev docs",
      },
      {
        title: "No backend required for lightweight apps",
        body: "Build an App Home directly in the admin without setting up or maintaining a backend server.",
        cta: "Read dev docs",
      },
      {
        title: "All-new Hydrogen on any stack",
        body: "Agent-first and rebuilt from the ground up, in collaboration with Vercel, Hydrogen works with any framework, including Next.js.",
        cta: "Read dev docs",
      },
      {
        title: "Safer app deployments",
        body: "Configure CI/CD pipelines that deploy new and updated extensions without accidentally deleting existing ones across live stores.",
        cta: "Read dev docs",
      },
      {
        title: "App Events API",
        body: "Send events happening in your app to Shopify, then monitor and manage your app's performance in the Dev Dashboard.",
        cta: "Read dev docs",
      },
      {
        title: "Streamlined Metafields and Metaobjects API",
        body: "Read and write metafields and metaobjects more easily with a simpler GraphQL API.",
        cta: "Read dev docs",
      },
      {
        title: "Simple billing with Shopify App Pricing",
        body: "Configure usage, recurring, or hybrid pricing models in the app submission. Shopify powers the plan selection, charge approval, and invoicing.",
        cta: "Read dev docs",
      },
      {
        title: "Parallel reads for bulk queries",
        body: "Run Admin API queries up to four times faster with bulk operations.",
        cta: "Read dev docs",
      },
      {
        title: "Color palettes for themes",
        body: "Define color palettes in settings that are available across the theme with a new color customization architecture.",
        cta: "Read dev docs",
      },
      {
        title: "Role-based access for partners",
        body: "Manage your team through seven system roles, and create custom ones for anything else.",
        cta: "Read dev docs",
      },
    ],
  },
];
