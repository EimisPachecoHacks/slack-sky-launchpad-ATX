import * as api from '../api.js';
import { getSession } from '../state.js';
import { reasoningBlocks, reviewMessage } from '../blocks/review.js';
import { codeMessage, CODE_FILENAME, INLINE_CODE_LIMIT } from '../blocks/code.js';
import { swapLoadingView, swapErrorView, swapView } from '../blocks/swap.js';
import { updateRich } from '../blocks/common.js';
import { providerMeta, fmtElapsed, startProgress, clip, money } from '../util.js';
import { postToSession, notifyUser, SESSION_EXPIRED } from './shared.js';
import { uploadDiagram } from './diagram.js';

/** Parse JSON out of an LLM answer (tolerates fences and prose). */
function jsonFrom(text) {
  const cleaned = String(text).replace(/```(?:json)?/g, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('no JSON in model answer');
  return JSON.parse(cleaned.slice(start, end + 1));
}

/** Per-component alternatives the BACKEND already returned (same data the web
 * ComponentList uses): arch.alternatives[], each tagged with originalComponentId. */
function realAlternatives(arch) {
  const map = {};
  for (const a of arch.alternatives || []) {
    const cid = String(a.originalComponentId ?? a.original_component_id ?? '');
    if (!cid) continue;
    (map[cid] ||= []).push({ name: a.name, cost: a.cost, reason: a.description || a.reason || '' });
  }
  return map;
}

/** Build the component→alternatives map: the real backend alternatives first
 * (instant, reliable), then best-effort Nemotron enrichment for any component
 * that has none, so most rows are switchable. */
async function buildAlternatives(session) {
  const arch = session.architecture;
  const map = realAlternatives(arch);
  const missing = (arch.components || []).filter(c => !map[String(c.id)]?.length);
  if (missing.length) {
    try {
      const comps = missing.map(c => ({ id: c.id, name: c.name, cost: c.cost, description: (c.description || '').slice(0, 120) }));
      const answer = await api.askChat(
        `For each of these ${session.provider} cloud components, propose up to 2 alternative services on the SAME ` +
        `provider that serve the same role (e.g. a different database engine, a cheaper compute tier), with a realistic ` +
        `monthly cost and a one-line reason. Components: ${JSON.stringify(comps)}\n` +
        `Return ONLY JSON: {"alternatives":[{"component_id":"...","options":[{"name":"...","cost":12,"reason":"..."}]}]}`,
      );
      for (const a of jsonFrom(answer).alternatives || []) {
        const cid = String(a.component_id);
        if (!map[cid]?.length) map[cid] = (a.options || []).slice(0, 4);
      }
    } catch { /* real alternatives still work */ }
  }
  return map;
}

/** Apply a chosen alternative to the architecture: component, diagram node, totals. */
function applySwap(session, compId, alt) {
  const arch = session.architecture;
  const comp = (arch.components || []).find(c => String(c.id) === String(compId));
  if (!comp) throw new Error('component no longer exists');
  const before = `${comp.name} (${money(Number(comp.cost) || 0)}/mo)`;
  comp.name = alt.name;
  comp.cost = Number(alt.cost) || comp.cost;
  comp.description = alt.reason || comp.description;
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

/** Re-design the architecture with a different optimization goal, updating the
 * review message in place — Slack's version of the web optimization switch. */
async function reoptimize(client, session, goal) {
  const prevGoal = session.optimization || 'balanced';
  session.optimization = goal;
  const { channel, ts } = session.reviewMsg;
  const p = providerMeta(session.provider);
  const label = s => `🧠 Re-designing *${session.title}* optimized for *${goal}* with Nemotron… (${fmtElapsed(s)} elapsed)`;
  await client.chat.update({ channel, ts, text: label(0), blocks: [] });
  const stop = startProgress(client, channel, ts, label, { maxUpdates: 60 });
  try {
    const resp = await api.generateArchitecture({
      title: session.title,
      description: session.description,
      requirements: session.requirements,
      provider: session.provider,
      optimization_goal: goal,
    });
    stop();
    session.architecture = resp.data || {};
    session.reasoning = resp.reasoning || '';
    session.summaryMessage = resp.message || '';
    session.code = {}; // stale — the architecture changed
    session.codeMsg = null;
    const { rich, classic, text } = reviewMessage(session);
    await updateRich(client, channel, ts, text, rich, classic);
    uploadDiagram(client, channel, ts, session).catch(() => {});
  } catch (err) {
    stop();
    // Restore the previous design instead of leaving a dead message.
    session.optimization = prevGoal;
    const { rich, classic, text } = reviewMessage(session);
    await updateRich(client, channel, ts, text, rich, classic);
    await client.chat.postMessage({
      channel, thread_ts: ts,
      text: `❌ Re-optimization for *${goal}* failed (${clip(err.message, 300)}). Kept the previous *${prevGoal}* design — try again in a moment.`,
    });
  }
}

export default function register(app) {
  app.action(/^rev_opt_/, async ({ ack, body, client, action }) => {
    await ack();
    const session = getSession(action.value);
    if (!session?.architecture || !session.reviewMsg) return notifyUser(client, body, SESSION_EXPIRED);
    const goal = action.action_id.replace('rev_opt_', '');
    if (!['cost', 'balanced', 'performance'].includes(goal) || goal === (session.optimization || 'balanced')) return;
    await reoptimize(client, session, goal);
  });

  // "🔄 Swap component" — placeholder modal, Nemotron proposes alternatives,
  // then the dependent selects (component → its alternatives).
  app.action('rev_swap', async ({ ack, body, client, action }) => {
    await ack();
    const session = getSession(action.value);
    if (!session?.architecture) return notifyUser(client, body, SESSION_EXPIRED);
    const ph = await client.views.open({ trigger_id: body.trigger_id, view: swapLoadingView(session.sid) });
    try {
      session.alternatives = await buildAlternatives(session);
      // Default to the first component that actually has alternatives.
      const firstId = (session.architecture.components || [])
        .map(c => String(c.id)).find(id => session.alternatives[id]?.length)
        || session.architecture.components?.[0]?.id;
      await client.views.update({ view_id: ph.view.id, view: swapView(session, firstId) });
    } catch (err) {
      await client.views.update({ view_id: ph.view.id, view: swapErrorView(err.message) }).catch(() => {});
    }
  });

  // Component picked in the swap modal — refresh the alternatives select.
  app.action({ block_id: 'comp_b', action_id: 'v' }, async ({ ack, body, client, action }) => {
    await ack();
    let sid = null;
    try { sid = JSON.parse(body.view.private_metadata || '{}').sid; } catch { /* ignore */ }
    const session = getSession(sid);
    if (!session) return;
    await client.views.update({ view_id: body.view.id, view: swapView(session, action.selected_option?.value) });
  });

  app.view('sky_swap', async ({ ack, view, client }) => {
    let sid = null;
    try { sid = JSON.parse(view.private_metadata || '{}').sid; } catch { /* ignore */ }
    const session = getSession(sid);
    const vals = view.state.values;
    const compId = vals.comp_b?.v?.selected_option?.value;
    const altIdx = vals.alt_b?.v?.selected_option?.value;
    if (!session || compId == null || altIdx == null) {
      return ack({ response_action: 'errors', errors: { alt_b: 'Pick a replacement first.' } });
    }
    const alt = (session.alternatives?.[compId] || [])[Number(altIdx)];
    if (!alt) return ack({ response_action: 'errors', errors: { alt_b: 'That alternative is gone — reopen the swap.' } });
    await ack();
    const { before, after } = applySwap(session, compId, alt);
    if (session.reviewMsg) {
      const { channel, ts } = session.reviewMsg;
      const { rich, classic, text } = reviewMessage(session);
      await updateRich(client, channel, ts, text, rich, classic);
      uploadDiagram(client, channel, ts, session).catch(() => {});
      await client.chat.postMessage({
        channel, thread_ts: ts,
        text: `🔄 Swapped *${clip(before, 80)}* → *${clip(after, 80)}*. Table, total, and diagram updated; regenerate code to match.`,
      });
    }
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
