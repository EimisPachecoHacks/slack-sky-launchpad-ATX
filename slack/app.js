import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import bolt from '@slack/bolt';
import { register } from './src/handlers/index.js';

const { App, LogLevel } = bolt;

// Load slack/.env without a dotenv dependency (same pattern as the reference app).
try {
  const envPath = join(dirname(fileURLToPath(import.meta.url)), '.env');
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* .env is optional when real env vars are set */ }

const missing = ['SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN'].filter(k => !process.env[k]);
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(', ')} — copy .env.example to .env and fill it in.`);
  process.exit(1);
}
if (!process.env.SKY_API_KEY) {
  console.warn('⚠️  SKY_API_KEY not set — fine if the backend runs in development mode with empty API_KEYS; required otherwise for deploy/credentials.');
}

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
  logLevel: LogLevel.INFO,
});

register(app);

await app.start(Number(process.env.PORT || 3002));
console.log(`⚡ Sky Launchpad Slack app running (Socket Mode) — backend: ${process.env.SKY_API_URL || 'http://localhost:8000'}`);
