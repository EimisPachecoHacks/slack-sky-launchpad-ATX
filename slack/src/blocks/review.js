import { card, cardClassic, dataTable, tableClassic } from './common.js';
import { mrkdwn, providerMeta, money, totalCost, clip, chunkText, slackify } from '../util.js';

/**
 * The architecture review — Slack's version of the web app's diagram + component
 * list screen. Returns {rich, classic, text} for postRich/updateRich.
 */
export function reviewMessage(session) {
  const arch = session.architecture || {};
  const comps = arch.components || [];
  const p = providerMeta(session.provider);
  const cost = totalCost(arch);

  const cardOpts = {
    emoji: '🏗️',
    title: session.title || arch.name || 'Architecture',
    subtitle: `${p.emoji} ${p.label} · ${comps.length} components · ~${money(cost)}/mo`,
    body: clip(session.summaryMessage || arch.description || 'Architecture designed by Nemotron.', 200),
    buttons: [
      { text: '⚙️ Generate Code', action_id: 'rev_gen_code', value: session.sid, style: 'primary' },
      { text: '🧠 AI Reasoning', action_id: 'rev_details', value: session.sid },
    ],
  };

  // Components often lack `type`; the diagram nodes carry it (matched by id).
  const nodeById = {};
  for (const n of arch.diagram?.nodes || []) nodeById[n.id] = n;
  const typeOf = c => c.type || nodeById[c.id]?.subLabel || nodeById[c.id]?.type || '—';

  const cols = ['Component', 'Type', 'Est. $/mo'];
  const rows = comps.map(c => ({
    Component: c.name || c.id || '?',
    Type: typeOf(c),
    'Est. $/mo': Number(c.cost) || 0,
  }));
  const caption = `Components — est. ${money(cost)}/mo total`;

  // Optimization switcher — same three goals as the web version; the active
  // goal is highlighted. Clicking re-generates the architecture with that goal.
  const goal = session.optimization || 'balanced';
  const OPT = [['cost', '💰 Cost'], ['balanced', '⚖️ Balanced'], ['performance', '🚀 Performance']];
  const optRow = {
    type: 'actions',
    elements: OPT.map(([g, label]) => ({
      type: 'button',
      text: { type: 'plain_text', text: g === goal ? `${label} ✓` : label, emoji: true },
      action_id: `rev_opt_${g}`,
      value: session.sid,
      ...(g === goal ? { style: 'primary' } : {}),
    })),
  };
  const optHint = { type: 'context', elements: [mrkdwn(`Optimization: *${goal}* — switch to re-design the architecture for that goal`)] };

  const ctxParts = [];
  if (session.detectedComponents?.length) ctxParts.push(`👁️ Detected: ${clip(session.detectedComponents.join(', '), 200)}`);
  if (session.gitlabIssueUrl) ctxParts.push(`📋 <${session.gitlabIssueUrl}|GitLab issue${session.gitlabIssueIid ? ` #${session.gitlabIssueIid}` : ''}>`);
  ctxParts.push(`session \`${session.sid}\``);
  const context = { type: 'context', elements: [mrkdwn(ctxParts.join(' · '))] };

  const rich = [card(cardOpts), ...(rows.length ? [dataTable(cols, rows, caption)] : []), optHint, optRow, context];
  const classic = [...cardClassic(cardOpts), ...(rows.length ? tableClassic(cols, rows) : []), optHint, optRow, context];
  const text = `Architecture ready: ${session.title || arch.name || 'untitled'} — ${comps.length} components, ~${money(cost)}/mo`;
  return { rich, classic, text };
}

/** Threaded reply with the AI reasoning + recommendations (chunked ≤3000 chars). */
export function reasoningBlocks(session) {
  const blocks = [{ type: 'section', text: mrkdwn('*🧠 AI Reasoning*') }];
  const reasoning = slackify(session.reasoning || '_No reasoning was returned._');
  for (const chunk of chunkText(reasoning, 2900).slice(0, 10)) {
    blocks.push({ type: 'section', text: mrkdwn(chunk) });
  }
  if (session.recommendations?.length) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: mrkdwn('*💡 Recommendations*\n' + clip(session.recommendations.map(r => `• ${r}`).join('\n'), 2900)),
    });
  }
  return blocks;
}
