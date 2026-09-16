(() => {
  const $ = (id) => document.getElementById(id);
  const workflows = {
    release: {
      label: 'The change you shipped',
      context: 'fix: handle expired X access tokens\n  refresh the token on the server\n  retry the original send once\n  keep credentials out of the client',
      prompt: '“Turn this token-refresh fix into a short build update. Keep it specific. Preview it before posting.”',
      draft: 'Shipped a small fix for an annoying edge case: expired X tokens.\n\ncapx café now refreshes the token on the server and retries the send once. The credential still never touches the agent.',
      skill: 'Made with ship-note',
    },
    week: {
      label: 'A week in your repository',
      context: 'Mon  add preview for drafts\nWed  preserve a durable publishing audit\nFri  schedule queued posts on the server',
      prompt: '“Look at this week’s commits. Draft three build updates, one per change. Show me the drafts before we queue them.”',
      draft: 'This week’s small win: a preview before the publish.\n\nYou can now run an X draft through capx café’s guardrail and see its verdict without sending a post. Handy for catching issues while it’s still a draft.',
      skill: 'Made with build-in-public · draft 1 of 3',
    },
    readme: {
      label: 'The story in your README',
      context: '# capx café\n\nOne MCP server for X posting.\nThe agent writes the draft.\nThe server guards and sends it.\nYour X token stays in the vault.',
      prompt: '“Turn this README into a short introduction for developers. Explain what it does in plain English, then preview the draft.”',
      draft: 'Built capx café for the moment between shipping a feature and telling people about it.\n\nYour coding agent already has the context. Now it can draft, schedule, and publish to X, with a server-side guardrail on every post.',
      skill: 'Made with repurpose',
    },
  };
  function activateTabs(button) {
    const list = button.closest('[role="tablist"]');
    list.querySelectorAll('[role="tab"]').forEach((tab) => {
      const active = tab === button;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    $(button.getAttribute('aria-controls')).setAttribute('aria-labelledby', button.id);
  }
  document.querySelectorAll('[data-workflow]').forEach((button) => button.addEventListener('click', () => {
    activateTabs(button);
    const item = workflows[button.dataset.workflow];
    $('context-label').textContent = item.label;
    $('context-text').textContent = item.context;
    $('workflow-prompt').textContent = item.prompt;
    $('workflow-draft').textContent = item.draft;
    $('workflow-skill').textContent = item.skill;
  }));
  const env = { CAPX_CHOKEPOINT_URL: 'YOUR_SERVER_URL', CAPX_EMAIL: 'YOUR_ALLOWED_EMAIL', CAPX_LANE: 'byo', X_CLIENT_ID: 'YOUR_X_CLIENT_ID' };
  const jsonConfig = JSON.stringify({ mcpServers: { 'capx-cafe': { command: 'npx', args: ['-y', 'capx-cafe'], env } } }, null, 2);
  const tomlConfig = '[mcp_servers.capx-cafe]\ncommand = "npx"\nargs = ["-y", "capx-cafe"]\n\n[mcp_servers.capx-cafe.env]\nCAPX_CHOKEPOINT_URL = "YOUR_SERVER_URL"\nCAPX_EMAIL = "YOUR_ALLOWED_EMAIL"\nCAPX_LANE = "byo"\nX_CLIENT_ID = "YOUR_X_CLIENT_ID"';
  const agents = {
    claude: { title: 'Add the Claude Code plugin.', description: 'Run these two commands inside Claude Code. The plugin includes the MCP server and capx café skills.', label: 'Claude Code', code: '/plugin marketplace add vb-tyagi/capx-cafe\n/plugin install capx-cafe@capx-cafe' },
    cursor: { title: 'Add capx café to Cursor.', description: 'Merge this server entry into your project’s .cursor/mcp.json. Replace the YOUR_ values with your server URL, allowed email, and X app client ID. Keep your existing servers.', label: '.cursor/mcp.json', code: jsonConfig },
    codex: { title: 'Add capx café to Codex.', description: 'Add this server entry to your Codex config.toml. Replace the YOUR_ values with your server URL, allowed email, and X app client ID. Keep your existing settings.', label: '~/.codex/config.toml', code: tomlConfig },
    windsurf: { title: 'Add capx café to Windsurf.', description: 'Open Windsurf’s MCP configuration and merge this server entry into the JSON. Replace the YOUR_ values with your server URL, allowed email, and X app client ID.', label: 'MCP configuration', code: jsonConfig },
    docker: { title: 'Add the capx café catalog.', description: 'Run this in your terminal. Then open Docker Desktop’s MCP Toolkit, enable capx café, configure its environment, and connect the toolkit to your agent.', label: 'Terminal', code: 'docker mcp catalog pull ghcr.io/vb-tyagi/capx-catalog:latest' },
    other: { title: 'Use any compatible MCP agent.', description: 'Add a stdio MCP server with command npx and arguments -y capx-cafe. The JSON below shows the server configuration; adapt it to your client and replace the YOUR_ values.', label: 'MCP server configuration', code: jsonConfig },
  };
  function selectAgent(key) {
    const agent = agents[key];
    const button = document.querySelector(`[data-agent="${key}"]`);
    activateTabs(button);
    $('install-heading').textContent = agent.title;
    $('install-description').textContent = agent.description;
    $('code-label').textContent = agent.label;
    $('install-code').textContent = agent.code;
  }
  document.querySelectorAll('[data-agent]').forEach((button) => button.addEventListener('click', () => selectAgent(button.dataset.agent)));
  document.querySelectorAll('[data-agent-link]').forEach((link) => link.addEventListener('click', () => selectAgent(link.dataset.agentLink)));
  document.querySelectorAll('[role="tablist"]').forEach((list) => list.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    const current = tabs.indexOf(document.activeElement);
    if (current < 0) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].focus(); tabs[next].click();
  }));
  let toastTimer;
  document.querySelectorAll('[data-copy-target]').forEach((button) => button.addEventListener('click', async () => {
    const target = $(button.dataset.copyTarget);
    const text = target.textContent.trim().replace(/^[“]|[”]$/g, '');
    try {
      await navigator.clipboard.writeText(text);
      $('copy-status').textContent = 'Copied. Ready for your agent.';
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(target); selection.removeAllRanges(); selection.addRange(range);
      $('copy-status').textContent = 'Text selected. Use your browser’s Copy command.';
    }
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $('copy-status').textContent = ''; }, 4500);
  }));
  $('demo-start')?.addEventListener('click', () => {
    $('guardrail-demo').hidden = false; $('guardrail-demo').src = '/assets/demo.gif';
    $('demo-start').hidden = true; $('demo-stop').hidden = false; $('demo-stop').focus({ preventScroll: true });
  });
  $('demo-stop')?.addEventListener('click', () => {
    $('guardrail-demo').hidden = true; $('demo-start').hidden = false; $('demo-stop').hidden = true; $('demo-start').focus({ preventScroll: true });
  });
  document.querySelectorAll('.mobile-menu a').forEach((link) => link.addEventListener('click', () => { link.closest('details').open = false; }));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { const menu = document.querySelector('.mobile-menu'); if (menu.open) { menu.open = false; menu.querySelector('summary').focus(); } } });
})();
