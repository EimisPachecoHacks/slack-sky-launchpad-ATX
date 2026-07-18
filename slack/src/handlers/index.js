import commands from './commands.js';
import home from './home.js';
import events from './events.js';
import wizard from './wizard.js';
import review from './review.js';
import deploy from './deploy.js';
import tester from './tester.js';

export function register(app) {
  commands(app);
  home(app);
  events(app);
  wizard(app);
  review(app);
  deploy(app);
  tester(app);

  app.error(async err => {
    console.error('Unhandled app error:', err?.original || err);
  });
}
