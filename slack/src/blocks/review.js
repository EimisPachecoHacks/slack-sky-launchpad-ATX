import { plain, mrkdwn, providerMeta, money, totalCost, clip, chunkText, slackify } from '../util.js';

/**
 * The architecture review — native Slack blocks (no image). Each component is
 * its OWN section row with a `static_select` accessory to switch it
 * individually to an alternative service, mirroring the web ComponentList's
 * per-row Switch. Returns {rich, classic, text} — both the same native blocks.
 */
export function reviewMessage(session) {
  const arch = session.architecture || {};
  const comps = arch.components || [];
  const p = providerMeta(session.provider);
  const total = totalCost(arch);
  const altMap = session.alternatives || {};

  // Components often lack `type`; the diagram nodes carry it (matched by id).
  const nodeById = {};
  for (const n of arch.diagram?.nodes || []) nodeById[n.id] = n;
  const typeOf = c => c.type || nodeById[c.id]?.type || nodeById[c.id]?.subLabel || 'service';

  // Potential savings = sum of (current − cheapest alternative) where cheaper.
  let savings = 0;
  for (const c of comps) {
    const best = (altMap[String(c.id)] || []).reduce((m, a) => (a.cost < (m?.cost ?? Infinity) ? a : m), null);
    if (best && best.cost < (c.cost || 0)) savings += (c.cost || 0) - best.cost;
  }

  const header = { type: 'header', text: plain(`🏗️ ${clip(session.title || arch.name || 'Architecture', 140)}`) };
  const kpis = {
    type: 'section',
    fields: [
      mrkdwn(`*💰 Total monthly cost*\n${money(total)}`),
      mrkdwn(`*🧩 Components*\n${comps.length}`),
      mrkdwn(`*☁️ Provider*\n${p.emoji} ${p.label}`),
      mrkdwn(`*📉 Potential savings*\n${savings > 0 ? money(savings) : '—'}`),
    ],
  };
  if (session.summaryMessage || arch.description) {
    kpis.text = mrkdwn(clip(session.summaryMessage || arch.description, 600));
  }

  // One section per component + a Switch dropdown (accessory) when it has alternatives.
  const rowBlocks = [];
  for (const c of comps) {
    const cid = String(c.id);
    const alts = altMap[cid] || [];
    const rowText = `*${clip(c.name || cid, 90)}*  \`${clip(typeOf(c), 20)}\`  ·  *${money(Number(c.cost) || 0)}/mo*` +
      (c.description ? `\n_${clip(c.description, 120)}_` : '');
    const row = { type: 'section', block_id: `comp_${cid}`, text: mrkdwn(rowText) };
    if (alts.length) {
      row.accessory = {
        type: 'static_select',
        action_id: 'swap_pick',
        placeholder: plain('🔄 Switch service'),
        options: alts.slice(0, 100).map((a, i) => {
          const diff = (Number(a.cost) || 0) - (Number(c.cost) || 0);
          const tag = diff < 0 ? `save ${money(-diff)}` : diff > 0 ? `+${money(diff)}` : 'same cost';
          return {
            text: plain(clip(`${a.name} — ${money(Number(a.cost) || 0)}/mo (${tag})`, 74)),
            value: `${session.sid}~~${cid}~~${i}`,
          };
        }),
      };
    }
    rowBlocks.push(row);
  }

  const actions = {
    type: 'actions',
    elements: [
      { type: 'button', style: 'primary', text: plain('⚙️ Generate Code'), action_id: 'rev_gen_code', value: session.sid },
      { type: 'button', text: plain('🧠 AI Reasoning'), action_id: 'rev_details', value: session.sid },
      { type: 'button', text: plain('🚀 Deploy'), action_id: 'code_deploy', value: session.sid },
    ],
  };

  const ctxParts = [];
  if (session.detectedComponents?.length) ctxParts.push(`👁️ Detected: ${clip(session.detectedComponents.join(', '), 200)}`);
  if (session.gitlabIssueUrl) ctxParts.push(`📋 <${session.gitlabIssueUrl}|GitLab issue${session.gitlabIssueIid ? ` #${session.gitlabIssueIid}` : ''}>`);
  ctxParts.push('🔄 use each row\'s dropdown to swap that component individually');
  ctxParts.push(`session \`${session.sid}\``);
  const context = { type: 'context', elements: [mrkdwn(ctxParts.join(' · '))] };

  const blocks = [header, kpis, { type: 'divider' }, ...rowBlocks, { type: 'divider' }, actions, context];
  const text = `Architecture ready: ${session.title || arch.name || 'untitled'} — ${comps.length} components, ~${money(total)}/mo`;
  return { rich: blocks, classic: blocks, text };
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
