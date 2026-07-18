import { plain, mrkdwn, PROVIDERS, providerMeta } from '../util.js';

const meta = sid => JSON.stringify({ sid });
const TITLE = plain('Sky Launchpad');

/** Step 1 — choose design method. No input blocks → no submit button needed. */
export function methodView(sid) {
  return {
    type: 'modal',
    callback_id: 'sky_wizard',
    private_metadata: meta(sid),
    title: TITLE,
    close: plain('Cancel'),
    blocks: [
      { type: 'header', text: plain('🚀 New Architecture') },
      { type: 'section', text: mrkdwn('How would you like to design your cloud architecture?') },
      { type: 'divider' },
      {
        type: 'section',
        text: mrkdwn('*🧭 Guided Wizard*\nDescribe your project in plain English and Qwen designs the architecture for you.'),
        accessory: { type: 'button', style: 'primary', text: plain('Start'), action_id: 'wiz_method', value: 'guided' },
      },
      {
        type: 'section',
        text: mrkdwn('*🖼️ AI Image Analysis*\nUpload a diagram (PNG, JPG, or PDF) and Qwen vision reconstructs it as a live architecture.'),
        accessory: { type: 'button', text: plain('Use an image'), action_id: 'wiz_method', value: 'image' },
      },
    ],
  };
}

/** Step 2 — provider selection, one card per provider. */
export function providerView(sid) {
  return {
    type: 'modal',
    callback_id: 'sky_wizard',
    private_metadata: meta(sid),
    title: TITLE,
    close: plain('Cancel'),
    blocks: [
      { type: 'header', text: plain('☁️ Choose your cloud provider') },
      ...Object.entries(PROVIDERS).map(([id, p]) => ({
        type: 'section',
        text: mrkdwn(`*${p.emoji} ${p.label}*\n${p.tagline}`),
        accessory: { type: 'button', text: plain('Select'), action_id: 'wiz_provider', value: id },
      })),
      { type: 'divider' },
      { type: 'actions', elements: [{ type: 'button', text: plain('← Back'), action_id: 'wiz_back', value: 'method' }] },
    ],
  };
}

/** Step 3 — the use-case form. Prefills from the session so "Try Again" keeps input. */
export function useCaseView(session) {
  const p = providerMeta(session.provider);
  const pre = v => (v ? { initial_value: v } : {});
  return {
    type: 'modal',
    callback_id: 'sky_wizard',
    private_metadata: meta(session.sid),
    title: TITLE,
    submit: plain('Generate Architecture'),
    close: plain('Cancel'),
    blocks: [
      { type: 'header', text: plain('📝 Describe your project') },
      { type: 'context', elements: [mrkdwn(`Provider: *${p.emoji} ${p.label}* · optimization: balanced`)] },
      {
        type: 'input',
        block_id: 'title_b',
        label: plain('Project title'),
        element: {
          type: 'plain_text_input', action_id: 'v', max_length: 100,
          placeholder: plain('e.g. E-commerce platform'), ...pre(session.title),
        },
      },
      {
        type: 'input',
        block_id: 'desc_b',
        label: plain('Project description'),
        element: {
          type: 'plain_text_input', action_id: 'v', multiline: true, max_length: 2000,
          placeholder: plain('What are you building? Who uses it? What matters most — cost, performance, scale?'),
          ...pre(session.description),
        },
      },
      {
        type: 'input',
        block_id: 'reqs_b',
        optional: true,
        label: plain('Requirements'),
        hint: plain('One requirement per line'),
        element: {
          type: 'plain_text_input', action_id: 'v', multiline: true, max_length: 2000,
          placeholder: plain('Handle 10k concurrent users\nPostgreSQL database\nAuto-scaling'),
          ...pre((session.requirements || []).join('\n')),
        },
      },
      { type: 'actions', elements: [{ type: 'button', text: plain('← Change provider'), action_id: 'wiz_back', value: 'provider' }] },
    ],
  };
}

/** Shown when the user picks the image path inside the wizard. */
export function imageInstructionsView(sid) {
  return {
    type: 'modal',
    callback_id: 'sky_wizard',
    private_metadata: meta(sid),
    title: TITLE,
    close: plain('Got it'),
    blocks: [
      { type: 'header', text: plain('🖼️ AI Image Analysis') },
      { type: 'section', text: mrkdwn('Close this window and *upload your architecture diagram* in a DM with me.\n\n• PNG, JPG, or PDF\n• Up to 10 MB\n\nQwen vision will detect the components and rebuild the architecture — then you can generate code and deploy it, same as the wizard.') },
      { type: 'divider' },
      { type: 'actions', elements: [{ type: 'button', text: plain('← Back'), action_id: 'wiz_back', value: 'method' }] },
    ],
  };
}

/** Replaces the modal when its session no longer exists (app restarted). */
export function expiredView() {
  return {
    type: 'modal',
    title: TITLE,
    close: plain('Close'),
    blocks: [
      { type: 'section', text: mrkdwn('⌛ This session has expired (the app restarted).\nStart again with `/sky new` — it only takes a minute.') },
    ],
  };
}
