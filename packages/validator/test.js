import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { validateContract, validateAgainst, validateChain, classifyFinding, fingerprint, canonical } from './index.js';

const root = new URL('../../examples/', import.meta.url);
const load = (rel) => JSON.parse(readFileSync(new URL(rel, root), 'utf8'));
const jsonIn = (rel) => readdirSync(new URL(rel, root)).filter((name) => name.endsWith('.json')).sort();
const loadChain = (dir) => {
  const objects = jsonIn(`${dir}/`).map((name) => load(`${dir}/${name}`));
  return { contracts: objects.filter((object) => 'aac' in object), responses: objects.filter((object) => !('aac' in object)) };
};
const chain = ({ contracts, responses }) => validateChain(contracts, responses);
const expected = load('invalid/expected.json');

for (const name of jsonIn('.')) {
  test(`valid contract ${name}`, () => {
    const result = validateContract(load(name));
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.warnings, []);
  });
}

for (const dir of readdirSync(new URL('chains/', root))) {
  test(`valid chain ${dir}`, () => assert.deepEqual(chain(loadChain(`chains/${dir}`)).errors, []));
}

for (const name of jsonIn('invalid').filter((name) => name !== 'expected.json')) {
  test(`invalid contract ${name} fails on ${expected[name]}`, () => {
    const rules = validateContract(load(`invalid/${name}`)).errors.map((error) => error.rule);
    assert.ok(rules.includes(expected[name]), `expected ${expected[name]}, got ${JSON.stringify(rules)}`);
  });
}

for (const dir of readdirSync(new URL('invalid-chains/', root))) {
  const rule = expected[`invalid-chains/${dir}`];
  test(`invalid chain ${dir} fails on ${rule}`, () => {
    const rules = chain(loadChain(`invalid-chains/${dir}`)).errors.map((error) => error.rule);
    assert.ok(rules.includes(rule), `expected ${rule}, got ${JSON.stringify(rules)}`);
  });
}

test('the fingerprint is the first 12 hex characters of the sha256 of the canonical criteria', () => {
  const mixed = load('contract-mixed.json');
  assert.equal(fingerprint(mixed.criteria), mixed.contract.fingerprint);
  assert.equal(canonical({ b: [1, { d: null, c: 'x' }], a: true }), '{"a":true,"b":[1,{"c":"x","d":null}]}');
  assert.equal(fingerprint(JSON.parse(canonical(mixed.criteria))), mixed.contract.fingerprint);
});

test('a universal statement on an enumerable criterion is a warning, not an error', () => {
  const contract = structuredClone(load('contract-enumerable.json'));
  contract.criteria[0].statement = 'Every retry policy computes the documented delay.';
  contract.contract.fingerprint = fingerprint(contract.criteria);
  const result = validateContract(contract);
  assert.deepEqual(result.errors, []);
  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0].rule, '§5');
});

test('a probe outside the bounded domain is an extension, a row inside it is against the criterion', () => {
  const { contracts, responses } = loadChain('chains/extension-then-close');
  const [first] = contracts;
  const [round] = responses;
  const probe = round.findings[0];
  assert.equal(classifyFinding(first, probe).status, 'extension');
  const inside = { ...probe, location: `${first.criteria[0].domain.artifact}@${first.criteria[0].domain.fingerprint}#row:41` };
  assert.equal(classifyFinding(first, inside).status, 'against');
  assert.equal(classifyFinding(first, { ...probe, class: 'unknown-class' }).status, 'extension');
  assert.equal(classifyFinding(first, { ...probe, severity: 'advisory' }).status, 'advisory');
});

test('a single extension round at a budget of one must escalate', () => {
  const { contracts, responses } = loadChain('chains/extension-then-close');
  const [first] = contracts;
  const escalated = validateAgainst(first, responses[0]);
  assert.deepEqual(escalated.errors, []);
  assert.equal(escalated.findings[0].status, 'extension');
  const blocked = structuredClone(responses[0]);
  blocked.verdict = 'block';
  blocked.findings[0].remedy = { kind: 'delegate', role: 'spec owner' };
  const rules = validateAgainst(first, blocked).errors.map((error) => error.rule);
  assert.ok(rules.includes('§6'));
});

test('a round against an earlier revision after a later one is a stale brief', () => {
  const { contracts, responses } = loadChain('chains/extension-then-close');
  const stale = structuredClone(responses[1]);
  stale.gate.version = contracts[0].contract.fingerprint;
  stale.verdict = 'allow';
  const messages = validateChain(contracts, [responses[0], responses[1], stale]).errors.map((error) => error.message);
  assert.ok(messages.some((message) => message.includes('the brief is stale')));
});

test('a revision must change the fingerprint', () => {
  const { contracts } = loadChain('chains/extension-then-close');
  const same = structuredClone(contracts[0]);
  same.contract.revision = 2;
  const rules = validateChain([contracts[0], same], []).errors.map((error) => error.rule);
  assert.ok(rules.includes('§3'));
});

test('a non-object is rejected', () => {
  assert.equal(validateContract([]).errors[0].rule, 'schema');
  assert.equal(validateAgainst(load('contract-judgment.json'), 'no').errors[0].rule, 'schema');
  assert.equal(validateChain([], []).errors[0].rule, 'schema');
});
