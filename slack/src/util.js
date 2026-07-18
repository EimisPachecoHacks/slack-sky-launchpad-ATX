export const plain = t => ({ type: 'plain_text', text: String(t), emoji: true });
export const mrkdwn = t => ({ type: 'mrkdwn', text: String(t) });
export const opt = (text, value, description) => ({
  text: plain(text),
  value: String(value),
  ...(description ? { description: plain(description) } : {}),
});

export const clip = (s, n) => {
  s = String(s ?? '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
};

/** Split long mrkdwn into chunks that fit Slack's 3000-char section limit. */
export function chunkText(s, size = 2900) {
  s = String(s ?? '');
  if (!s) return [];
  const chunks = [];
  while (s.length > size) {
    let cut = s.lastIndexOf('\n', size);
    if (cut < size * 0.5) cut = size;
    chunks.push(s.slice(0, cut));
    s = s.slice(cut);
  }
  chunks.push(s);
  return chunks;
}

export const money = n => {
  const v = Number(n);
  return Number.isFinite(v) ? `$${v >= 100 ? Math.round(v) : v.toFixed(2)}` : '—';
};

export const fmtElapsed = secs => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

export const PROVIDERS = {
  aws: {
    label: 'Amazon Web Services', short: 'AWS', emoji: '🟧',
    tagline: 'EC2, Lambda, RDS, S3 — the widest service catalog.',
    regions: ['us-east-1', 'us-east-2', 'us-west-1', 'us-west-2', 'eu-west-1', 'eu-central-1', 'ap-northeast-1', 'ap-southeast-1'],
    defaultRegion: 'us-east-1',
  },
  azure: {
    label: 'Microsoft Azure', short: 'Azure', emoji: '🔷',
    tagline: 'Deep Microsoft ecosystem and enterprise integration.',
    regions: ['westus', 'westus2', 'eastus', 'eastus2', 'westeurope', 'northeurope', 'southeastasia', 'eastasia'],
    defaultRegion: 'eastus',
  },
  gcp: {
    label: 'Google Cloud Platform', short: 'GCP', emoji: '🔴',
    tagline: 'Strong data, Kubernetes, and ML tooling.',
    regions: ['us-central1', 'us-west1', 'us-east1', 'us-east4', 'europe-west1', 'europe-west4', 'asia-east1', 'asia-southeast1'],
    defaultRegion: 'us-central1',
  },
  alicloud: {
    label: 'Alibaba Cloud', short: 'Alibaba', emoji: '🟠',
    tagline: 'ECS, OSS, RDS — first-class deploy target for Sky Launchpad.',
    regions: ['ap-southeast-1', 'ap-southeast-3', 'ap-northeast-1', 'cn-hangzhou', 'cn-shanghai'],
    defaultRegion: 'ap-southeast-1',
  },
};

export function providerMeta(p) {
  return PROVIDERS[p] || { label: p || 'Cloud', short: p || '?', emoji: '☁️', tagline: '', regions: [], defaultRegion: '' };
}

export function totalCost(architecture) {
  const meta = Number(architecture?.metadata?.totalCost);
  if (Number.isFinite(meta) && meta > 0) return meta;
  return (architecture?.components || []).reduce((s, c) => s + (Number(c.cost) || 0), 0);
}

/** Convert LLM markdown to Slack mrkdwn (headings → bold, ** → *, - → •). */
export function slackify(md) {
  return String(md ?? '')
    .replace(/^#{1,6}\s*(.+)$/gm, '*$1*')
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    .replace(/^[-*]\s+/gm, '• ');
}

/**
 * Edits a loading message on an interval to show elapsed time.
 * Returns a stop() function; always call it when the real result lands.
 */
export function startProgress(client, channel, ts, textFn, { intervalMs = 5000, maxUpdates = 60 } = {}) {
  const startedAt = Date.now();
  let n = 0;
  const timer = setInterval(async () => {
    n += 1;
    const secs = Math.round((Date.now() - startedAt) / 1000);
    if (n > maxUpdates) {
      clearInterval(timer);
      try { await client.chat.update({ channel, ts, text: `${textFn(secs)}\n_Still working server-side — the result will post when ready._` }); } catch { /* gone */ }
      return;
    }
    try { await client.chat.update({ channel, ts, text: textFn(secs) }); } catch { /* message may be gone */ }
  }, intervalMs);
  return () => clearInterval(timer);
}
