/**
 * HTTP client for the Sky Launchpad FastAPI backend (project/backend).
 * All AI endpoints answer with the AgentResponse envelope
 * {success, message, data, reasoning, recommendations} — unwrap() throws on success:false.
 */

const BASE = () => (process.env.SKY_API_URL || 'http://localhost:8000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.status = status;
  }
}

async function req(path, { method = 'GET', body, form, timeoutMs = 30000, auth = false, _retried = false } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  // When the backend has API_KEYS configured (the Alibaba Cloud deployment),
  // EVERY endpoint requires the key — FastAPI resolves the api-key sub-dependency
  // before optional_authentication can catch its error — so send it on every
  // request when configured. Dev backends with empty API_KEYS just ignore it.
  if (process.env.SKY_API_KEY) headers['X-API-Key'] = process.env.SKY_API_KEY;
  let res;
  try {
    res = await fetch(BASE() + path, {
      method,
      headers,
      body: form ?? (body ? JSON.stringify(body) : undefined),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new ApiError(`The backend timed out after ${Math.round(timeoutMs / 1000)}s (${path}).`);
    }
    throw new ApiError(`Cannot reach the Sky Launchpad backend at ${BASE()} — is it running?`);
  }
  if (res.status === 429 && !_retried) {
    const wait = Math.min(Number(res.headers.get('retry-after')) || 7, 30);
    await new Promise(r => setTimeout(r, wait * 1000));
    return req(path, { method, body, form, timeoutMs, auth, _retried: true });
  }
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON error body */ }
  if (!res.ok) {
    if (res.status === 429) throw new ApiError('The backend is rate-limiting requests (10/min) — wait a moment and try again.', 429);
    const detail = typeof json?.detail === 'string' ? json.detail : json?.message || text.slice(0, 300);
    throw new ApiError(`Backend error ${res.status}: ${detail}`, res.status);
  }
  return json;
}

function unwrap(resp) {
  if (resp && resp.success === false) throw new ApiError(resp.message || 'The backend reported a failure.');
  return resp;
}

// The status document is served at the backend root locally, but in the
// Alibaba Cloud deployment nginx serves the React app there and exposes the
// same document at /api/status. Try that first, fall back to the root.
export const health = () =>
  req('/api/status', { timeoutMs: 8000 }).catch(() => req('/', { timeoutMs: 8000 }));
export const learnedSkills = () => req('/api/skills/learned', { timeoutMs: 8000 });
export const learningSummary = () => req('/api/learning/summary', { timeoutMs: 8000 });

export async function listCredentials() {
  // 30s: the single-worker backend can be briefly busy finishing a generate/code
  // call when the deploy modal opens; a tight timeout there fails the whole modal.
  const resp = await req('/api/credentials/list', { auth: true, timeoutMs: 30000 });
  return resp?.accounts || [];
}

export async function generateArchitecture({ title, description, requirements, provider, optimization_goal = 'balanced' }) {
  return unwrap(await req('/api/architecture/generate', {
    method: 'POST',
    timeoutMs: 180000,
    body: { title, description, requirements, provider, optimization_goal },
  }));
}

export async function generateCode({ architecture, code_type, provider }) {
  return unwrap(await req('/api/code/generate', {
    method: 'POST',
    timeoutMs: 240000,
    body: { architecture, code_type, provider },
  }));
}

export async function askChat(question, context) {
  const resp = unwrap(await req('/api/chat', {
    method: 'POST',
    timeoutMs: 240000,
    body: { question, ...(context ? { context } : {}) },
  }));
  return resp?.data?.answer || '';
}

export async function analyzeImage(buffer, filename, mimetype) {
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimetype }), filename);
  return unwrap(await req('/api/architecture/analyze-image', { method: 'POST', form, timeoutMs: 180000 }));
}

export async function deploy({ architecture, config, gitlab_issue_iid }) {
  return unwrap(await req('/api/deploy', {
    method: 'POST',
    auth: true,
    timeoutMs: 720000,
    body: {
      architecture,
      config: { ...config, confirmDeploy: true },
      gitlab_issue_iid: gitlab_issue_iid ?? null,
      confirm_deploy: true,
    },
  }));
}
