import * as api from '../api.js';
import { homeView } from '../blocks/home.js';
import { userRecents, newSession, getSession } from '../state.js';
import { methodView, useCaseView } from '../blocks/wizard.js';
import { reviewMessage } from '../blocks/review.js';
import { postRich } from '../blocks/common.js';
import { openDm, notifyUser, SESSION_EXPIRED } from './shared.js';

/** Builds and publishes the Home dashboard; degraded (never crashes) when the backend is down. */
export async function publishHome(client, userId) {
  const [h, s] = await Promise.allSettled([api.health(), api.learnedSkills()]);
  const view = homeView({
    health: h.status === 'fulfilled' ? h.value : null,
    skills: s.status === 'fulfilled' ? s.value : null,
    recents: userRecents(userId),
  });
  await client.views.publish({ user_id: userId, view });
}

export default function register(app) {
  app.event('app_home_opened', async ({ event, client }) => {
    if (event.tab !== 'home') return;
    await publishHome(client, event.user);
  });

  app.action('sky_refresh_home', async ({ ack, body, client }) => {
    await ack();
    await publishHome(client, body.user.id);
  });

  app.action('sky_new', async ({ ack, body, client }) => {
    await ack();
    const session = newSession(body.user.id, body.channel?.id || null);
    await client.views.open({ trigger_id: body.trigger_id, view: methodView(session.sid) });
  });

  // Home quick-start: provider preset, jump straight to the use-case form.
  app.action(/^sky_quickstart_/, async ({ ack, body, client, action }) => {
    await ack();
    const session = newSession(body.user.id, null);
    session.provider = action.value;
    session.step = 'usecase';
    await client.views.open({ trigger_id: body.trigger_id, view: useCaseView(session) });
  });

  // "Open" on a recent architecture: repost its review card in a DM.
  app.action('sky_open', async ({ ack, body, client, action }) => {
    await ack();
    const session = getSession(action.value);
    if (!session?.architecture) return notifyUser(client, body, SESSION_EXPIRED);
    const dm = await openDm(client, body.user.id);
    session.channel = dm;
    const { rich, classic, text } = reviewMessage(session);
    const posted = await postRich(client, dm, text, rich, classic);
    session.reviewMsg = { channel: dm, ts: posted.ts };
  });

  app.action('img_start', async ({ ack, body, client }) => {
    await ack();
    const dm = await openDm(client, body.user.id);
    await client.chat.postMessage({
      channel: dm,
      text: '📎 Upload a *PNG, JPG, or PDF* of your architecture diagram right here and I\'ll analyze it with Nemotron vision (max 10 MB).',
    });
    if (!body.channel?.id || body.channel.id !== dm) {
      await notifyUser(client, body, '📬 Check your DM with me — upload the diagram there.');
    }
  });
}
