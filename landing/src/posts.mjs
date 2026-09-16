export const escapeHtml = (text) => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const prompt = (id, text) => `<div class="article-prompt"><p class="eyebrow">Try this with your agent</p><p id="${id}">${escapeHtml(text)}</p><button class="copy-button" type="button" data-copy-target="${id}">Copy prompt <span aria-hidden="true">↗</span></button></div>`;
const code = (id, label, text) => `<div class="code-shell"><div class="code-toolbar"><span>${escapeHtml(label)}</span><button class="code-copy" type="button" data-copy-target="${id}" aria-label="Copy ${escapeHtml(label)}">Copy</button></div><pre id="${id}">${escapeHtml(text)}</pre></div>`;
const repo = 'https://github.com/vb-tyagi/capx-cafe';
export const posts = [
  {
    slug: 'you-shipped-it-now-tell-people', category: 'Perspective',
    title: 'You shipped it. Now tell people what changed.',
    deck: 'A useful build update starts with the work you already did. Here’s how to find the story without turning your day into a content exercise.',
    related: ['from-commits-to-build-updates', 'your-first-x-post'],
    sources: [['The ship-note workflow', `${repo}/tree/main/skills/ship-note`], ['The build-in-public workflow', `${repo}/tree/main/skills/build-in-public`]],
    body: `
<h2 id="small-changes">Small changes can be worth explaining.</h2>
<p>You close the issue, merge the fix, and move on. The release notes might get a line. The people who would care about the improvement may never see it.</p>
<p>A build update gives that work a little more context. It can explain which problem you noticed, what you changed, and what someone can do differently now. You do not need a launch campaign for every commit. You need a reason for this particular change to matter to someone else.</p>
<p>That distinction helps you choose what to share. A formatting cleanup probably needs no announcement. A fix that prevents someone from repeating a failed setup step may deserve a short explanation, even if the code change was small.</p>
<h2 id="find-the-story">Find the user-facing change.</h2>
<p>Start with a merged PR, a published release, or a concrete fix. Ask three questions: What happened before? What happens now? Who benefits from the difference?</p>
<p>For example, imagine a tool that used to lose an unsent draft when someone refreshed the page. The implementation might involve local persistence and a new state transition. The useful public explanation is simpler:</p>
<blockquote><p>Refreshing the page no longer clears your unsent draft. You can pick up where you left off.</p></blockquote>
<p>This is an illustrative example, not a capx café feature announcement. Its value is the shape: a specific problem and an understandable improvement. It makes no invented claims about how many users asked for the fix or how much time it saves.</p>
<h2 id="use-the-context">Use the context your agent already has.</h2>
<p>Your coding agent can help identify that difference from the material you let it read. Give it a bounded source, such as one release or the last merged PR, and ask it to separate user-facing changes from internal cleanup.</p>
${prompt('shipped-prompt', 'Review the last merged PR. Identify one change a user would care about. Draft a short X update explaining the problem, the change, and the benefit. Use only facts supported by the diff. Flag anything that may be private. Show me the draft; do not publish.')}
<p>Read the result against the source. Check that the feature has actually shipped, that a limitation has not disappeared in the rewrite, and that no private customer detail or internal URL slipped into the copy.</p>
<h2 id="finish-the-job">Make publishing a small final step.</h2>
<p>capx café gives the agent publishing tools for X. The agent writes the draft; capx café checks and transports it. The <code>ship-note</code> skill gives the agent a repeatable way to move from a real change to a proposed update.</p>
<p>After editing, ask for a preview through capx café. Read the verdict and the words themselves before authorizing publication. A passing guardrail verdict does not establish that every claim is true; checking the source still matters.</p>
<p>A useful starting habit is one update from one meaningful change. If there is no public story this week, leave the slot empty. When there is one, the work you have already done is enough to begin.</p>`
  },
  {
    slug: 'mcp-beyond-your-editor', category: 'The space',
    title: 'What MCP makes possible beyond your editor',
    deck: 'A plain-English look at how an agent goes from understanding your work to using tools—and where capx café fits.',
    related: ['publishing-tools-without-local-credentials', 'agent-setup-guide'],
    sources: [['MCP architecture overview', 'https://modelcontextprotocol.io/docs/learn/architecture'], ['capx café tools and installation', `${repo}/blob/main/llms-install.md`]],
    body: `
<h2 id="from-answer-to-action">From an answer to an action.</h2>
<p>Ask a coding agent to explain a change and it can produce a summary. Ask it to publish that summary and it needs another capability: a tool that can perform the action.</p>
<p>The Model Context Protocol, or MCP, provides a common way for AI applications to connect to servers that expose capabilities. An application can discover a server’s tools and call them with structured inputs. The protocol also supports resources and prompts. These are connection mechanics; the actual capability comes from the server.</p>
<p>For capx café, the relevant capability is publishing to X. The agent supplies text to tools such as <code>preview</code> and <code>post_now</code>. The same writing context can therefore support both drafting and the next step, without requiring you to transfer the draft into a separate posting interface.</p>
<h2 id="three-parts">Keep three parts of the workflow distinct.</h2>
<ol><li><strong>The agent interprets your request.</strong> It uses the context you provide to reason about the work and write a draft.</li><li><strong>The MCP client connects the tools.</strong> capx café runs as a local stdio MCP server that your compatible agent can launch.</li><li><strong>The capx café service controls the send.</strong> It applies publishing checks and accesses the X token on the server.</li></ol>
<p>“Local MCP server” and “server-side token” describe different parts of this setup. The local process exposes the tools to your agent. The hosted or self-hosted service keeps the publishing credential in its vault. Installing the local package alone does not give you a connected X account.</p>
<h2 id="a-concrete-request">Follow one request all the way through.</h2>
<p>Suppose you ask your agent to turn a release into an X post. First, it reads the release material you authorized. Next, it drafts the wording. You can then ask it to preview that wording through capx café, review the result, and authorize a send.</p>
<p>The service receives the post text routed through its tools; it does not gain general access to the repository simply because your agent can read it. Your agent’s own access and privacy settings remain relevant.</p>
${prompt('mcp-prompt', 'Explain which capx café tools are available in this session. Separate tools that only inspect or preview from tools that publish or change a schedule. Do not publish, connect an account, or create a schedule.')}
<h2 id="choose-the-boundary">Choose tools by their boundaries, too.</h2>
<p>When you evaluate an agent integration, ask what it can read, what it can change, where credentials live, and how you can inspect the result. A common protocol does not make every connected tool equally appropriate for every task.</p>
<p>capx café keeps the X access token on the server and puts its deterministic guardrail in the publishing path. Your agent still has the ability to request guarded posts through a session handle. That ability deserves deliberate use.</p>
<p>The practical opportunity is a shorter path from useful context to a useful action. Begin with a small workflow you understand, inspect the tool results, and expand only when you are comfortable with what each step does.</p>`
  },
  {
    slug: 'your-first-x-post', category: 'Getting started',
    title: 'Your first X post with capx café',
    deck: 'From the setup requirements to a draft you can inspect: a practical walkthrough of your first guarded post.',
    related: ['agent-setup-guide', 'write-with-an-agent-in-your-voice'],
    sources: [['Installation and connection guide', `${repo}/blob/main/llms-install.md`], ['Quickstart skill', `${repo}/tree/main/skills/quickstart`], ['Security model', `${repo}/blob/main/docs/SECURITY.md`]],
    body: `
<h2 id="bring-the-basics">Bring the basics.</h2>
<p>The available developer option uses your own X developer app. You will need a compatible coding agent, Node 22.6 or later, your X app’s OAuth client ID, a capx café server URL, and an email allowed on that server.</p>
<p>If you do not have hosted access, <a href="mailto:tyagi@intothebuilderness.com?subject=capx%20caf%C3%A9%20hosted%20access">ask about it</a> before expecting publishing calls to work. Self-hosting is also available. The developer option has no capx subscription; your agent, X usage, and any self-hosting infrastructure are separate costs. The <a href="/pricing/">pricing page</a> explains those boundaries.</p>
<h2 id="add-the-tools">Add the tools to your agent.</h2>
<p>Open the <a href="/#install">setup section</a> and choose your client. Claude Code has a plugin installation path; other clients can launch the <code>capx-cafe</code> package as a stdio MCP server. The <a href="/blog/agent-setup-guide/">agent setup guide</a> includes copyable examples.</p>
<p>Configure <code>CAPX_CHOKEPOINT_URL</code>, <code>CAPX_EMAIL</code>, <code>CAPX_LANE=byo</code>, and <code>X_CLIENT_ID</code>. Use your actual allowed email and app client ID. The client ID identifies the app; do not substitute an X password, client secret, or access token.</p>
<p>Reload the agent’s MCP connection if necessary. Ask it to list the capx café tools it can see. Tool discovery confirms installation, but does not confirm your account is connected: capx café can expose its tool list before account configuration is complete.</p>
<h2 id="connect-x">Connect your X account.</h2>
<p>Ask your agent to connect your X account. It calls <code>connect_x</code> and returns an authorization URL. Complete authorization in the browser, checking the account and requested access.</p>
<p>The callback goes to the capx café service, where the X token is stored in the vault. Your agent receives a short-lived session handle. Ask it to call <code>whoami</code> and show the connected handle and status before proceeding.</p>
<h2 id="draft-and-preview">Draft something real, then preview it.</h2>
<p>Choose one change that has shipped and is appropriate to share. Keep the first attempt to a standalone text post so the wording and the publishing steps are easy to inspect.</p>
${prompt('first-post-prompt', 'Read the latest commit I have marked as ready to share. Draft one specific X post about the change and why it matters. Do not include private details or unsupported claims. Run the draft through capx café preview and show me the text and verdict. Do not publish or schedule it.')}
<p>The agent writes the words. The <code>preview</code> tool checks the proposed post without sending it to X. If the verdict calls for a rewrite, hold, or block, inspect the stated reason. Correct the underlying issue rather than repeating the same request or bypassing the guardrail.</p>
<h2 id="publish-and-confirm">Publish the approved version.</h2>
<p>Read the final text and confirm that its claims match the source. When you are ready, explicitly ask the agent to publish that exact draft. <code>post_now</code> is the step that sends a real post; the guardrail runs at the publishing boundary again.</p>
<p>Inspect the returned result and check the post on X. If a request times out or its outcome is unclear, ask the agent to inspect the audit history before retrying. Avoid turning uncertainty into a duplicate post.</p>
<h2 id="if-something-stops">If something stops you.</h2>
<ul><li><strong>No tools:</strong> check the agent configuration and whether Node and npx are available to the agent process.</li><li><strong>Access rejected:</strong> check the server URL and allowed email.</li><li><strong>Connection needs authorization:</strong> reconnect through the browser and check <code>whoami</code>.</li><li><strong>Draft rejected:</strong> read the verdict. It may concern content, account eligibility, or limits rather than installation.</li></ul>`
  },
  {
    slug: 'agent-setup-guide', category: 'Getting started',
    title: 'Use capx café with Claude Code, Cursor, or Codex',
    deck: 'Choose your agent, add the publishing tools, and check the connection. Three setup paths for the same capx café service.',
    related: ['your-first-x-post', 'mcp-beyond-your-editor'],
    sources: [['capx café configuration reference', `${repo}/blob/main/llms-install.md`], ['Claude Code: install plugins', 'https://code.claude.com/docs/en/discover-plugins'], ['Cursor: MCP integrations', 'https://cursor.com/help/customization/mcp'], ['OpenAI: MCP configuration', 'https://developers.openai.com/codex/mcp/']],
    body: `
<h2 id="before-you-start">Before you start.</h2>
<p>All three paths connect to the same capx café publishing tools. You need Node 22.6 or later, a server URL, an allowed email, and your X app’s OAuth client ID for the developer BYO option. Replace every <code>YOUR_…</code> value below before using the configuration.</p>
<p>Keep existing servers and settings when editing a configuration file. If a <code>capx-cafe</code> entry already exists, update that entry rather than creating another. These examples configure the MCP tools; they do not authorize your X account or publish anything.</p>
<h2 id="claude-code">Claude Code: install the plugin.</h2>
<p>Run these commands inside Claude Code to add the capx café marketplace and install its plugin:</p>
${code('claude-install', 'Claude Code plugin commands', '/plugin marketplace add vb-tyagi/capx-cafe\n/plugin install capx-cafe@capx-cafe')}
<p>The plugin bundles the MCP server and skills. Installation and service configuration are separate: follow the <a href="https://github.com/vb-tyagi/capx-cafe/blob/main/llms-install.md">capx café configuration guide</a> to supply your server URL, allowed email, lane, and X client ID to its MCP server. Ask Claude Code to help apply these values without editing unrelated settings.</p>
<p>If the plugin cannot be found, check that the marketplace was added successfully and inspect Claude Code’s plugin manager for errors. Review the installation source before enabling it.</p>
<h2 id="cursor">Cursor: add an MCP server entry.</h2>
<p>For a project-level setup, merge the server entry below into <code>.cursor/mcp.json</code>. Cursor also supports a personal global configuration at <code>~/.cursor/mcp.json</code>. Choose the scope that fits where you want the tools available.</p>
${code('cursor-config', 'Cursor MCP configuration', JSON.stringify({mcpServers:{'capx-cafe':{command:'npx',args:['-y','capx-cafe'],env:{CAPX_CHOKEPOINT_URL:'YOUR_SERVER_URL',CAPX_EMAIL:'YOUR_ALLOWED_EMAIL',CAPX_LANE:'byo',X_CLIENT_ID:'YOUR_X_CLIENT_ID'}}}},null,2))}
<p>Check Cursor’s MCP settings for the server’s status and available tools. Keep personal configuration values out of shared project commits unless you intend to share them. A valid JSON file still needs the correct values and a working Node installation.</p>
<h2 id="codex">Codex: add a TOML server entry.</h2>
<p>Add this block to <code>~/.codex/config.toml</code>, preserving the rest of the file. Codex defines MCP servers under <code>mcp_servers</code>; the nested <code>env</code> table supplies capx café’s configuration.</p>
${code('codex-config', 'Codex MCP configuration', '[mcp_servers.capx-cafe]\ncommand = "npx"\nargs = ["-y", "capx-cafe"]\n\n[mcp_servers.capx-cafe.env]\nCAPX_CHOKEPOINT_URL = "YOUR_SERVER_URL"\nCAPX_EMAIL = "YOUR_ALLOWED_EMAIL"\nCAPX_LANE = "byo"\nX_CLIENT_ID = "YOUR_X_CLIENT_ID"')}
<p>Reload the MCP connection or start a fresh session after saving. Use the <a href="https://developers.openai.com/codex/mcp/">official MCP configuration guide</a> for client-specific troubleshooting. The X connection described below is capx café’s browser flow; these stdio settings do not require turning the capx service URL into a remote MCP endpoint.</p>
<h2 id="check-the-connection">Check the connection in any agent.</h2>
<p>First ask the agent to list capx café’s available tools. Then ask it to connect your X account, follow the URL returned by <code>connect_x</code>, and confirm the handle with <code>whoami</code>.</p>
${prompt('agent-check-prompt', 'Check whether capx café is configured and list its available tools. Tell me which setup values are missing without printing secrets. If my X account is already connected, show its handle using whoami. Do not publish or create a schedule.')}
<p>If discovery works but service calls fail, inspect the reported configuration or access error. If no tools appear, check JSON or TOML syntax, Node availability, and the client’s server status. A blocked draft is a separate issue: read its guardrail verdict rather than reinstalling the integration.</p>
<p>Once the connection is healthy, follow <a href="/blog/your-first-x-post/">the first-post walkthrough</a>. Begin with a preview. Add skill adapters for your client from the repository when you want more guided workflows.</p>`
  },
  {
    slug: 'from-commits-to-build-updates', category: 'Workflows',
    title: 'From commits to a week of build updates',
    deck: 'Turn real changes into a small queue of useful posts, with a review step and a schedule you can actually maintain.',
    related: ['write-with-an-agent-in-your-voice', 'your-first-x-post'],
    sources: [['Build-in-public skill', `${repo}/tree/main/skills/build-in-public`], ['Cadence planner', `${repo}/tree/main/skills/cadence-planner`], ['Publishing and loop tools', `${repo}/blob/main/llms-install.md`]],
    body: `
<h2 id="choose-a-range">Choose a range, then find the themes.</h2>
<p>A week of commits is a source of material, not a publishing calendar. Some commits represent the same feature. Others are cleanup. Start by asking the agent to review a defined period and identify changes someone outside the codebase would understand.</p>
<p>The <code>build-in-public</code> skill guides this process. It looks for meaningful work, groups related changes, and proposes posts. You should still review whether the changes have shipped and whether their details are public.</p>
${prompt('weekly-prompt', 'Review the last seven days of commits. Group the shipped, public-safe changes into up to three themes. For each theme, show the source commits and draft one specific X update. Skip internal cleanup and do not invent metrics. Show all drafts for review; do not schedule or publish.')}
<h2 id="give-each-post-a-job">Give each post its own job.</h2>
<p>Consider a hypothetical week with three changes: a draft now survives a refresh, an error message points to a missing setting, and a large export no longer times out. Those are three distinct stories. Five commits implementing the draft fix are still one story.</p>
<p>An illustrative first draft might read:</p>
<blockquote><p>Fixed the refresh that used to wipe an unsent draft. The words now stay put when the page reloads.</p></blockquote>
<p>A second post should explain the configuration improvement on its own merits. Rewording the same fix three times makes the queue longer without giving readers anything new. If only one change is worth sharing, one post is a good result.</p>
<h2 id="review-before-queuing">Review before anything enters the queue.</h2>
<p>Ask the agent to show the source behind each claim. Remove details that are not ready for public release. Edit for your voice, and run the drafts through <code>preview</code>. A clean preview is useful feedback, not a reservation of future publishing capacity: conditions can change before a scheduled send.</p>
<p>Also check whether the post will still be accurate on its scheduled date. “Available today” can become confusing in a queue. A concrete description of what shipped often ages better.</p>
<h2 id="set-a-small-schedule">Set a small, explicit schedule.</h2>
<p>For three approved drafts, an example schedule is Monday, Wednesday, and Friday at 09:00 in your timezone. That is a planning example, not a claim about the best engagement time. Choose a cadence you can keep supplied with useful material.</p>
${prompt('schedule-prompt', 'Propose a schedule for these three approved drafts: Monday, Wednesday, and Friday at 09:00 Asia/Kolkata, in the displayed order. Show the exact days, timezone, next send times, and queue before creating anything. Check account eligibility and applicable limits. Wait for my approval.')}
<p>A capx café loop is a recurring schedule that sends one prepared post per occurrence, in order. Use more than one loop only when you need different schedules. Loops require a verified X account at least 30 days old, with applicable account checks and plan capacity. Short, the upcoming entry creator plan, has no loops.</p>
<h2 id="keep-the-queue-honest">Keep the queue honest.</h2>
<p>After you authorize creation, ask the agent to confirm the schedule with <code>list_loops</code>. The queued posts run on the server, so your laptop can be closed. The server does not write new posts when the queue runs out; your agent must prepare more material.</p>
<p>Use <code>pause_loop</code> when the plan changes and <code>top_up_loop</code> for more approved drafts. Check the audit history to see what actually sent. A sustainable workflow gives you a small amount of maintenance and a clear view of what is going out.</p>`
  },
  {
    slug: 'publishing-tools-without-local-credentials', category: 'Built-in safety',
    title: 'Give your agent publishing tools. Keep credentials on the server.',
    deck: 'Where the X token lives, what the guardrail checks, and the limits that matter when you connect an agent to publishing.',
    related: ['mcp-beyond-your-editor', 'your-first-x-post'],
    sources: [['capx café security model and limits', `${repo}/blob/main/docs/SECURITY.md`], ['Adversarial publishing tests', `${repo}/blob/main/apps/capx-mcp/test/redteam.test.ts`], ['Server adapter tests', `${repo}/blob/main/services/chokepoint/test/xadapter.test.ts`]],
    body: `
<h2 id="publishing-is-authority">Publishing is a form of authority.</h2>
<p>A coding agent reads material from many places: files, issues, tool results, and sometimes the web. Giving that process a publishing integration adds the ability to affect a public account. The important design question is what authority the process receives and what limits remain outside it.</p>
<p>capx café keeps the X access token in a server-side vault. The local agent receives a short-lived, revocable session handle that lets it request guarded actions. The handle still carries authority and should be protected. It is not the X token and does not enable direct X API access.</p>
<h2 id="follow-the-token">Follow the token, not just the button.</h2>
<p>Account authorization happens in the browser. X redirects to the capx café service’s callback, and the service seals the resulting token in its vault. The token is not placed in the agent’s configuration file.</p>
<p>A publishing request follows the server’s admission checks, the casserole guardrail, and then the vault and X adapter. A blocked request does not reach token decryption. Calling the same service directly still goes through the guardrail; the check is part of the server’s publishing path.</p>
<div class="article-callout"><p><strong>The boundary in one line</strong></p><p>Agent request → admission → guardrail → vault → X</p><p>The agent supplies the text. The server decides whether the request can proceed.</p></div>
<h2 id="six-checks">What the six layers check.</h2>
<p>casserole applies deterministic checks for eligibility, rate, quality, authenticity, monitoring state, and audit. Depending on the result, a request can pass, need a rewrite, be held for review, or be blocked.</p>
<p>The quality rules include signals such as vague hype, engagement bait, and near-duplicates. Eligibility and rate checks consider whether publishing is permitted under the account’s current conditions. The decision is recorded so it can be inspected later.</p>
<p>These rules do not rely on a second language model judging the draft. They provide a defined control at the publishing boundary. Their scope is narrower than “everything a human reviewer might notice.”</p>
<h2 id="what-it-does-not-prove">What a passing verdict does not prove.</h2>
<ul><li><strong>It does not fact-check every statement.</strong> A post can pass and still contain an inaccurate claim or an unwise disclosure.</li><li><strong>It does not moderate media.</strong> Attached images and videos are not content-inspected by casserole.</li><li><strong>It does not remove operator trust.</strong> The hosted service operator controls infrastructure containing the vault; a self-hoster becomes that operator.</li><li><strong>It does not control X.</strong> Platform outages, account actions, and X-side limits remain external conditions.</li></ul>
<p>A compromised session can still attempt guarded requests until the handle expires or is revoked. Keeping the token away from the agent narrows the credential exposure; it does not mean the agent has no publishing ability or that every allowed post is harmless.</p>
<h2 id="use-the-controls">Use the controls in your daily workflow.</h2>
<p>Start with <code>preview</code>, read the draft, and approve the actual words. If a request is blocked or held, inspect the reason and correct the issue. Use the audit trail to understand the result, especially when a send status is uncertain.</p>
${prompt('security-prompt', 'Preview this draft through capx café. Show the verdict and the stated reasons. Separately flag unsupported claims or details that may be private. Do not publish, alter a schedule, or try another route if the request is blocked.')}
<p>The <a href="/#security">homepage demo</a> shows the real guardrail in a sandbox with X publishing simulated. The source and adversarial tests below let you inspect the implementation and its stated boundaries in more detail.</p>`
  },
  {
    slug: 'write-with-an-agent-in-your-voice', category: 'Writing',
    title: 'Write with an agent and still sound like yourself',
    deck: 'Use your own examples, keep the specific details, and make the final edit yours. A practical way to avoid interchangeable build updates.',
    related: ['you-shipped-it-now-tell-people', 'from-commits-to-build-updates'],
    sources: [['Voice-match skill', `${repo}/tree/main/skills/voice-match`], ['Draft-review skill', `${repo}/tree/main/skills/draft-review`], ['Hook-rewrite skill', `${repo}/tree/main/skills/hook-rewrite`]],
    body: `
<h2 id="start-with-your-writing">Start with writing that is actually yours.</h2>
<p>“Make this sound like me” leaves a lot for an agent to guess. Give it examples of your own posts and it has something concrete to work with: sentence length, vocabulary, pacing, and the way you explain a change.</p>
<p>The <code>voice-match</code> skill is built around that evidence. If the running integration cannot read your recent posts, paste a selection yourself. Do not assume capx café has a timeline-reading tool simply because an agent can write in a similar style.</p>
<p>A useful sample includes several kinds of writing: a fix, a lesson, an announcement, and something you found difficult. If you provide only launch posts, the agent may infer that every update needs to sound like a launch.</p>
<h2 id="make-a-small-profile">Make a small, correctable profile.</h2>
${prompt('voice-prompt', 'Read these examples of my own writing. Describe my sentence length, openings, vocabulary, punctuation, and use of technical detail. Support each observation with an example. Mark uncertain patterns as uncertain. Show me a short voice profile to correct before you use it. Do not imitate another person or publish anything.')}
<p>Review the profile yourself. “Usually leads with the thing that broke” is an actionable observation. “Authentic, innovative, and engaging” does not give the next draft much direction.</p>
<p>Keep the corrected profile in the session, or ask the agent to save it in a file you choose if you want to reuse it. Treat it as a working description of your writing, not a permanent rule about how you must sound.</p>
<h2 id="keep-the-detail">Keep the detail that makes the post yours.</h2>
<p>Consider this deliberately generic example:</p>
<blockquote><p>Excited to announce a game-changing improvement that takes the user experience to the next level.</p></blockquote>
<p>It gives the reader little to picture. A more useful draft for a hypothetical draft-saving fix might be:</p>
<blockquote><p>Lost my draft to a page refresh once too often. Fixed that today. The words stay put now.</p></blockquote>
<p>The second version has a situation, a change, and a rhythm. Use the personal detail only if it really happened to you. If a customer reported the problem, say that instead, without exposing private information. Voice is not permission to invent a backstory.</p>
<h2 id="edit-in-two-passes">Edit in two passes.</h2>
<p>First check substance: Is the feature live? Does the example match the actual behaviour? Is a number supported? Does the post disclose something you should keep private? Remove anything that fails this pass.</p>
<p>Then check expression: Would you say the opening aloud? Is there a simpler verb? Does the technical term help this reader? Can you cut a line without losing the useful part?</p>
${prompt('edit-prompt', 'Review this draft in two passes. First identify unsupported claims, unclear details, and possible private information. Then suggest a shorter version using the voice profile I approved. Preserve the facts and show what you changed. Do not add a personal anecdote or publish.')}
<h2 id="finish-with-a-review">Finish with a review, not a feeling.</h2>
<p>capx café’s skills can guide drafting and editing, while <code>preview</code> checks the proposed post through the guardrail. Your agent remains the writer. The service does not supply a hosted writing model or automatically learn your personality.</p>
<p>Read the final version, inspect the preview verdict, and authorize publication when the words are right. If a post needs less polish to sound like you, keep the rough edge. The goal is a specific, truthful update you are comfortable putting your name on.</p>`
  },
];
