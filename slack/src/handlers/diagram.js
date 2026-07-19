import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const PYTHON = join(REPO_ROOT, 'project', 'venv', 'bin', 'python');
const RENDERER = join(REPO_ROOT, 'slack', 'render_diagram.py');
const TABLE_RENDERER = join(REPO_ROOT, 'slack', 'render_table.py');

function renderPng(script, archPath, outPath) {
  return new Promise((resolve, reject) => {
    execFile(PYTHON, [script, archPath, outPath], { timeout: 90000 }, (err, _out, stderr) => {
      if (err) return reject(new Error((stderr || err.message).slice(0, 200)));
      resolve();
    });
  });
}

/** Render the web-style component table (KPI cards + comparison) as a PNG and
 * upload it to the review thread. Best-effort. */
export async function uploadTable(client, channel, thread_ts, session) {
  const arch = session.architecture;
  if (!arch?.components?.length) return;
  const dir = mkdtempSync(join(tmpdir(), 'skytable-'));
  const archPath = join(dir, 'arch.json');
  const outPath = join(dir, 'table.png');
  writeFileSync(archPath, JSON.stringify(arch));
  await renderPng(TABLE_RENDERER, archPath, outPath);
  if (!existsSync(outPath)) return;
  await client.files.uploadV2({
    channel_id: channel,
    thread_ts,
    file: outPath,
    filename: 'components-table.png',
    initial_comment: '📊 Components — full breakdown (cost, savings, alternatives)',
  });
}

/**
 * Render the architecture's node/edge diagram to a PNG (same data the web
 * canvas draws) and upload it into the review message's thread — Slack's
 * version of the website's diagram view. Fire-and-forget: any failure is
 * swallowed so the review card never breaks because of the picture.
 */
export async function uploadDiagram(client, channel, thread_ts, session) {
  const arch = session.architecture;
  if (!arch?.diagram?.nodes?.length) return;
  const dir = mkdtempSync(join(tmpdir(), 'skydiag-'));
  const archPath = join(dir, 'arch.json');
  const outPath = join(dir, 'diagram.png');
  writeFileSync(archPath, JSON.stringify(arch));

  await renderPng(RENDERER, archPath, outPath);
  if (!existsSync(outPath)) return;

  await client.files.uploadV2({
    channel_id: channel,
    thread_ts,
    file: outPath,
    filename: 'architecture-diagram.png',
    initial_comment: '🗺️ Architecture diagram',
  });

  // Companion provider-styled illustration via Nano Banana (best-effort).
  const { uploadGenaiDiagram } = await import('./genai_diagram.js');
  uploadGenaiDiagram(client, channel, thread_ts, session).catch(() => {});
}
