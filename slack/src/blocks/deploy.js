import { card, cardClassic } from './common.js';
import { plain, mrkdwn, opt, providerMeta, money, totalCost, clip } from '../util.js';

const meta = sid => JSON.stringify({ sid });

/** Opened immediately on click — trigger_ids expire in ~3s, so load data after. */
export function placeholderView(sid) {
  return {
    type: 'modal',
    callback_id: 'sky_deploy',
    private_metadata: meta(sid),
    title: plain('Deploy'),
    close: plain('Cancel'),
    blocks: [{ type: 'section', text: mrkdwn('⏳ Loading your cloud accounts…') }],
  };
}

/** The deploy form — account, region, optional repo, and a required confirmation. */
export function deployFormView(session, accounts) {
  const p = providerMeta(session.provider);
  const arch = session.architecture || {};
  const nComps = (arch.components || []).length;

  const accountOptions = accounts.slice(0, 100).map(a =>
    opt(clip(`${a.accountName || a.accountId || a.id}`, 70), a.accountId || a.id, a.isDefault ? 'default account' : undefined));
  const defaultAccount = accounts.find(a => a.isDefault);
  const initialAccount = defaultAccount
    ? accountOptions[accounts.indexOf(defaultAccount)]
    : accountOptions[0];

  const regionOptions = p.regions.map(r => opt(r, r));
  const initialRegion = regionOptions.find(o => o.value === p.defaultRegion) || regionOptions[0];

  return {
    type: 'modal',
    callback_id: 'sky_deploy',
    private_metadata: meta(session.sid),
    title: plain('Deploy'),
    submit: plain('🚀 Deploy'),
    close: plain('Cancel'),
    blocks: [
      {
        type: 'section',
        text: mrkdwn(`Deploying *${clip(session.title || 'architecture', 60)}* → ${p.emoji} *${p.label}*\n${nComps} components · est. *${money(totalCost(arch))}/mo*`),
      },
      { type: 'divider' },
      {
        type: 'input',
        block_id: 'account_b',
        label: plain('Cloud account'),
        element: {
          type: 'static_select', action_id: 'v',
          placeholder: plain('Choose an account'),
          options: accountOptions,
          ...(initialAccount ? { initial_option: initialAccount } : {}),
        },
      },
      {
        type: 'input',
        block_id: 'region_b',
        label: plain('Region'),
        element: {
          type: 'static_select', action_id: 'v',
          placeholder: plain('Choose a region'),
          options: regionOptions,
          ...(initialRegion ? { initial_option: initialRegion } : {}),
        },
      },
      {
        type: 'input',
        block_id: 'repo_b',
        optional: true,
        label: plain('GitHub repository (optional)'),
        element: { type: 'plain_text_input', action_id: 'v', max_length: 100, placeholder: plain('username/repository') },
      },
      {
        type: 'input',
        block_id: 'confirm_b',
        label: plain('Confirmation'),
        element: {
          type: 'checkboxes', action_id: 'v',
          options: [{
            text: mrkdwn('⚠️ I understand this runs *real Terraform* and may create *billable cloud resources*.'),
            value: 'confirmed',
          }],
        },
      },
    ],
  };
}

/** No accounts for this provider — explain instead of a dead form (no submit). */
export function noAccountsView(session) {
  const p = providerMeta(session.provider);
  return {
    type: 'modal',
    title: plain('Deploy'),
    close: plain('Close'),
    blocks: [
      { type: 'section', text: mrkdwn(`😕 No *${p.emoji} ${p.label}* accounts are configured on the server.\n\nAdd credentials in the Sky Launchpad web app under *Settings → Cloud Providers*, then come back and hit Deploy again.`) },
    ],
  };
}

export function deployErrorView(message) {
  return {
    type: 'modal',
    title: plain('Deploy'),
    close: plain('Close'),
    blocks: [{ type: 'section', text: mrkdwn(`❌ Couldn't load cloud accounts:\n${clip(message, 2800)}`) }],
  };
}

