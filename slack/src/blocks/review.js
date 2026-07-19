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

  // Cross-variant savings (like the web "Monthly Savings"): the gap between the
  // priciest generated variant and the current one; falls back to per-component
  // alternative savings before other variants exist.
  const variantCosts = Object.values(session.variants || {}).map(v => totalCost(v)).filter(n => n > 0);
  const crossSavings = variantCosts.length > 1 ? Math.max(...variantCosts) - total : 0;
  const monthlySavings = crossSavings > 0 ? crossSavings : savings;

  const active = session.activeVariant || 'balanced';
  const FOCUS = { balanced: 'Balanced', cost: 'Cost Efficiency', performance: 'Performance' };

  const header = { type: 'header', text: plain(`🏗️ ${clip(session.title || arch.name || 'Architecture', 140)}`) };

  // Optimization "tabs" (Slack has no tab widget — highlighted toggle buttons are
  // the standard pattern; the active one is primary/green, like a selected tab).
  const TABS = [['balanced', '⚖️ Default'], ['cost', '💰 Cost Optimized'], ['performance', '⚡ Performance Optimized']];
  const tabs = {
    type: 'actions',
    elements: TABS.map(([g, label]) => ({
      type: 'button',
      text: plain(g === active ? `● ${label}` : label),
      action_id: `rev_tab_${g}`,
      value: session.sid,
      ...(g === active ? { style: 'primary' } : {}),
    })),
  };

  const kpis = {
    type: 'section',
    fields: [
      mrkdwn(`*💰 Total Monthly Cost*\n${money(total)}`),
      mrkdwn(`*📈 Monthly Savings*\n${monthlySavings > 0 ? money(monthlySavings) : '—'}`),
      mrkdwn(`*🎯 Optimization Focus*\n${FOCUS[active] || 'Balanced'}`),
      mrkdwn(`*🧩 Components*\n${comps.length} · ${p.emoji} ${p.label}`),
    ],
  };
  if (session.summaryMessage || arch.description) {
    kpis.text = mrkdwn(clip(session.summaryMessage || arch.description, 600));
  }

  // One section per component + a Switch dropdown (accessory) with its
  // alternatives, plus a "restore original" option if it was swapped.
  const originals = arch.__originals || {};
  const rowBlocks = [];
  for (const c of comps) {
    const cid = String(c.id);
    const alts = altMap[cid] || [];
    const orig = originals[cid];
    const swapped = orig && orig.name !== c.name;
    const rowText = `*${clip(c.name || cid, 90)}*  \`${clip(typeOf(c), 20)}\`  ·  *${money(Number(c.cost) || 0)}/mo*` +
      (swapped ? '  _(swapped)_' : '') +
      (c.description ? `\n_${clip(c.description, 120)}_` : '');
    const row = { type: 'section', block_id: `comp_${cid}`, text: mrkdwn(rowText) };
    const options = [];
    if (swapped) {
      options.push({ text: plain(clip(`↩️ ${orig.name} — ${money(Number(orig.cost) || 0)}/mo (default)`, 74)), value: `${session.sid}~~${cid}~~restore` });
    }
    for (let i = 0; i < alts.length; i++) {
      const a = alts[i];
      const diff = (Number(a.cost) || 0) - (Number(c.cost) || 0);
      const tag = diff < 0 ? `save ${money(-diff)}` : diff > 0 ? `+${money(diff)}` : 'same cost';
      options.push({ text: plain(clip(`${a.name} — ${money(Number(a.cost) || 0)}/mo (${tag})`, 74)), value: `${session.sid}~~${cid}~~${i}` });
    }
    if (options.length) {
      row.accessory = { type: 'static_select', action_id: 'swap_pick', placeholder: plain('🔄 Switch service'), options: options.slice(0, 100) };
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
  ctxParts.push('tabs re-optimize all · each row\'s dropdown swaps one component');
  ctxParts.push(`session \`${session.sid}\``);
  const context = { type: 'context', elements: [mrkdwn(ctxParts.join(' · '))] };

  const blocks = [header, tabs, kpis, { type: 'divider' }, ...rowBlocks, { type: 'divider' }, actions, context];
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
