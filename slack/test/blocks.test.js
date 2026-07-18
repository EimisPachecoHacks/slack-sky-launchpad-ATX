import test from 'node:test';
import assert from 'node:assert/strict';

import { homeView, entryCard, helpBlocks } from '../src/blocks/home.js';
import { methodView, providerView, useCaseView, imageInstructionsView, expiredView } from '../src/blocks/wizard.js';
import { reviewMessage, reasoningBlocks } from '../src/blocks/review.js';
import { codeMessage } from '../src/blocks/code.js';
import { placeholderView, deployFormView, noAccountsView, deployErrorView, successMessage, failureMessage } from '../src/blocks/deploy.js';
import { card, cardClassic, dataTable, tableClassic } from '../src/blocks/common.js';
import { chunkText, slackify, totalCost, PROVIDERS } from '../src/util.js';

const fakeSession = (over = {}) => ({
  sid: 's_1',
  userId: 'U1',
  channel: 'D1',
  step: 'review',
  provider: 'alicloud',
  title: 'E-commerce platform',
  description: 'A shop',
  requirements: ['scale', 'postgres'],
  architecture: {
    name: 'E-commerce platform',
    description: 'Web tier + DB',
    provider: 'alicloud',
    components: [
      { id: 'c1', name: 'ECS Instance', type: 'compute', cost: 45.5 },
      { id: 'c2', name: 'RDS PostgreSQL', type: 'database', cost: 89 },
    ],
    metadata: { totalCost: 134.5 },
  },
  reasoning: '## Why\n**Because** reasons\n- item one',
  recommendations: ['Use CDN'],
  summaryMessage: 'Designed a 2-component architecture.',
  detectedComponents: [],
  gitlabIssueIid: 7,
  gitlabIssueUrl: 'https://gitlab.com/x/y/-/issues/7',
  code: {},
  activeTab: 'terraform',
  deploy: { region: 'ap-southeast-1' },
  ...over,
});

function assertSectionLimits(blocks) {
  for (const b of blocks) {
    if (b.type === 'section' && b.text) {
      assert.ok(b.text.text.length <= 3000, `section over 3000 chars (${b.text.text.length})`);
    }
  }
}

function assertModal(view, { needsSubmit = false } = {}) {
  assert.equal(view.type, 'modal');
  assert.ok(view.title.text.length <= 24, 'modal title over 24 chars');
  assert.ok(view.blocks.length >= 1 && view.blocks.length <= 100, 'modal block count out of range');
  if (needsSubmit) assert.ok(view.submit, 'modal missing submit');
  const hasInputs = view.blocks.some(b => b.type === 'input');
  if (hasInputs) assert.ok(view.submit, 'modal has input blocks but no submit button');
  assertSectionLimits(view.blocks);
}

test('wizard modals are valid', () => {
  assertModal(methodView('s_1'));
  assertModal(providerView('s_1'));
  assertModal(useCaseView(fakeSession()), { needsSubmit: true });
  assertModal(imageInstructionsView('s_1'));
  assertModal(expiredView());
  assert.equal(methodView('s_1').callback_id, 'sky_wizard');
  assert.equal(JSON.parse(useCaseView(fakeSession()).private_metadata).sid, 's_1');
});

test('useCaseView prefills previous input', () => {
  const v = useCaseView(fakeSession());
  const title = v.blocks.find(b => b.block_id === 'title_b');
  assert.equal(title.element.initial_value, 'E-commerce platform');
  const reqs = v.blocks.find(b => b.block_id === 'reqs_b');
  assert.equal(reqs.element.initial_value, 'scale\npostgres');
});

test('review message has rich and classic variants', () => {
  const { rich, classic, text } = reviewMessage(fakeSession());
  assert.ok(text.includes('E-commerce platform'));
  const table = rich.find(b => b.type === 'data_table');
  assert.ok(table, 'rich variant missing data_table');
  assert.ok(table.caption, 'data_table missing required caption');
  assert.ok(classic.every(b => b.type !== 'data_table' && b.type !== 'card'), 'classic variant contains rich blocks');
  assertSectionLimits(classic);
});

test('review message survives an empty architecture', () => {
  const { rich, classic } = reviewMessage(fakeSession({ architecture: { components: [] }, gitlabIssueUrl: null }));
  assert.ok(rich.length >= 2 && classic.length >= 2);
});

test('reasoning blocks are chunked and slackified', () => {
  const long = fakeSession({ reasoning: '## Head\n' + 'x'.repeat(9000) });
  const blocks = reasoningBlocks(long);
  assertSectionLimits(blocks);
  assert.ok(blocks.length >= 3, 'long reasoning should chunk into several sections');
  assert.equal(slackify('**bold**\n## Heading\n- item'), '*bold*\n*Heading*\n• item');
});

test('code message: tabs, deploy button, aws-only cloudformation', () => {
  const ali = fakeSession({ code: { terraform: { code: 'resource {}', skills_used: [], model: 'qwen3.7-max' } } });
  const { blocks } = codeMessage(ali, 'terraform');
  const actions = blocks.find(b => b.type === 'actions');
  const ids = actions.elements.map(e => e.action_id);
  assert.ok(ids.includes('code_tab_terraform'));
  assert.ok(!ids.includes('code_tab_cloudformation'), 'CloudFormation tab must not appear for alicloud');
  assert.ok(ids.includes('code_deploy'));

  const aws = fakeSession({ provider: 'aws', architecture: { ...fakeSession().architecture, provider: 'aws' } });
  const awsActions = codeMessage(aws, 'terraform').blocks.find(b => b.type === 'actions');
  assert.ok(awsActions.elements.some(e => e.action_id === 'code_tab_cloudformation'), 'CloudFormation tab missing for aws');
});

