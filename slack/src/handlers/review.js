import * as api from '../api.js';
import { getSession } from '../state.js';
import { reasoningBlocks } from '../blocks/review.js';
import { codeMessage, CODE_FILENAME, INLINE_CODE_LIMIT } from '../blocks/code.js';
import { postToSession, notifyUser, SESSION_EXPIRED } from './shared.js';

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
