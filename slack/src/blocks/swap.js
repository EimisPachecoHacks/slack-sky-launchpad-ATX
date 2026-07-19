import { plain, mrkdwn, clip, money } from '../util.js';

const meta = sid => JSON.stringify({ sid });

export function swapLoadingView(sid) {
  return {
    type: 'modal',
    callback_id: 'sky_swap',
    private_metadata: meta(sid),
    title: plain('Swap component'),
    close: plain('Cancel'),
    blocks: [{ type: 'section', text: mrkdwn('🧠 Asking Nemotron for per-component alternatives…') }],
  };
}

export function swapErrorView(message) {
  return {
    type: 'modal',
    title: plain('Swap component'),
    close: plain('Close'),
    blocks: [{ type: 'section', text: mrkdwn(`❌ Couldn't get alternatives:\n${clip(message, 2800)}`) }],
  };
}

/**
 * The per-row switcher, like the web ComponentList: pick a component, pick its
 * replacement. `alternatives` = { [componentId]: [{name, cost, reason}] }.
 */
export function swapView(session, selectedId) {
  const comps = session.architecture?.components || [];
  const alts = (session.alternatives || {})[selectedId] || [];
  const compOptions = comps.map(c => ({
    text: plain(clip(`${c.name} — ${money(Number(c.cost) || 0)}/mo`, 74)),
    value: String(c.id),
  }));
  const initialComp = compOptions.find(o => o.value === String(selectedId)) || compOptions[0];
  const altOptions = alts.map((a, i) => ({
    text: plain(clip(`${a.name} — ${money(Number(a.cost) || 0)}/mo`, 74)),
    ...(a.reason ? { description: plain(clip(a.reason, 74)) } : {}),
    value: String(i),
  }));

  return {
    type: 'modal',
    callback_id: 'sky_swap',
    private_metadata: meta(session.sid),
    title: plain('Swap component'),
    ...(altOptions.length ? { submit: plain('Swap it') } : {}),
    close: plain('Cancel'),
    blocks: [
      { type: 'section', text: mrkdwn('Replace a component with an alternative service — the table, costs, and diagram update in place.') },
      {
        type: 'input',
        block_id: 'comp_b',
        dispatch_action: true,
        label: plain('Component to replace'),
        element: {
          type: 'static_select', action_id: 'v',
          options: compOptions,
          ...(initialComp ? { initial_option: initialComp } : {}),
        },
      },
      altOptions.length
        ? {
            type: 'input',
            block_id: 'alt_b',
            label: plain('Replace with'),
            element: { type: 'static_select', action_id: 'v', options: altOptions, placeholder: plain('Choose an alternative') },
          }
        : { type: 'section', text: mrkdwn('_No alternatives proposed for this component — pick another._') },
    ],
  };
}
