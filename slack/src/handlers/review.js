import * as api from '../api.js';
import { getSession } from '../state.js';
import { reasoningBlocks, reviewMessage } from '../blocks/review.js';
import { codeMessage, CODE_FILENAME, INLINE_CODE_LIMIT } from '../blocks/code.js';
import { updateRich } from '../blocks/common.js';
import { providerMeta, fmtElapsed, startProgress } from '../util.js';
import { postToSession, notifyUser, SESSION_EXPIRED } from './shared.js';
import { uploadDiagram } from './diagram.js';

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
    await client.chat.update({ channel, ts, text: `❌ Re-optimization failed: ${err.message} — the previous design is stale; run /sky new to start fresh.` });
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
