import { plain, mrkdwn, providerMeta, money, totalCost, clip, chunkText, slackify } from '../util.js';

/**
 * The architecture review — native Slack blocks (no image), mirroring the web
 * ComponentList. The Cost/Performance "tabs" are a READ-ONLY projection: they
 * only change how each component's optimized cost + difference is displayed
 * (no regeneration, no API call, instant). Each row's dropdown actually applies
 * an alternative to that one component. Returns {rich, classic, text}.
 */
export function reviewMessage(session) {
  const arch = session.architecture || {};
  const comps = arch.components || [];
  const p = providerMeta(session.provider);
  const total = totalCost(arch);
  const optim = session.optim || {};                 // { cid: { cost:{name,cost,note}, performance:{...} } }
  const view = session.viewMode === 'performance' ? 'performance' : 'cost';
  const originals = arch.__originals || {};

  const nodeById = {};
  for (const n of arch.diagram?.nodes || []) nodeById[n.id] = n;
  const typeOf = c => c.type || nodeById[c.id]?.type || nodeById[c.id]?.subLabel || 'service';

  // Projected total + savings under the ACTIVE view (read-only, like the web).
  let projTotal = 0;
  let savings = 0;
  for (const c of comps) {
    const proj = optim[String(c.id)]?.[view];
    const projCost = proj && Number.isFinite(Number(proj.cost)) ? Number(proj.cost) : Number(c.cost) || 0;
    projTotal += projCost;
    const d = (Number(c.cost) || 0) - projCost;
    if (d > 0) savings += d;
  }

  const header = { type: 'header', text: plain(`🏗️ ${clip(session.title || arch.name || 'Architecture', 140)}`) };

  // Cost/Performance projection "tabs" — pure view toggle (Slack has no tab
  // widget; the active one is highlighted, like a selected tab).
  const TABS = [['cost', '💰 Cost Optimized'], ['performance', '⚡ Performance Optimized']];
  const tabs = {
    type: 'actions',
    elements: TABS.map(([v, label]) => ({
      type: 'button',
      text: plain(v === view ? `● ${label}` : label),
      action_id: `rev_tab_${v}`,
      value: session.sid,
      ...(v === view ? { style: 'primary' } : {}),
    })),
  };

  const focusLabel = view === 'performance' ? 'Performance' : 'Cost Efficiency';
  const kpis = {
    type: 'section',
    fields: [
      mrkdwn(`*💰 Total Monthly Cost*\n${money(total)}`),
      mrkdwn(`*📈 ${view === 'performance' ? 'Extra Cost' : 'Monthly Savings'}*\n${money(view === 'performance' ? Math.max(0, projTotal - total) : savings)}`),
      mrkdwn(`*🎯 Optimization Focus*\n${focusLabel}`),
      mrkdwn(`*🧩 Components*\n${comps.length} · ${p.emoji} ${p.label}`),
    ],
  };
  if (session.summaryMessage || arch.description) {
    kpis.text = mrkdwn(clip(session.summaryMessage || arch.description, 600));
  }

  // One section per component: current cost + the projected optimized cost/diff
  // for the active view, and a dropdown to actually switch that component.
  const rowBlocks = [];
  for (const c of comps) {
    const cid = String(c.id);
    const cur = Number(c.cost) || 0;
    const orig = originals[cid];
    const swapped = orig && orig.name !== c.name;
    const o = optim[cid] || {};
    const proj = o[view];

    let projLine = '';
    if (proj && proj.name) {
      const pc = Number.isFinite(Number(proj.cost)) ? Number(proj.cost) : cur;
      const d = pc - cur;
      const tag = d < 0 ? `▼ save ${money(-d)}` : d > 0 ? `▲ +${money(d)}` : 'no change';
      const same = proj.name === c.name;
      projLine = `\n${view === 'cost' ? '💰' : '⚡'} *${view === 'cost' ? 'Cost' : 'Performance'}-optimized:* ${same ? 'already optimal' : `${clip(proj.name, 40)} — *${money(pc)}/mo* (${tag})`}`;
    }
    const rowText = `*${clip(c.name || cid, 90)}*  \`${clip(typeOf(c), 20)}\`  ·  *${money(cur)}/mo*` +
      (swapped ? '  _(swapped)_' : '') +
      (c.description ? `\n_${clip(c.description, 110)}_` : '') +
      projLine;

    const row = { type: 'section', block_id: `comp_${cid}`, text: mrkdwn(rowText) };

    // Switch dropdown: apply the cost / performance option, or restore default.
    const options = [];
    if (swapped) options.push({ text: plain(clip(`↩️ ${orig.name} — ${money(Number(orig.cost) || 0)}/mo (default)`, 74)), value: `${session.sid}~~${cid}~~restore` });
    for (const [key, icon] of [['cost', '💰'], ['performance', '⚡']]) {
      const opt = o[key];
      if (opt && opt.name && opt.name !== c.name) {
        const d = (Number(opt.cost) || 0) - cur;
        const tag = d < 0 ? `save ${money(-d)}` : d > 0 ? `+${money(d)}` : 'same';
        options.push({ text: plain(clip(`${icon} ${opt.name} — ${money(Number(opt.cost) || 0)}/mo (${tag})`, 74)), value: `${session.sid}~~${cid}~~${key}` });
      }
    }
    if (options.length) {
      row.accessory = { type: 'static_select', action_id: 'swap_pick', placeholder: plain('🔄 Switch'), options: options.slice(0, 100) };
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
  ctxParts.push('tabs preview cost vs performance · dropdown applies a switch');
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