/** Success result — replaces the progress message. Returns {rich, classic, text}. */
export function successMessage(session, data) {
  const p = providerMeta(session.provider);
  const arch = session.architecture || {};
  const nComps = (arch.components || []).length;
  const cost = money(totalCost(arch));

  const buttons = [];
  if (data.gitlab_mr_url) buttons.push({ text: '📤 Open Merge Request', action_id: 'dep_open_mr', url: data.gitlab_mr_url });
  if (data.endpoint) buttons.push({ text: '🌐 Open Endpoint', action_id: 'dep_open_endpoint', url: data.endpoint });
  if (data.endpoint) buttons.push({ text: '🧪 Test this app', action_id: 'app_test', value: session.sid, style: 'primary' });

  const heal = parseDeployLog(data.deployment_logs);
  const cardOpts = {
    emoji: '✅',
    title: 'DEPLOYMENT SUCCESSFUL',
    subtitle: `${p.emoji} ${p.label} · ${session.deploy.region}${heal.attempts > 1 ? ` · self-healed after ${heal.attempts} attempts` : ''}`,
    body: `${nComps} components · est. ${cost}/mo — live infrastructure created.`,
    buttons,
  };

  const fields = {
    type: 'section',
    fields: [
      mrkdwn(`*🌐 Endpoint*\n${data.endpoint ? `<${data.endpoint}>` : '—'}`),
      mrkdwn(`*📤 Code pushed*\n${data.gitlab_mr_url ? `<${data.gitlab_mr_url}|Merge request opened>` : 'no git host configured'}`),
      mrkdwn(`*☁️ Provider / Region*\n${p.label} · ${session.deploy.region}`),
      mrkdwn(`*💰 Est. monthly cost*\n${cost} · ${nComps} components`),
    ],
  };

  const blocksTail = [fields];
  if (heal.attempts > 1 || heal.learnedSkills.length) {
    blocksTail.push({
      type: 'context',
      elements: [mrkdwn(`🧠 Self-healing loop: ${heal.attempts > 1 ? `succeeded on attempt ${heal.attempts}` : 'succeeded first try'}${heal.researched ? ' · 🔎 researched the failure on the web' : ''}${heal.learnedSkills.length ? ` · learned skill${heal.learnedSkills.length > 1 ? 's' : ''}: ${clip(heal.learnedSkills.join(', '), 200)}` : ''}`)],
    });
  }
  const outputs = Object.entries(data.outputs || {}).slice(0, 6);
  if (outputs.length) {
    blocksTail.push({
      type: 'context',
      elements: [mrkdwn(clip(outputs.map(([k, v]) => `\`${k}\`: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · '), 2900))],
    });
  }
  const tail = logsTail(data.deployment_logs);
  if (tail) blocksTail.push(tail);

  return {
    rich: [card(cardOpts), ...blocksTail],
    classic: [...cardClassic(cardOpts), ...blocksTail],
    text: `✅ DEPLOYMENT SUCCESSFUL on ${p.label} (${session.deploy.region})${data.endpoint ? ` — ${data.endpoint}` : ''}`,
  };
}

/** Classify a deploy error: is it something the self-healing loop can fix
 * (code/config) or an external account/permission blocker it cannot? */
export function classifyDeployError(msg) {
  const m = String(msg || '').toLowerCase();
  const rules = [
    [/userdisable|not.?activated|service is not enabled|not.?enabled|has not (been )?activated/, 'oss_disabled',
      'A required cloud *service is not activated* on your account. Activate it in the provider console (for Alibaba OSS: activate OSS, complete real-name verification, and add a payment method), then deploy again. *No code change or retry can fix this* — it needs an account action.'],
    [/accessdenied|forbidden|not authorized|no permission|unauthorized|403.*(oss|ram)/, 'permissions',
      'The cloud credential is *missing a permission*. Attach the needed policy to your RAM/IAM user (e.g. `AliyunOSSFullAccess`), then deploy again. Retrying without the permission will keep failing.'],
    [/quota|limitexceeded|exceeded.*limit|insufficient.*balance|arrears|overdue|payment/, 'quota_billing',
      'A *quota or billing* limit was hit on your account. Raise the quota or fix billing in the provider console, then deploy again.'],
    [/invalidaccesskey|signaturedoesnotmatch|invalid.*key|expired.*token/, 'bad_credentials',
      'The stored cloud *credentials are invalid or expired*. Re-upload a valid access key in the web app Settings, then deploy again.'],
  ];
  for (const [re, code, advice] of rules) if (re.test(m)) return { recoverable: false, code, advice };
  return { recoverable: true, code: 'code_error', advice: null };
}

/** Failure result — replaces the progress message. Returns {rich, classic, text}. */
export function failureMessage(session, errMessage, logs) {
  const p = providerMeta(session.provider);
  const heal = parseDeployLog(logs);
  const cls = classifyDeployError(errMessage);

  let healLine, buttons, subtitle;
  if (!cls.recoverable) {
    // External account/permission blocker — the loop genuinely cannot self-heal it.
    healLine = `⚠️ *This is not a code error — the self-healing loop can't fix it.* ${cls.advice}`;
    buttons = [{ text: '🔁 Retry (after you fix it)', action_id: 'dep_retry', value: session.sid }];
    subtitle = `${p.emoji} ${p.label} · ${session.deploy.region || ''} · needs an account action`;
  } else {
    healLine = heal.learnedSkills.length
      ? `🧠 The self-healing loop tried *${heal.attempts || 'several'} attempts* and *learned a new skill* (\`${clip(heal.learnedSkills[0], 60)}\`). Hit *Try Again* — the next deploy applies it to pre-empt this error.`
      : `🧠 The self-healing loop tried *${heal.attempts || 'several'} attempts* and captured the failure. Hit *Try Again* to retry with what it learned.`;
    buttons = [{ text: '🔁 Try Again (with new skill)', action_id: 'dep_retry', value: session.sid, style: 'primary' }];
    subtitle = `${p.emoji} ${p.label} · ${session.deploy.region || ''}${heal.attempts > 1 ? ` · after ${heal.attempts} attempts` : ''}`;
  }

  const cardOpts = {
    emoji: '❌',
    title: 'DEPLOYMENT FAILED',
    subtitle,
    body: clip(errMessage || 'Unknown error', 200),
    buttons,
  };
  const extra = [{ type: 'section', text: mrkdwn(healLine) }];
  const err = clip(errMessage || '', 2800);
  if (err.length > 200) extra.push({ type: 'section', text: mrkdwn('```\n' + err + '\n```') });
  const tail = logsTail(logs);
  if (tail) extra.push(tail);
  return {
    rich: [card(cardOpts), ...extra],
    classic: [...cardClassic(cardOpts), ...extra],
    text: `❌ DEPLOYMENT FAILED: ${clip(errMessage || 'unknown error', 200)}`,
  };
}

/** Extract the self-healing narrative from the deployer's logs. */
export function parseDeployLog(logs) {
  const arr = (logs || []).map(String);
  let attempts = 0;
  let researched = false;
  const learned = new Set();
  for (const l of arr) {
    const a = l.match(/Attempt (\d+)\s*\/\s*\d+/i);
    if (a) attempts = Math.max(attempts, Number(a[1]));
    if (/\[RESEARCH\]|investigating the error on the web/i.test(l)) researched = true;
    const s = l.match(/(?:learned|updated) (?:a new )?skill[:\s]+["'`]?([\w .()-]{3,60})/i)
      || l.match(/(?:authored|created) skill[:\s]+["'`]?([\w .()-]{3,60})/i);
    if (s) learned.add(s[1].trim().replace(/["'`]$/, ''));
  }
  return { attempts, researched, learnedSkills: [...learned] };
}

/** Last ~20 log lines as a fenced context section; full log goes to a snippet. */
function logsTail(logs, n = 20) {
  if (!logs?.length) return null;
  const tail = logs.slice(-n).map(String).join('\n');
  return { type: 'section', text: mrkdwn(clip('*Last log lines*\n```\n' + tail + '\n```', 2950)) };
}
