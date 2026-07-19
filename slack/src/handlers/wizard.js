import * as api from '../api.js';
import { getSession } from '../state.js';
import { methodView, providerView, useCaseView, imageInstructionsView, expiredView } from '../blocks/wizard.js';
import { reviewMessage } from '../blocks/review.js';
import { updateRich } from '../blocks/common.js';
import { plain, providerMeta, fmtElapsed, startProgress } from '../util.js';
import { postToSession, notifyUser, SESSION_EXPIRED } from './shared.js';
import { publishHome } from './home.js';
import { uploadDiagram } from './diagram.js';
import { ensureOptimizations } from './review.js';

const sidOf = view => {
  try { return JSON.parse(view.private_metadata || '{}').sid; } catch { return null; }
};

/** Calls the backend and turns the loading message into the review card. Reused by retry. */
export async function runGenerate(client, session) {
  session.step = 'generating';
  const p = providerMeta(session.provider);
  const label = s => `🧠 Designing *${session.title}* on ${p.emoji} ${p.label} with Nemotron… (${fmtElapsed(s)} elapsed)`;
  const loading = await postToSession(client, session, { text: label(0) });
  const stop = startProgress(client, loading.channel, loading.ts, label, { maxUpdates: 60 });
  try {
    const resp = await api.generateArchitecture({
      title: session.title,
      description: session.description,
      requirements: session.requirements,
      provider: session.provider,
      optimization_goal: session.optimization || 'balanced',
    });
    session.architecture = resp.data || {};
    session.reasoning = resp.reasoning || '';
    session.recommendations = resp.recommendations || [];
    session.summaryMessage = resp.message || '';
    session.gitlabIssueIid = resp.data?.gitlab_issue_iid ?? null;
    session.gitlabIssueUrl = resp.data?.gitlab_issue_url ?? null;
    session.optim = null;
    session.viewMode = 'cost';
    // Compute cost/performance options once so the tabs can project instantly.
    await ensureOptimizations(session).catch(() => { session.optim = {}; });
    stop();
    session.step = 'review';
    const { rich, classic, text } = reviewMessage(session);
    await updateRich(client, loading.channel, loading.ts, text, rich, classic);
    session.reviewMsg = { channel: loading.channel, ts: loading.ts };
    uploadDiagram(client, loading.channel, loading.ts, session).catch(() => {});
    publishHome(client, session.userId).catch(() => {});
  } catch (err) {
    stop();
    session.step = 'failed';
    await client.chat.update({
      channel: loading.channel,
      ts: loading.ts,
      text: `❌ Architecture generation failed: ${err.message}`,
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: `❌ *Architecture generation failed*\n${err.message}` } },
        { type: 'actions', elements: [{ type: 'button', style: 'primary', text: plain('🔁 Try Again'), action_id: 'wiz_retry', value: session.sid }] },
      ],
    });
  }
}

export default function register(app) {
  app.action('wiz_method', async ({ ack, body, client, action }) => {
    await ack();
    const sid = sidOf(body.view);
    if (!getSession(sid)) return client.views.update({ view_id: body.view.id, view: expiredView() });
    const view = action.value === 'image' ? imageInstructionsView(sid) : providerView(sid);
    await client.views.update({ view_id: body.view.id, view });
  });

  app.action('wiz_provider', async ({ ack, body, client, action }) => {
    await ack();
    const session = getSession(sidOf(body.view));
    if (!session) return client.views.update({ view_id: body.view.id, view: expiredView() });
    session.provider = action.value;
    session.step = 'usecase';
    await client.views.update({ view_id: body.view.id, view: useCaseView(session) });
  });

  app.action('wiz_back', async ({ ack, body, client, action }) => {
    await ack();
    const sid = sidOf(body.view);
    const session = getSession(sid);
    if (!session) return client.views.update({ view_id: body.view.id, view: expiredView() });
    const view = action.value === 'provider' ? providerView(sid) : methodView(sid);
    await client.views.update({ view_id: body.view.id, view });
  });

  // "Try Again" on a failed generation — reopen the form with previous input kept.
  app.action('wiz_retry', async ({ ack, body, client, action }) => {
    await ack();
    const session = getSession(action.value);
    if (!session) return notifyUser(client, body, SESSION_EXPIRED);
    await client.views.open({ trigger_id: body.trigger_id, view: useCaseView(session) });
  });

  app.view('sky_wizard', async ({ ack, view, client }) => {
    const session = getSession(sidOf(view));
    const vals = view.state.values;
    const title = vals.title_b?.v?.value?.trim() || '';
    const description = vals.desc_b?.v?.value?.trim() || '';

    const errors = {};
    if (!title) errors.title_b = 'Please enter a project title.';
    if (!description) errors.desc_b = 'Please describe your project.';
    if (Object.keys(errors).length) return ack({ response_action: 'errors', errors });
    await ack();

    if (!session) return;
    session.title = title;
    session.description = description;
    session.requirements = (vals.reqs_b?.v?.value || '').split('\n').map(s => s.trim()).filter(Boolean);
    session.optimization = vals.opt_b?.v?.selected_option?.value || 'balanced';
    await runGenerate(client, session);
  });
}
