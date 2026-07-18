export const SESSION_EXPIRED = '⌛ That session has expired (the app restarted). Start again with `/sky new`.';

export async function openDm(client, userId) {
  const res = await client.conversations.open({ users: userId });
  return res.channel.id;
}

/**
 * Posts to the session's channel; if the bot isn't a member (slash commands work
 * in channels the bot never joined), falls back to a DM and remembers it.
 */
export async function postToSession(client, session, msg) {
  if (session.channel) {
    try {
      return await client.chat.postMessage({ channel: session.channel, ...msg });
    } catch (err) {
      const code = err?.data?.error || '';
      if (!/not_in_channel|channel_not_found|is_archived|restricted_action/.test(code)) throw err;
    }
  }
  session.channel = await openDm(client, session.userId);
  return client.chat.postMessage({ channel: session.channel, ...msg });
}

/** Quiet notice to the user: ephemeral where possible, DM otherwise. */
export async function notifyUser(client, body, text) {
  const user = body.user?.id;
  const channel = body.channel?.id;
  if (channel) {
    try {
      return await client.chat.postEphemeral({ channel, user, text });
    } catch { /* fall through to DM */ }
  }
  const dm = await openDm(client, user);
  return client.chat.postMessage({ channel: dm, text });
}
