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

  const cols = ['Component', 'Type', 'Est. $/mo'];
  const rows = comps.map(c => ({
    Component: c.name || c.id || '?',
    Type: c.type || '—',
    'Est. $/mo': Number(c.cost) || 0,
  }));
  const caption = `Components — est. ${money(cost)}/mo total`;

  const ctxParts = [];
  if (session.detectedComponents?.length) ctxParts.push(`👁️ Detected: ${clip(session.detectedComponents.join(', '), 200)}`);
  if (session.gitlabIssueUrl) ctxParts.push(`📋 <${session.gitlabIssueUrl}|GitLab issue${session.gitlabIssueIid ? ` #${session.gitlabIssueIid}` : ''}>`);
  ctxParts.push(`session \`${session.sid}\``);
  const context = { type: 'context', elements: [mrkdwn(ctxParts.join(' · '))] };

  const rich = [card(cardOpts), ...(rows.length ? [dataTable(cols, rows, caption)] : []), context];
  const classic = [...cardClassic(cardOpts), ...(rows.length ? tableClassic(cols, rows) : []), context];
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
