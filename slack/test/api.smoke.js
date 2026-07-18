/**
 * Manual smoke test against a live backend. Run the backend first:
 *   cd project && uvicorn backend.api.main:app --port 8000
 * Then:
 *   node test/api.smoke.js                  # health + skills
 *   RUN_GENERATE=1 node test/api.smoke.js   # + a real (slow, LLM-billed) generate call
 */
import * as api from '../src/api.js';

const ok = (name, extra = '') => console.log(`✅ ${name}${extra ? ` — ${extra}` : ''}`);
const fail = (name, err) => { console.error(`❌ ${name} — ${err.message}`); process.exitCode = 1; };

try {
  const h = await api.health();
  ok('health', `agent_ready=${h.agent_ready} llm_connected=${h.llm_connected} model=${h.model_id}`);
} catch (err) { fail('health', err); }

try {
  const s = await api.learnedSkills();
  ok('skills/learned', `count=${s.count}`);
} catch (err) { fail('skills/learned', err); }

try {
  const accounts = await api.listCredentials();
  ok('credentials/list', `${accounts.length} account(s)`);
} catch (err) {
  console.warn(`⚠️ credentials/list — ${err.message} (expected if SKY_API_KEY is unset)`);
}

if (process.env.RUN_GENERATE) {
  try {
    const r = await api.generateArchitecture({
      title: 'Smoke test app',
      description: 'A tiny static website with one backend service.',
      requirements: ['low cost'],
      provider: 'alicloud',
    });
    ok('architecture/generate', `${r.data?.components?.length ?? 0} components`);
  } catch (err) { fail('architecture/generate', err); }
}
