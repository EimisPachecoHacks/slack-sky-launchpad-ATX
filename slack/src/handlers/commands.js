import * as api from '../api.js';
import { newSession } from '../state.js';
import { methodView } from '../blocks/wizard.js';
import { entryCard, helpBlocks } from '../blocks/home.js';
import { runTester } from './tester.js';
import { openDm } from './shared.js';

export default function register(app) {
  app.command('/sky', async ({ command, ack, respond, client }) => {
    await ack();
    const arg = (command.text || '').trim();
    const lower = arg.toLowerCase();
    try {
      if (lower.startsWith('test ')) {
        const url = arg.slice(5).trim().replace(/^<|>$/g, '').split('|')[0];
        if (!/^https?:\/\//.test(url)) {
          await respond({ response_type: 'ephemeral', text: 'Usage: `/sky test http://your-app-url`' });
          return;
        }
        const channel = command.channel_id;
        await respond({ response_type: 'ephemeral', text: `🧪 Starting the Qwen test agent on ${url}…` });
        try {
          await runTester(client, channel, { url, appName: new URL(url).hostname });
        } catch (err) {
          const dm = await openDm(client, command.user_id);
          await runTester(client, dm, { url, appName: new URL(url).hostname });
        }
        return;
      }
      if (lower === 'new') {
        const session = newSession(command.user_id, command.channel_id);
        await client.views.open({ trigger_id: command.trigger_id, view: methodView(session.sid) });
      } else if (lower === 'help') {
        await respond({ response_type: 'ephemeral', blocks: helpBlocks(), text: 'Sky Launchpad help' });
      } else if (lower === 'status') {
        try {
          const h = await api.health();
          await respond({
            response_type: 'ephemeral',
            text: `🟢 Backend healthy — model \`${h.model_id || '?'}\` · agent ${h.agent_ready ? 'ready' : 'not ready'} · LLM ${h.llm_connected ? 'connected' : '⚠️ NOT connected'}`,
          });
        } catch (err) {
          await respond({ response_type: 'ephemeral', text: `🔴 Backend unreachable: ${err.message}` });
        }
      } else {
        await respond({ response_type: 'ephemeral', blocks: entryCard(), text: 'Sky Launchpad — what are we building today?' });
      }
    } catch (err) {
      await respond({ response_type: 'ephemeral', text: `❌ ${err.message}` });
    }
  });
}
