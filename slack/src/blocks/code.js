import { plain, mrkdwn, providerMeta, clip } from '../util.js';

export const CODE_FILENAME = { terraform: 'main.tf', cloudformation: 'template.json' };
const TAB_LABEL = { terraform: 'Terraform', cloudformation: 'CloudFormation' };

/** Code fits inline when it stays inside one 3000-char section. */
export const INLINE_CODE_LIMIT = 2500;

/**
 * The "Infrastructure Code" message — Slack's version of the CodeGenerator tabs.
 * The code itself lands inline when short, otherwise as a snippet in the thread.
 * Returns {blocks, text}.
 */
export function codeMessage(session, activeTab, { generating = false } = {}) {
  const p = providerMeta(session.provider);
  const entry = session.code?.[activeTab];

  const blocks = [
    { type: 'section', text: mrkdwn(`📄 *Infrastructure Code* — ${clip(session.title || 'architecture', 80)} (${p.emoji} ${p.short})`) },
  ];

  if (generating) {
    blocks.push({ type: 'context', elements: [mrkdwn(`⏳ Generating ${TAB_LABEL[activeTab]} with Qwen…`)] });
  } else if (entry?.code) {
    if (entry.code.length <= INLINE_CODE_LIMIT) {
      blocks.push({ type: 'section', text: mrkdwn('```\n' + entry.code + '\n```') });
    } else {
      blocks.push({ type: 'context', elements: [mrkdwn(`📎 Full \`${CODE_FILENAME[activeTab]}\` attached below (${entry.code.length.toLocaleString()} chars) — open it to copy or download.`)] });
    }
  }

  const tabs = ['terraform'];
  if (session.provider === 'aws') tabs.push('cloudformation');
  const elements = tabs.map(t => ({
    type: 'button',
    text: plain(`${t === activeTab ? '📄 ' : ''}${TAB_LABEL[t]}`),
    action_id: `code_tab_${t}`,
    value: session.sid,
    ...(t === activeTab ? { style: 'primary' } : {}),
  }));
  elements.push({
    type: 'button',
    text: plain('🚀 Deploy'),
    action_id: 'code_deploy',
    value: session.sid,
    style: 'danger',
  });
  blocks.push({ type: 'actions', elements });

  if (entry && !generating) {
    const skills = entry.skills_used?.length ? entry.skills_used.join(', ') : 'none';
    blocks.push({
      type: 'context',
      elements: [mrkdwn(clip(`🤖 model: \`${entry.model || 'qwen'}\` · 🧠 learned skills applied: ${skills}`, 2900))],
    });
  }

  const text = generating
    ? `Generating ${TAB_LABEL[activeTab]} code…`
    : `Infrastructure code (${TAB_LABEL[activeTab]}) for ${session.title || 'architecture'}`;
  return { blocks, text };
}
