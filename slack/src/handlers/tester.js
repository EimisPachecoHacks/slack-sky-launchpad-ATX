import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSession } from '../state.js';
import { plain, mrkdwn, clip, fmtElapsed, startProgress } from '../util.js';
import { notifyUser, SESSION_EXPIRED, openDm } from './shared.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const PYTHON = join(REPO_ROOT, 'project', 'venv', 'bin', 'python');
const AGENT = join(REPO_ROOT, 'nvidia', 'tester', 'agent.py');

const STATUS_EMOJI = { pass: '✅', fail: '🐛', inconclusive: '❓' };

/** Spawn the Nemotron UI-test agent against a URL and post results + screenshots. */
export async function runTester(client, channel, { url, appName = 'webapp' }) {
  const label = s => `🧪 Nemotron test agent is using *${appName}* like a human — planning cases, clicking, screenshotting… (${fmtElapsed(s)} elapsed)`;
  const progress = await client.chat.postMessage({ channel, text: label(0) });
  const stop = startProgress(client, channel, progress.ts, label, { maxUpdates: 180 });

  let out;
  try {
    out = await new Promise((resolve, reject) => {
      execFile(PYTHON, [AGENT, '--url', url, '--app-name', appName], {
        cwd: REPO_ROOT, timeout: 15 * 60 * 1000, maxBuffer: 16 * 1024 * 1024,
      }, (err, stdout, stderr) => {
        if (err && !stdout) return reject(new Error(clip(stderr || err.message, 400)));
        resolve(stdout);
      });
    });
  } catch (err) {
    stop();
    await client.chat.update({ channel, ts: progress.ts, text: `❌ Test run failed: ${err.message}` });
    return;
  }
  stop();

  let report;
  try {
    report = JSON.parse(out.slice(out.indexOf('{')));
  } catch {
    await client.chat.update({ channel, ts: progress.ts, text: `❌ Could not parse the test report:\n\`\`\`${clip(out, 2500)}\`\`\`` });
    return;
  }

  const lines = report.cases.map(c =>
    `${STATUS_EMOJI[c.status] || '❓'} *${clip(c.title, 70)}*${c.reason ? `\n      _${clip(c.reason, 180)}_` : ''}${c.learned_skill ? `\n      🧠 learned skill: \`${c.learned_skill}\`` : ''}`);
  const bugs = report.cases.filter(c => c.status === 'fail').length;

  await client.chat.update({
    channel, ts: progress.ts,
    text: `Test run finished: ${report.passed} passed, ${report.failed} failed`,
    blocks: [
      { type: 'section', text: mrkdwn(`🧪 *UI test run — ${clip(appName, 40)}*\n<${url}>`) },
      { type: 'section', text: mrkdwn(lines.join('\n') || '_no cases ran_') },
      {
        type: 'context',
        elements: [mrkdwn(`✅ ${report.passed} passed · 🐛 ${report.failed} failed · ❓ ${report.inconclusive} inconclusive · ${bugs ? 'bugs became learned skills — the next run gets smarter' : 'no new bugs'}`)],
      },
    ],
  });

  // Upload the evidence: final screenshot of each case (thread under the results).
  for (const c of report.cases) {
    const shot = (c.screenshots || []).slice(-1)[0];
    if (shot && existsSync(shot)) {
      await client.files.uploadV2({
        channel_id: channel, thread_ts: progress.ts,
        file: shot, filename: `${clip(c.title, 40).replace(/[^a-z0-9]+/gi, '-')}.png`,
        initial_comment: `${STATUS_EMOJI[c.status] || '❓'} ${clip(c.title, 80)}`,
      }).catch(() => {});
    }
  }
}

export default function register(app) {
  // "🧪 Test this app" on the deploy-success card
  app.action('app_test', async ({ ack, body, client, action }) => {
    await ack();
    const session = getSession(action.value);
    if (!session?.deploy?.endpoint) return notifyUser(client, body, SESSION_EXPIRED);
    const channel = body.channel?.id || await openDm(client, body.user.id);
    await runTester(client, channel, { url: session.deploy.endpoint, appName: session.title || 'deployed-app' });
  });
}
