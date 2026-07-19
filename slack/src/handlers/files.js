import * as api from '../api.js';
import { newSession } from '../state.js';
import { reviewMessage } from '../blocks/review.js';
import { updateRich } from '../blocks/common.js';
import { fmtElapsed, startProgress } from '../util.js';
import { publishHome } from './home.js';
import { uploadDiagram } from './diagram.js';
import { ensureOptimizations } from './review.js';

const MAX_BYTES = 10 * 1024 * 1024;
const OK_MIME = new Set(['image/png', 'image/jpeg', 'application/pdf']);
const seen = new Set(); // Slack can deliver the same upload via multiple events

/** The AI Image Analysis path: DM'd diagram → Qwen vision → the shared review flow. */
export async function handleImageUpload(client, event) {
  const file = event.files?.[0];
  if (!file || seen.has(file.id)) return;
  seen.add(file.id);
  if (seen.size > 500) seen.clear();

  const okType = OK_MIME.has(file.mimetype) || /\.(png|jpe?g|pdf)$/i.test(file.name || '');
  if (!okType) {
    return client.chat.postMessage({ channel: event.channel, text: '🙈 I can only analyze *PNG, JPG, or PDF* architecture diagrams — other file types are ignored.' });
  }
  if (file.size > MAX_BYTES) {
    return client.chat.postMessage({ channel: event.channel, text: '⚠️ That file is over the *10 MB* limit — try a smaller export of the diagram.' });
  }

  const label = s => `🔍 Analyzing your architecture diagram with Qwen vision… (${fmtElapsed(s)} elapsed)`;
  const loading = await client.chat.postMessage({ channel: event.channel, text: label(0) });
  const stop = startProgress(client, event.channel, loading.ts, label, { maxUpdates: 60 });

  try {
    const res = await fetch(file.url_private_download, {
      headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
    });
    if ((res.headers.get('content-type') || '').includes('text/html')) {
      throw new Error('Slack refused the file download — the app may be missing the `files:read` scope (reinstall it from the manifest).');
    }
    const buf = Buffer.from(await res.arrayBuffer());

    const resp = await api.analyzeImage(buf, file.name || 'diagram.png', file.mimetype || 'image/png');
    const arch = resp.data?.architecture;
    if (!arch) throw new Error('The backend could not reconstruct an architecture from that image.');

    const session = newSession(event.user, event.channel);
    session.provider = arch.provider || 'alicloud';
    session.title = arch.name || (file.name || 'diagram').replace(/\.[^.]+$/, '');
    session.description = arch.description || '';
    session.architecture = arch;
    session.reasoning = resp.data?.analysis_result || resp.reasoning || '';
    session.detectedComponents = resp.data?.detected_components || [];
    session.gitlabIssueIid = arch.gitlab_issue_iid ?? null;
    session.gitlabIssueUrl = arch.gitlab_issue_url ?? null;
    session.step = 'review';

    stop();
    session.optim = null;
    session.viewMode = 'cost';
    // Compute cost/performance options once so the tabs can project instantly.
    await ensureOptimizations(session).catch(() => { session.optim = {}; });
    const { rich, classic, text } = reviewMessage(session);
    await updateRich(client, event.channel, loading.ts, text, rich, classic);
    session.reviewMsg = { channel: event.channel, ts: loading.ts };
    uploadDiagram(client, event.channel, loading.ts, session).catch(() => {});
    publishHome(client, event.user).catch(() => {});
  } catch (err) {
    stop();
    await client.chat.update({ channel: event.channel, ts: loading.ts, text: `❌ Image analysis failed: ${err.message}` });
  }
}