test('long code is not inlined', () => {
  const s = fakeSession({ code: { terraform: { code: 'x'.repeat(5000), skills_used: [], model: 'm' } } });
  const { blocks } = codeMessage(s, 'terraform');
  assert.ok(!blocks.some(b => b.type === 'section' && b.text?.text.includes('xxxx')), 'long code must go to a snippet, not inline');
  assertSectionLimits(blocks);
});

test('deploy modals are valid, with and without accounts', () => {
  const accounts = [
    { id: 'a1', provider: 'alicloud', accountId: '123', accountName: 'Main', isDefault: true },
    { id: 'a2', provider: 'alicloud', accountId: '456', accountName: 'Test', isDefault: false },
  ];
  const form = deployFormView(fakeSession(), accounts);
  assertModal(form, { needsSubmit: true });
  assert.equal(form.callback_id, 'sky_deploy');
  const account = form.blocks.find(b => b.block_id === 'account_b');
  assert.equal(account.element.initial_option.value, '123', 'default account should be preselected');
  const region = form.blocks.find(b => b.block_id === 'region_b');
  assert.equal(region.element.initial_option.value, 'ap-southeast-1');
  assert.ok(form.blocks.find(b => b.block_id === 'confirm_b'), 'missing confirmation checkbox');

  const empty = noAccountsView(fakeSession());
  assertModal(empty);
  assert.ok(!empty.submit, 'no-accounts view must not have a submit button');
  assertModal(placeholderView('s_1'));
  assertModal(deployErrorView('boom'));
});

test('deploy result messages', () => {
  const ok = successMessage(fakeSession(), {
    status: 'success', endpoint: 'http://1.2.3.4', gitlab_mr_url: 'https://gitlab.com/mr/1',
    outputs: { ip: '1.2.3.4' }, deployment_logs: Array.from({ length: 40 }, (_, i) => `log ${i}`),
  });
  assert.ok(ok.rich.find(b => b.type === 'card'));
  assert.ok(ok.text.includes('succeeded'));
  assertSectionLimits(ok.classic);

  const bad = failureMessage(fakeSession(), 'terraform apply failed: '.padEnd(4000, 'z'), ['line1']);
  assert.ok(bad.text.includes('failed'));
  assertSectionLimits(bad.classic);
  const retry = bad.classic.find(b => b.type === 'actions');
  assert.ok(retry.elements.some(e => e.action_id === 'dep_retry'));
});

test('home view renders healthy, degraded, and with recents', () => {
  for (const args of [
    {},
    { health: { model_id: 'qwen3.7-max', llm_connected: true }, skills: { count: 4, total_retries_avoided: 9 } },
    { recents: [fakeSession(), fakeSession({ architecture: null, step: 'usecase', title: 'Draft' })] },
  ]) {
    const view = homeView(args);
    assert.equal(view.type, 'home');
    assert.ok(view.blocks.length <= 100);
    assert.ok(view.blocks.every(b => !['card', 'data_table'].includes(b.type)), 'home must use classic blocks only');
    assertSectionLimits(view.blocks);
  }
});

test('entry card and help', () => {
  assertSectionLimits(entryCard());
  assertSectionLimits(helpBlocks());
  const actions = entryCard().find(b => b.type === 'actions');
  assert.ok(actions.elements.some(e => e.action_id === 'sky_new'));
  assert.ok(actions.elements.some(e => e.action_id === 'img_start'));
});

test('common builders', () => {
  const c = card({ emoji: '✅', title: 'T', subtitle: 's', body: 'b', buttons: [{ text: 'x', action_id: 'a' }, { text: 'url', action_id: 'u', url: 'https://x.dev' }] });
  assert.equal(c.type, 'card');
  assert.equal(c.actions[1].url, 'https://x.dev');
  const cc = cardClassic({ title: 'T', buttons: [{ text: 'x', action_id: 'a' }] });
  assert.equal(cc[0].type, 'section');
  const dt = dataTable(['A', 'B'], [{ A: 'one', B: 2 }], 'cap');
  assert.equal(dt.rows.length, 2);
  assert.equal(dt.rows[1][1].type, 'raw_number');
  const tc = tableClassic(['A'], [{ A: 'v' }]);
  assert.ok(tc[0].text.text.startsWith('```'));
});

test('util: chunking, cost, providers', () => {
  const chunks = chunkText('line\n'.repeat(2000), 2900);
  assert.ok(chunks.every(c => c.length <= 2900));
  assert.equal(chunks.join(''), 'line\n'.repeat(2000));
  assert.equal(totalCost({ metadata: {}, components: [{ cost: 1 }, { cost: 2 }] }), 3);
  assert.equal(totalCost({ metadata: { totalCost: 10 }, components: [] }), 10);
  assert.deepEqual(Object.keys(PROVIDERS), ['aws', 'azure', 'gcp', 'alicloud']);
  for (const p of Object.values(PROVIDERS)) assert.ok(p.regions.length > 0 && p.regions.includes(p.defaultRegion));
});
