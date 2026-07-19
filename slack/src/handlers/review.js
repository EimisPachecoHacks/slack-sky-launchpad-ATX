import * as api from '../api.js';
import { getSession } from '../state.js';
import { reasoningBlocks, reviewMessage } from '../blocks/review.js';
import { codeMessage, CODE_FILENAME, INLINE_CODE_LIMIT } from '../blocks/code.js';
import { updateRich } from '../blocks/common.js';
import { clip, money, fmtElapsed, startProgress, providerMeta } from '../util.js';
import { postToSession, notifyUser, SESSION_EXPIRED } from './shared.js';
import { uploadDiagram } from './diagram.js';

/** Snapshot each component's original values so a swap can be reverted. */
export function snapshotOriginals(arch) {
  arch.__originals = {};
  for (const c of arch.components || []) {
    arch.__originals[String(c.id)] = { name: c.name, cost: c.cost, description: c.description };
  }
}

/** Parse JSON out of an LLM answer (tolerates fences and prose). */
function jsonFrom(text) {
  const cleaned = String(text).replace(/```(?:json)?/g, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('no JSON in model answer');
  return JSON.parse(cleaned.slice(start, end + 1));
}

/**
 * Populate session.optim ONCE (idempotent): for each component, a cost-optimized
 * and a performance-optimized option (name, cost, note). This is the data the
 * Cost/Performance tabs project — computed at generation, so tab switching is
 * a pure instant view change with no further model calls. Best-effort: on
 * failure, tabs still render (components just show "already optimal").
 */
export async function ensureOptimizations(session) {
  if (session.optim) return session.optim;
  snapshotOriginals(session.architecture);
  const comps = (session.architecture?.components || []).map(c => ({
    id: c.id, name: c.name, cost: c.cost, type: c.type, description: (c.description || '').slice(0, 100),
  }));
  session.optim = {};
  // Seed with any real backend alternatives (cheapest → cost bucket).
  for (const a of session.architecture?.alternatives || []) {
    const cid = String(a.originalComponentId ?? a.original_component_id ?? '');
    if (!cid) continue;
    (session.optim[cid] ||= {}).cost = { name: a.name, cost: a.cost, note: a.description || '' };
  }
  try {
    const answer = await api.askChat(
      `You are a ${session.provider} cloud cost/performance advisor. For EACH component below, give:\n` +
      `- "cost": the cheapest same-role service that still works (name + realistic monthly cost + short note),\n` +
      `- "performance": the fastest/most capable same-role service (name + realistic monthly cost + short note).\n` +
      `If the current component is already best for a dimension, repeat its exact name and cost.\n` +
      `Components: ${JSON.stringify(comps)}\n` +
      `Return ONLY JSON: {"items":[{"component_id":"...","cost":{"name":"...","cost":12,"note":"..."},"performance":{"name":"...","cost":40,"note":"..."}}]}`,
    );
    for (const it of jsonFrom(answer).items || []) {
      const cid = String(it.component_id);
      const entry = (session.optim[cid] ||= {});
      if (it.cost?.name) entry.cost = it.cost;
      if (it.performance?.name) entry.performance = it.performance;
    }
  } catch { /* tabs still work; components without data show "already optimal" */ }
  return session.optim;
}

/** Apply a chosen option {name,cost,note|reason} to a component: updates the
 * component, its diagram node, and the total. */
function applySwap(session, compId, alt) {
  const arch = session.architecture;
  const comp = (arch.components || []).find(c => String(c.id) === String(compId));
  if (!comp) throw new Error('component no longer exists');
  const before = `${comp.name} (${money(Number(comp.cost) || 0)}/mo)`;
  comp.name = alt.name;
  comp.cost = Number(alt.cost) || comp.cost;
  comp.description = alt.note || alt.reason || comp.description;
  const node = (arch.diagram?.nodes || []).find(n => String(n.id) === String(compId));
  if (node) {
    node.label = alt.name;
    node.cost = comp.cost;
  }
  const total = (arch.components || []).reduce((s, c) => s + (Number(c.cost) || 0), 0);
  if (arch.metadata) arch.metadata.totalCost = total;
  session.code = {}; // generated code is stale after a swap
  session.codeMsg = null;
  return { before, after: `${alt.name} (${money(Number(alt.cost) || 0)}/mo)` };
}

async function renderCodeMessage(client, session, type, opts = {}) {
  const { blocks, text } = codeMessage(session, type, opts);
  if (session.codeMsg) {
    await client.chat.update({ channel: session.codeMsg.channel, ts: session.codeMsg.ts, text, blocks });
  } else {
    const posted = await postToSession(client, session, { text, blocks });
    session.codeMsg = { channel: posted.channel, ts: posted.ts };
  }
}

/** Fetches (or reuses cached) code for a tab, renders the message, attaches the snippet. */
export async function runGenerateCode(client, session, type) {
  session.activeTab = type;
  session.step = 'code';

  if (!session.code[type]?.code) {
    await renderCodeMessage(client, session, type, { generating: true });
    try {
      const resp = await api.generateCode({
        architecture: session.architecture,
        code_type: type,
        provider: session.provider,
      });
      session.code[type] = {
        code: resp.data?.code || '',
        skills_used: resp.data?.skills_used || [],
        model: resp.data?.model || '',
        uploaded: false,
      };
    } catch (err) {
      await renderCodeMessage(client, session, type, { generating: false });
      await postToSession(client, session, { text: `❌ Code generation failed: ${err.message} — hit the ${type === 'terraform' ? 'Terraform' : 'CloudFormation'} button to retry.` });
      return;
    }
  }

  await renderCodeMessage(client, session, type);

  const entry = session.code[type];
  if (entry.code.length > INLINE_CODE_LIMIT && !entry.uploaded) {
    await client.files.uploadV2({
      channel_id: session.codeMsg.channel,
      thread_ts: session.codeMsg.ts,
      file: Buffer.from(entry.code, 'utf8'),
      filename: CODE_FILENAME[type],
      title: `${session.title || 'architecture'} — ${type}`,
    });
    entry.uploaded = true;
  }
}

export default function register(app) {
  // Cost/Performance projection "tabs" — PURE VIEW TOGGLE. No API call, no
  // regeneration; just re-render the same table under the selected projection.
  app.action(/^rev_tab_/, async ({ ack, body, client, action }) => {
    await ack();
    const session = getSession(action.value);
    if (!session?.architecture || !session.reviewMsg) return notifyUser(client, body, SESSION_EXPIRED);
    const view = action.action_id.replace('rev_tab_', '');
    if (!['cost', 'performance'].includes(view) || view === (session.viewMode || 'cost')) return;
    session.viewMode = view;
    const { channel, ts } = session.reviewMsg;
    const { rich, classic, text } = reviewMessage(session);
    await updateRich(client, channel, ts, text, rich, classic); // instant; diagram unchanged
  });

  // Per-component switch: static_select accessory on a component row.
  // value = "<sid>~~<componentId>~~<cost|performance|restore>".
  app.action('swap_pick', async ({ ack, body, client, action }) => {
    await ack();
    const [sid, compId, sel] = String(action.selected_option?.value || '').split('~~');
    const session = getSession(sid);
    if (!session?.architecture || !session.reviewMsg) return notifyUser(client, body, SESSION_EXPIRED);
    let opt;
    if (sel === 'restore') {
      const orig = session.architecture.__originals?.[compId];
      if (!orig) return notifyUser(client, body, 'No default recorded for that component.');
      opt = { name: orig.name, cost: orig.cost, note: orig.description };
    } else {
      opt = session.optim?.[compId]?.[sel];
      if (!opt) return notifyUser(client, body, 'That option is no longer available.');
    }
    const { before, after } = applySwap(session, compId, opt);
    session.code = {}; session.codeMsg = null;
    const { channel, ts } = session.reviewMsg;
    const { rich, classic, text } = reviewMessage(session);
    await updateRich(client, channel, ts, text, rich, classic);
    uploadDiagram(client, channel, ts, session).catch(() => {});
    await client.chat.postMessage({
      channel, thread_ts: ts,
      text: `${sel === 'restore' ? '↩️ Restored' : '🔄 Switched'} *${clip(before, 80)}* → *${clip(after, 80)}*. Cost total and diagram updated.`,
    });
  });

  app.action('rev_gen_code', async ({ ack, body, client, action }) => {
    await ack();
    const session = getSession(action.value);
    if (!session?.architecture) return notifyUser(client, body, SESSION_EXPIRED);
    await runGenerateCode(client, session, session.activeTab || 'terraform');
  });

  app.action(/^code_tab_/, async ({ ack, body, client, action }) => {
    await ack();
    const session = getSession(action.value);
    if (!session?.architecture) return notifyUser(client, body, SESSION_EXPIRED);
    const type = action.action_id.replace('code_tab_', '');
    if (!['terraform', 'cloudformation'].includes(type)) return;
    await runGenerateCode(client, session, type);
  });

  app.action('rev_details', async ({ ack, body, client, action }) => {
    await ack();
    const session = getSession(action.value);
    if (!session) return notifyUser(client, body, SESSION_EXPIRED);
    const blocks = reasoningBlocks(session);
    if (session.reviewMsg) {
      await client.chat.postMessage({
        channel: session.reviewMsg.channel,
        thread_ts: session.reviewMsg.ts,
        blocks,
        text: 'AI reasoning',
      });
    } else {
      await postToSession(client, session, { blocks, text: 'AI reasoning' });
    }
  });
}
