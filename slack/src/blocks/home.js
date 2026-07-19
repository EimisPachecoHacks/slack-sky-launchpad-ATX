import { plain, mrkdwn, PROVIDERS, providerMeta, money, totalCost, clip } from '../util.js';

const STEP_LABEL = {
  method: '📝 draft', provider: '📝 draft', usecase: '📝 draft',
  generating: '🧠 generating…', review: '🏗️ designed', code: '📄 code ready',
  deploying: '🚀 deploying…', done: '✅ deployed', failed: '❌ failed',
};

/**
 * App Home dashboard. Classic blocks only — the Home surface has the least
 * certain support for the newer agent blocks, so this must always render.
 */
export function homeView({ health = null, skills = null, recents = [] } = {}) {
  const blocks = [
    { type: 'header', text: plain('🚀 Sky Launchpad') },
    { type: 'section', text: mrkdwn('Turn plain English or an architecture diagram into *deployed cloud infrastructure* — designed, coded, and applied with Terraform, powered by NVIDIA Nemotron on self-hosted vLLM.') },
    {
      type: 'actions',
      elements: [
        { type: 'button', style: 'primary', text: plain('✨ New Architecture'), action_id: 'sky_new' },
        { type: 'button', text: plain('🖼️ Analyze a Diagram'), action_id: 'img_start' },
        { type: 'button', text: plain('🔄 Refresh'), action_id: 'sky_refresh_home' },
      ],
    },
    { type: 'divider' },
  ];

  const backendLine = health
    ? `🟢 *Backend:* healthy · model \`${health.model_id || '?'}\`${health.llm_connected === false ? ' · ⚠️ LLM not connected' : ''}`
    : '🔴 *Backend:* unreachable — start it with `uvicorn backend.api.main:app --port 8000` from `project/`';
  const skillsLine = skills
    ? `🧠 *Skills learned:* ${skills.count ?? 0} · *Retries avoided:* ${skills.total_retries_avoided ?? 0}`
    : '🧠 *Skills learned:* —';
  blocks.push({ type: 'section', fields: [mrkdwn(backendLine), mrkdwn(skillsLine)] });

  blocks.push({ type: 'divider' });
  blocks.push({ type: 'section', text: mrkdwn('*Quick start* — pick a provider and describe your project:') });
  blocks.push({
    type: 'actions',
    elements: Object.entries(PROVIDERS).map(([id, p]) => ({
      type: 'button', text: plain(`${p.emoji} ${p.short}`), action_id: `sky_quickstart_${id}`, value: id,
    })),
  });

  blocks.push({ type: 'divider' });
  blocks.push({ type: 'section', text: mrkdwn('*Recent architectures*') });
  if (!recents.length) {
    blocks.push({ type: 'context', elements: [mrkdwn('None yet — hit *✨ New Architecture* to design your first one.')] });
  } else {
    for (const s of recents.slice(0, 5)) {
      const p = providerMeta(s.provider);
      const cost = s.architecture ? ` · ~${money(totalCost(s.architecture))}/mo` : '';
      blocks.push({
        type: 'section',
        text: mrkdwn(`*${clip(s.title || 'Untitled', 60)}* — ${p.emoji} ${p.short}${cost} · ${STEP_LABEL[s.step] || s.step}`),
        accessory: s.architecture
          ? { type: 'button', text: plain('Open'), action_id: 'sky_open', value: s.sid }
          : undefined,
      });
      if (!blocks[blocks.length - 1].accessory) delete blocks[blocks.length - 1].accessory;
    }
  }

  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'context',
    elements: [mrkdwn(`Backend: \`${process.env.SKY_API_URL || 'http://localhost:8000'}\` · Sessions are in-memory and reset when the app restarts · \`/sky\` works anywhere`)],
  });

  return { type: 'home', blocks };
}

/** Entry card posted for /sky, DMs, and mentions. */
export function entryCard() {
  return [
    { type: 'section', text: mrkdwn('*🚀 Sky Launchpad* — what are we building today?\nDescribe a project and I\'ll design the cloud architecture, generate Terraform, and deploy it for real.') },
    {
      type: 'actions',
      elements: [
        { type: 'button', style: 'primary', text: plain('🧭 Guided Wizard'), action_id: 'sky_new' },
        { type: 'button', text: plain('🖼️ AI Image Analysis'), action_id: 'img_start' },
      ],
    },
    { type: 'context', elements: [mrkdwn('Tip: `/sky new` opens the wizard directly · check the *Home* tab for your dashboard')] },
  ];
}

export function helpBlocks() {
  return [
    { type: 'section', text: mrkdwn('*🚀 Sky Launchpad — help*') },
    {
      type: 'section',
      text: mrkdwn([
        '• `/sky` — show the start card',
        '• `/sky new` — open the architecture wizard',
        '• `/sky status` — backend health check',
        '• *DM me an image/PDF* of an architecture diagram and I\'ll reconstruct it',
        '• Open my *Home tab* for the dashboard: health, learned skills, recent work',
      ].join('\n')),
    },
    { type: 'context', elements: [mrkdwn('Flow: describe → review architecture & costs → generate Terraform/CloudFormation → deploy → GitLab MR')] },
  ];
}
