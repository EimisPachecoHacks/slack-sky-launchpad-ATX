import * as api from '../api.js';
import { getSession } from '../state.js';
import { reasoningBlocks, reviewMessage } from '../blocks/review.js';
import { codeMessage, CODE_FILENAME, INLINE_CODE_LIMIT } from '../blocks/code.js';
import { updateRich } from '../blocks/common.js';
import { clip, money, fmtElapsed, startProgress, providerMeta } from '../util.js';
import { postToSession, notifyUser, SESSION_EXPIRED } from './shared.js';
import { uploadDiagram } from './diagram.js';

/** Snapshot each component's original values so a swap can be reverted. */
function snapshotOriginals(arch) {
  arch.__originals = {};
  for (const c of arch.components || []) {
    arch.__originals[String(c.id)] = { name: c.name, cost: c.cost, description: c.description };
  }
}

/** Register the freshly-generated architecture as the first optimization variant. */
export function initVariants(session) {
  const goal = session.optimization || 'balanced';
  snapshotOriginals(session.architecture);
  session.architecture.__alternatives = session.alternatives;
  session.variants = { [goal]: session.architecture };
  session.activeVariant = goal;
}

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

/** Populate session.alternatives once (idempotent) so the review rows can each
 * offer a Switch dropdown. Safe to await before rendering the review. */
export async function ensureAlternatives(session) {
  if (session.alternatives && Object.keys(session.alternatives).length) return session.alternatives;
  session.alternatives = await buildAlternatives(session);
  return session.alternatives;
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

export default function register(app) {
  // Optimization "tabs": switch to a cached variant instantly, or generate it once.
  app.action(/^rev_tab_/, async ({ ack, body, client, action }) => {
    await ack();
    const session = getSession(action.value);
    if (!session?.architecture || !session.reviewMsg) return notifyUser(client, body, SESSION_EXPIRED);
    const goal = action.action_id.replace('rev_tab_', '');
    if (!['balanced', 'cost', 'performance'].includes(goal) || goal === session.activeVariant) return;
    const { channel, ts } = session.reviewMsg;

    const cached = session.variants?.[goal];
    if (cached) {
      session.architecture = cached;
      session.activeVariant = goal;
      session.optimization = goal;
      session.alternatives = cached.__alternatives || {};
      session.code = {}; session.codeMsg = null;
      const { rich, classic, text } = reviewMessage(session);
      await updateRich(client, channel, ts, text, rich, classic);
      uploadDiagram(client, channel, ts, session).catch(() => {});
      return;
    }

    const p = providerMeta(session.provider);
    const label = s => `🧠 Optimizing *${session.title}* for *${goal}* on ${p.emoji} ${p.label} with Nemotron… (${fmtElapsed(s)} elapsed)`;
    await client.chat.update({ channel, ts, text: label(0), blocks: [{ type: 'section', text: { type: 'mrkdwn', text: label(0) } }] });
    const stop = startProgress(client, channel, ts, label, { maxUpdates: 60 });
    try {
      const resp = await api.generateArchitecture({
        title: session.title, description: session.description,
        requirements: session.requirements, provider: session.provider, optimization_goal: goal,
      });
      session.architecture = resp.data || {};
      session.reasoning = resp.reasoning || '';
      session.summaryMessage = resp.message || '';
      session.optimization = goal;
      session.alternatives = null;
      await ensureAlternatives(session).catch(() => { session.alternatives = {}; });
      snapshotOriginals(session.architecture);
      session.architecture.__alternatives = session.alternatives;
      session.variants[goal] = session.architecture;
      session.activeVariant = goal;
      session.code = {}; session.codeMsg = null;
      stop();
      const { rich, classic, text } = reviewMessage(session);
      await updateRich(client, channel, ts, text, rich, classic);
      uploadDiagram(client, channel, ts, session).catch(() => {});
    } catch (err) {
      stop();
      // Restore the previous variant view.
      const prev = session.variants[session.activeVariant];
      if (prev) { session.architecture = prev; session.alternatives = prev.__alternatives || {}; }
      const { rich, classic, text } = reviewMessage(session);
      await updateRich(client, channel, ts, text, rich, classic);
      await client.chat.postMessage({ channel, thread_ts: ts, text: `❌ Couldn't build the *${goal}* variant (${clip(err.message, 200)}). Kept the current view.` });
    }
  });

  // Per-component switch: the static_select accessory on a component row.
  // value = "<sid>~~<componentId>~~<altIndex|restore>".
  app.action('swap_pick', async ({ ack, body, client, action }) => {
    await ack();
    const [sid, compId, sel] = String(action.selected_option?.value || '').split('~~');
    const session = getSession(sid);
    if (!session?.architecture || !session.reviewMsg) return notifyUser(client, body, SESSION_EXPIRED);
    let before, after;
    if (sel === 'restore') {
      const orig = session.architecture.__originals?.[compId];
      if (!orig) return notifyUser(client, body, 'No default recorded for that component.');
      ({ before, after } = applySwap(session, compId, { name: orig.name, cost: orig.cost, reason: orig.description }));
    } else {
      const alt = (session.alternatives?.[compId] || [])[Number(sel)];
      if (!alt) return notifyUser(client, body, 'That alternative is no longer available — regenerate to refresh.');
      ({ before, after } = applySwap(session, compId, alt));
    }
    session.code = {}; session.codeMsg = null;
    const { channel, ts } = session.reviewMsg;
    const { rich, classic, text } = reviewMessage(session);
    await updateRich(client, channel, ts, text, rich, classic);
    uploadDiagram(client, channel, ts, session).catch(() => {});
    await client.chat.postMessage({
      channel, thread_ts: ts,
      text: `${sel === 'restore' ? '↩️ Restored' : '🔄 Swapped'} *${clip(before, 80)}* → *${clip(after, 80)}*. Cost total and diagram updated.`,
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
