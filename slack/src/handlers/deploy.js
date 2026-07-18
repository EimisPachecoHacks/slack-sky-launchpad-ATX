import * as api from '../api.js';
import { getSession } from '../state.js';
import { placeholderView, deployFormView, noAccountsView, deployErrorView, successMessage, failureMessage } from '../blocks/deploy.js';
import { updateRich } from '../blocks/common.js';
import { providerMeta, fmtElapsed, startProgress } from '../util.js';
import { postToSession, notifyUser, SESSION_EXPIRED } from './shared.js';
import { publishHome } from './home.js';

/** Open a placeholder modal immediately (trigger_id dies in ~3s), then load accounts. */
async function openDeployFlow({ ack, body, client, action }) {
  await ack();
  const session = getSession(action.value);
  if (!session?.architecture) return notifyUser(client, body, SESSION_EXPIRED);
  const ph = await client.views.open({ trigger_id: body.trigger_id, view: placeholderView(session.sid) });
  let view;
  try {
    const accounts = (await api.listCredentials()).filter(a => a.provider === session.provider);
    view = accounts.length ? deployFormView(session, accounts) : noAccountsView(session);
  } catch (err) {
    view = deployErrorView(err.message);
  }
  await client.views.update({ view_id: ph.view.id, view });
}

/** The blocking deploy call with a live elapsed-time progress message. */
async function runDeploy(client, session, { accountId, region, githubRepo }) {
  session.step = 'deploying';
  session.deploy = { accountId, region };
  const p = providerMeta(session.provider);
  const label = s => `🚀 Deploying *${session.title}* to ${p.emoji} ${p.label} · ${region} — Terraform is running (${fmtElapsed(s)} elapsed).\n_This usually takes a few minutes; the self-healing loop may retry failed steps._`;
  const progress = await postToSession(client, session, { text: label(0) });
  const stop = startProgress(client, progress.channel, progress.ts, label, { maxUpdates: 156 });

  let resp;
  try {
    resp = await api.deploy({
      architecture: session.architecture,
      config: {
        provider: session.provider,
        region,
        accountId,
        ...(githubRepo ? { githubRepo } : {}),
      },
      gitlab_issue_iid: session.gitlabIssueIid,
    });
  } catch (err) {
    stop();
    session.step = 'failed';
    const { rich, classic, text } = failureMessage(session, err.message, null);
    await updateRich(client, progress.channel, progress.ts, text, rich, classic);
    return;
  }
  stop();

  const data = resp.data || {};
  const failed = typeof data.status === 'string' && /fail|error/i.test(data.status);
  const msg = failed
    ? failureMessage(session, data.status ? `Deployment finished with status "${data.status}".` : 'Deployment failed.', data.deployment_logs)
    : successMessage(session, data);
  session.step = failed ? 'failed' : 'done';
  session.deploy.endpoint = data.endpoint || null;
  session.deploy.mrUrl = data.gitlab_mr_url || null;
  await updateRich(client, progress.channel, progress.ts, msg.text, msg.rich, msg.classic);

  if (data.deployment_logs?.length) {
    await client.files.uploadV2({
      channel_id: progress.channel,
      thread_ts: progress.ts,
      file: Buffer.from(data.deployment_logs.map(String).join('\n'), 'utf8'),
      filename: 'deploy.log',
      title: `Deployment logs — ${session.title || 'architecture'}`,
    }).catch(() => {});
  }
  publishHome(client, session.userId).catch(() => {});
}

export default function register(app) {
  app.action('code_deploy', openDeployFlow);
  app.action('dep_retry', openDeployFlow);

  // URL buttons still emit actions — ack them so Slack doesn't show a warning.
  app.action('dep_open_mr', async ({ ack }) => ack());
  app.action('dep_open_endpoint', async ({ ack }) => ack());

  app.view('sky_deploy', async ({ ack, view, client }) => {
    let sid = null;
    try { sid = JSON.parse(view.private_metadata || '{}').sid; } catch { /* ignore */ }
    const session = getSession(sid);
    const vals = view.state.values;

    const confirmed = (vals.confirm_b?.v?.selected_options || []).length > 0;
    const accountId = vals.account_b?.v?.selected_option?.value;
    const errors = {};
    if (!accountId) errors.account_b = 'Choose a cloud account.';
    if (!confirmed) errors.confirm_b = 'You must confirm before deploying.';
    if (Object.keys(errors).length) return ack({ response_action: 'errors', errors });
    await ack();

    if (!session?.architecture) return;
    const region = vals.region_b?.v?.selected_option?.value || providerMeta(session.provider).defaultRegion;
    const githubRepo = vals.repo_b?.v?.value?.trim() || undefined;
    await runDeploy(client, session, { accountId, region, githubRepo });
  });
}
