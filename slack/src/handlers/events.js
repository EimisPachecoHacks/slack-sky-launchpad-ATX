import { entryCard, helpBlocks } from '../blocks/home.js';
import { handleImageUpload } from './files.js';

export default function register(app) {
  app.event('app_mention', async ({ event, client }) => {
    const thread = event.thread_ts || event.ts;
    const text = (event.text || '').toLowerCase();
    const blocks = /\bhelp\b/.test(text) ? helpBlocks() : entryCard();
    await client.chat.postMessage({ channel: event.channel, thread_ts: thread, blocks, text: 'Sky Launchpad' });
  });

  // DMs: text → entry card / help; file uploads → image-analysis path.
  app.event('message', async ({ event, client, context }) => {
    if (event.channel_type !== 'im') return;
    if (event.bot_id || event.user === context.botUserId) return;
    if (event.subtype && event.subtype !== 'file_share') return;

    if (event.files?.length) return handleImageUpload(client, event);

    const text = (event.text || '').trim().toLowerCase();
    if (!text) return;
    if (/\bhelp\b|^\?$/.test(text)) {
      return client.chat.postMessage({ channel: event.channel, blocks: helpBlocks(), text: 'Sky Launchpad help' });
    }
    return client.chat.postMessage({ channel: event.channel, blocks: entryCard(), text: 'Sky Launchpad — what are we building today?' });
  });
}
