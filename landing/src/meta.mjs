// Per-page metadata — the single source for <title>, meta description, social (Open Graph / X card)
// title + description, canonical route and Open Graph type. Values come from the founder's
// METADATA-GUIDE (16 Sep 2026), set in sentence case per the founder (17 Sep 2026): proper nouns
// capitalised, the brand stays "capx café", "(prev. Twitter)" kept everywhere, "capx cafe MCP" (no accent)
// is intentional. build.mjs refuses to render a route that has no entry here.
export const site = {
  name: 'capx café',
  locale: 'en_US',
  image: {
    url: 'https://capx-cafe.vercel.app/assets/capx-cafe-social-v3.jpg',
    path: 'assets/capx-cafe-social-v3.jpg',
    type: 'image/jpeg',
    width: 1200,
    height: 630,
    alt: 'Capx café: let your AI run your X. Publish to X from your coding agent. A cream retro computer with a lime screen sits beside the headline.',
  },
  robots: 'index, follow, max-image-preview:large',
};

export const meta = {
  '/': {
    title: 'capx café — Publish to X (prev. Twitter) from your coding agent',
    description: 'Turn shipped work into X (prev. Twitter) posts with your coding agent. Draft, preview, schedule, and publish through capx café, with server-side guardrails.',
    socialTitle: 'Let your AI run your X (prev. Twitter).',
    socialDescription: 'Your coding agent writes. capx café handles guarded publishing to X. Bring your own X app or self-host.',
    type: 'website',
  },
  '/pricing/': {
    title: 'Pricing — developer access & creator plans | capx café',
    description: 'Explore free capx café developer access, self-hosting costs, and upcoming creator plans from $5/month. Compare quotas, limits, and top-ups.',
    socialTitle: 'A clear idea of the cost. A place for your work.',
    socialDescription: 'Free on capx café’s side with your own X (prev. Twitter) app; X (prev. Twitter) charges separately. Compare self-hosting and upcoming creator plans from $5/month.',
    type: 'website',
  },
  '/blog/': {
    title: 'capx café blog — AI agents, MCP & building in public',
    description: 'Practical guides to MCP, publishing to X (prev. Twitter) with coding agents, and sharing your work. Learn to set up capx café, plan posts, and write in your own voice.',
    socialTitle: 'How to set up capx café: guides and blog.',
    socialDescription: 'From your first guarded post to a week of build updates: practical guides for the space between shipping something and telling its story.',
    type: 'website',
  },
  '/blog/you-shipped-it-now-tell-people/': {
    title: 'Share what you ship: a developer’s guide | capx café',
    description: 'Turn a merged PR or shipped feature into a useful X (prev. Twitter) update. Find the user-facing change, ground the draft in facts, and review it before publishing.',
    socialTitle: 'You shipped it. Now tell people what changed.',
    socialDescription: 'Find the story in your real work and turn it into a specific, useful update - with a draft you can review before it goes out.',
    type: 'article',
  },
  '/blog/mcp-beyond-your-editor/': {
    title: 'Publish to X (prev. Twitter) from your coding agent | capx café MCP',
    description: 'Learn how capx cafe MCP connects coding agents to tools beyond the editor, where capx café fits, and why permissions and publishing boundaries matter.',
    socialTitle: 'What capx cafe MCP makes possible beyond your editor',
    socialDescription: 'How an agent moves from understanding your work to using publishing tools, and what stays on each side of the connection.',
    type: 'article',
  },
  '/blog/your-first-x-post/': {
    title: 'Your first X (prev. Twitter) post with capx café | Setup guide',
    description: 'Set up capx café, connect your X (prev. Twitter), and preview a draft from your work. Follow the steps to review, publish, and confirm your first post.',
    socialTitle: 'Your first X (prev. Twitter) post with capx café',
    socialDescription: 'Bring your coding agent and X (prev. Twitter) app. Follow the path from installation to a draft, a guardrail preview, and your first approved post.',
    type: 'article',
  },
  '/blog/agent-setup-guide/': {
    title: 'Set up capx café in Claude Code, Cursor & Codex',
    description: 'Add capx café to Claude Code, Cursor, or Codex with copyable commands and MCP configuration. Check your setup and connect your X (prev. Twitter) account.',
    socialTitle: 'Your agent. Your setup. Your first capx café connection.',
    socialDescription: 'Three practical setup paths: Claude Code, Cursor, and Codex. Copy the configuration, check the tools, and connect your X (prev. Twitter) account.',
    type: 'article',
  },
  '/blog/from-commits-to-build-updates/': {
    title: 'Turn commits into weekly X (prev. Twitter) updates | capx café',
    description: 'Turn a week of real commits into useful X (prev. Twitter) updates. Group changes, review drafts, and schedule a small queue with capx café’s server-side loops.',
    socialTitle: 'From commits to a week of build updates',
    socialDescription: 'A practical workflow for finding the story, reviewing the words, and scheduling approved posts from work you have actually shipped.',
    type: 'article',
  },
  '/blog/publishing-tools-without-local-credentials/': {
    title: 'Agent publishing: tokens, guardrails & limits | capx café',
    description: 'See how capx café keeps X (prev. Twitter) tokens on the server and checks publishing requests.',
    socialTitle: 'Publishing tools for your agent. X (prev. Twitter) tokens on the server.',
    socialDescription: 'Follow a publishing request through the guardrail and vault, and understand what a passing verdict does - and does not establish.',
    type: 'article',
  },
  '/blog/write-with-an-agent-in-your-voice/': {
    title: 'Write with an AI agent in your own voice | capx café',
    description: 'Help your coding agent write X (prev. Twitter) posts that sound like you. Build a voice profile from your own examples, preserve the facts, and edit before publishing.',
    socialTitle: 'Write with an agent and still sound like yourself',
    socialDescription: 'Use your own examples, keep the specific details, and make the final edit yours. A practical guide to more personal build updates.',
    type: 'article',
  },
};
