/**
 * In-memory session store. Architecture JSON is too large for Slack's
 * private_metadata (3000 chars), so modals and buttons carry only the sid.
 * State resets on restart — handlers treat a missing session as "expired".
 */

let seq = 0;
const sessions = new Map();
const recents = new Map(); // userId -> sid[] (newest first)

const MAX_SESSIONS = 50;
const MAX_RECENTS = 5;

export function newSession(userId, channel = null) {
  const sid = `s_${++seq}`;
  const session = {
    sid,
    userId,
    channel,          // where the flow's messages live (falls back to DM on post)
    step: 'method',   // method|provider|usecase|generating|review|code|deploying|done|failed
    provider: null,
    title: '',
    description: '',
    requirements: [],
    architecture: null,
    reasoning: '',
    recommendations: [],
    summaryMessage: '',
    detectedComponents: [],
    gitlabIssueIid: null,
    gitlabIssueUrl: null,
    code: {},          // code_type -> {code, skills_used, model, uploaded}
    activeTab: 'terraform',
    reviewMsg: null,   // {channel, ts}
    codeMsg: null,     // {channel, ts}
    deploy: {},        // {region, accountId, endpoint, mrUrl, status}
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  sessions.set(sid, session);

  const list = (recents.get(userId) || []).filter(s => s !== sid);
  list.unshift(sid);
  recents.set(userId, list.slice(0, MAX_RECENTS));

  if (sessions.size > MAX_SESSIONS) {
    const oldest = [...sessions.values()].sort((a, b) => a.updatedAt - b.updatedAt)[0];
    sessions.delete(oldest.sid);
  }
  return session;
}

export function getSession(sid) {
  const s = sessions.get(sid);
  if (s) s.updatedAt = Date.now();
  return s || null;
}

export function userRecents(userId) {
  return (recents.get(userId) || []).map(sid => sessions.get(sid)).filter(Boolean);
}
