import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Nano Banana (Gemini image) illustrated diagram — provider-styled companion to
// the accurate SVG render. Best-effort: needs GENAI_API_KEY with credit; any
// failure (429 depleted credits, quota, safety) is silently skipped.
// Model fallback: Pro (best text fidelity) → 3.1 flash → 2.5 flash.
const MODELS = ['gemini-3-pro-image', 'gemini-3.1-flash-image', 'gemini-2.5-flash-image'];

const PROVIDER_STYLE = {
  aws: 'AWS style, dark navy background with AWS orange (#FF9900) accents, AWS official icon look',
  azure: 'Microsoft Azure style, deep blue background with Azure blue (#0078D4) accents, Azure official icon look',
  gcp: 'Google Cloud style, clean white/light background with Google red/blue/yellow/green accents, GCP official icon look',
  alicloud: 'Alibaba Cloud style, dark slate background with Alibaba orange (#FF6A00) accents, Alibaba Cloud official icon look',
};

function buildPrompt(session) {
  const arch = session.architecture;
  const style = PROVIDER_STYLE[session.provider] || 'modern flat cloud-provider style';
  const comps = (arch.components || []).map(c => `- ${c.name} ($${Number(c.cost) || 0}/mo)`).join('\n');
  const names = {};
  for (const n of arch.diagram?.nodes || []) names[n.id] = n.label;
  const conns = (arch.diagram?.edges || [])
    .map(e => `'${names[e.from] || e.from}' connects to '${names[e.to] || e.to}'${e.label ? ` (${e.label})` : ''}`)
    .join('; ');
  return `Create a clean, professional cloud architecture diagram illustration.
Style: ${style}, modern flat design, crisp readable sans-serif labels.
EXACT components (one labeled box/icon each, spelled exactly):
${comps}
EXACT connections with arrows: ${conns}
Title at top: "${(session.title || 'Architecture').slice(0, 60)}".
No extra components. No invented text. Labels spelled exactly as given.`;
}

/** Generate the illustrated diagram and upload it. Returns true if an image was
 * posted, false if Gemini was unavailable (so the caller can fall back). */
export async function uploadGenaiDiagram(client, channel, thread_ts, session) {
  const key = process.env.GENAI_API_KEY;
  if (!key || !session.architecture?.components?.length) return false;

  const prompt = buildPrompt(session);
  let b64 = null;
  let mime = 'image/png';
  for (const model of MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
          signal: AbortSignal.timeout(150000),
        },
      );
      if (!res.ok) continue; // 429 = no credit / quota; try next model
      const parts = (await res.json())?.candidates?.[0]?.content?.parts || [];
      const img = parts.find(p => p.inlineData?.data);
      if (img) { b64 = img.inlineData.data; mime = img.inlineData.mimeType || 'image/png'; break; }
    } catch { /* try next model */ }
  }
  const buf = b64 ? Buffer.from(b64, 'base64') : null;
  // Guard: a valid diagram is tens of KB. Anything tiny means the model didn't
  // actually draw one — treat as failure so the SVG fallback runs.
  if (!buf || buf.length < 4096) return false;

  // Save with the extension that MATCHES the real content (Gemini often returns
  // JPEG). A JPEG named .png makes Slack reject/mis-render it.
  const ext = /jpeg|jpg/i.test(mime) ? 'jpg' : 'png';
  const dir = mkdtempSync(join(tmpdir(), 'skygenai-'));
  const file = join(dir, `architecture-diagram.${ext}`);
  writeFileSync(file, buf);
  await client.files.uploadV2({
    channel_id: channel,
    thread_ts,
    file,
    filename: `architecture-diagram.${ext}`,
    initial_comment: '🗺️ Architecture diagram',
  });
  return true;
}
