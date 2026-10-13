import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020.js';

const schemaUrl = new URL('../../schema/aac.schema.json', import.meta.url);
export const aacSchema = JSON.parse(readFileSync(schemaUrl, 'utf8'));

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validateSchema = ajv.compile(aacSchema);

const UNIVERSAL_WORDS = /\b(every|all|any|no|never|always)\b/i;
const BUILDER_FIXES = new Set(['rewrite', 'generate', 'patch', 'command']);
const ANSWERS = ['grow', 'close', 'narrow'];

const diagnostic = (path, rule, message, severity = 'error') => ({ path, rule, message, severity });
const split = (diagnostics) => ({
  errors: diagnostics.filter((entry) => entry.severity === 'error'),
  warnings: diagnostics.filter((entry) => entry.severity === 'warning'),
});
const prefixed = (prefix, diagnostics) => diagnostics.map((entry) => ({ ...entry, path: `${prefix}${entry.path}` }));
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

// Canonical JSON: object keys sorted by code point at every depth, no insignificant whitespace.
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function fingerprint(criteria) {
  return `sha256:${createHash('sha256').update(canonical(criteria), 'utf8').digest('hex').slice(0, 12)}`;
}

function schemaDiagnostics(contract) {
  if (validateSchema(contract)) return [];
  return validateSchema.errors.map((error) =>
    diagnostic(error.instancePath || '$', 'schema', error.message || 'schema validation failed'));
}

function criterionDiagnostics(criterion, path) {
  const out = [];
  const kinds = criterion.checks.map((check) => check.kind);
  if (criterion.kind === 'enumerable' || criterion.kind === 'bounded') {
    kinds.forEach((kind, index) => {
      if (kind === 'condition') {
        out.push(diagnostic(`${path}/checks/${index}`, '§4', `a ${criterion.kind} criterion takes command or preview checks only`));
      }
    });
    if (criterion.kind === 'enumerable' && UNIVERSAL_WORDS.test(criterion.statement)) {
      out.push(diagnostic(`${path}/statement`, '§5',
        'the statement reads as a universal claim; an enumerable criterion names a finite set, so declare it bounded or structural', 'warning'));
    }
  }
  if (criterion.kind === 'structural') {
    if (!kinds.includes('command')) out.push(diagnostic(`${path}/checks`, '§4', 'a structural criterion needs at least one command check'));
    if (kinds.filter((kind) => kind === 'condition').length !== 1) {
      out.push(diagnostic(`${path}/checks`, '§4', 'a structural criterion needs exactly one condition check, which states the invariant'));
    }
  }
  if (criterion.kind === 'judgment') {
    kinds.forEach((kind, index) => {
      if (kind !== 'condition') out.push(diagnostic(`${path}/checks/${index}`, '§4', 'a judgment criterion takes condition checks only'));
    });
  }
  return out;
}

function contractDiagnostics(contract) {
  const out = [];
  const expected = fingerprint(contract.criteria);
  if (contract.contract.fingerprint !== expected) {
    out.push(diagnostic('/contract/fingerprint', '§3', `fingerprint ${contract.contract.fingerprint} does not match the criteria; expected ${expected}`));
  }
  const ids = new Set();
  const classes = new Set();
  contract.criteria.forEach((criterion, index) => {
    const path = `/criteria/${index}`;
    if (ids.has(criterion.id)) out.push(diagnostic(`${path}/id`, '§4', `duplicate criterion id ${criterion.id}`));
    ids.add(criterion.id);
    if (classes.has(criterion.class)) out.push(diagnostic(`${path}/class`, '§4', `duplicate class ${criterion.class}`));
    classes.add(criterion.class);
    out.push(...criterionDiagnostics(criterion, path));
  });
  return out;
}

export function validateContract(contract) {
  if (!isObject(contract)) return split([diagnostic('$', 'schema', 'expected a JSON object')]);
  const errors = schemaDiagnostics(contract);
  if (errors.length > 0) return split(errors);
  return split(contractDiagnostics(contract));
}

// The parts of an AGC response this validator reads. Validate the whole response with the AGC validator.
function responseDiagnostics(response) {
  if (!isObject(response)) return [diagnostic('$', 'schema', 'expected an AGC response object')];
  const out = [];
  if (response.agc !== '0.1') out.push(diagnostic('/agc', 'schema', 'expected an AGC 0.1 response'));
  if (!isObject(response.gate)) out.push(diagnostic('/gate', 'schema', 'expected a gate object'));
  if (typeof response.verdict !== 'string') out.push(diagnostic('/verdict', 'schema', 'expected a verdict'));
  if (!isObject(response.coverage) || !Array.isArray(response.coverage.classes)) {
    out.push(diagnostic('/coverage', 'schema', 'expected coverage with a classes array'));
  }
  if (response.findings !== undefined && !Array.isArray(response.findings)) out.push(diagnostic('/findings', 'schema', 'expected an array of findings'));
  (Array.isArray(response.findings) ? response.findings : []).forEach((finding, index) => {
    const path = `/findings/${index}`;
    if (!isObject(finding)) { out.push(diagnostic(path, 'schema', 'expected a finding object')); return; }
    ['id', 'class', 'location', 'severity'].forEach((field) => {
      if (typeof finding[field] !== 'string') out.push(diagnostic(`${path}/${field}`, 'schema', `expected a ${field}`));
    });
    if (!isObject(finding.check) || typeof finding.check.kind !== 'string') out.push(diagnostic(`${path}/check`, 'schema', 'expected a check with a kind'));
    if (!isObject(finding.remedy) || typeof finding.remedy.kind !== 'string') out.push(diagnostic(`${path}/remedy`, 'schema', 'expected a remedy with a kind'));
  });
  return out;
}

const rowOf = (location, artifact, artifactFingerprint) => {
  const prefix = `${artifact}@${artifactFingerprint}#`;
  return location.startsWith(prefix) && location.length > prefix.length ? location.slice(prefix.length) : null;
};

function insideCriterion(criterion, finding) {
  if (criterion.kind === 'enumerable') {
    if (criterion.cases.ids) return criterion.cases.ids.some((id) => finding.location === id || finding.location.endsWith(`#${id}`));
    return rowOf(finding.location, criterion.cases.artifact, criterion.cases.fingerprint) !== null;
  }
  if (criterion.kind === 'bounded') return rowOf(finding.location, criterion.domain.artifact, criterion.domain.fingerprint) !== null;
  return true;
}

export function classifyFinding(contract, finding) {
  const criterion = contract.criteria.find((entry) => entry.class === finding.class);
  const entry = { id: finding.id, criterion: criterion ? criterion.id : null };
  if (finding.severity !== 'blocking') return { ...entry, status: 'advisory' };
  if (!criterion) return { ...entry, status: 'extension', reason: `class ${finding.class} matches no criterion of the contract` };
  if (!insideCriterion(criterion, finding)) {
    const inside = criterion.kind === 'enumerable' ? 'a case of' : 'a row of the domain of';
    return { ...entry, status: 'extension', reason: `${finding.location} is not ${inside} ${criterion.id}` };
  }
  return { ...entry, status: 'against' };
}

function roundDiagnostics(contract, response) {
  const out = [];
  const findings = (response.findings || []).map((finding) => classifyFinding(contract, finding));
  findings.forEach((entry, index) => {
    const finding = response.findings[index];
    const criterion = contract.criteria.find((candidate) => candidate.id === entry.criterion);
    if (entry.status === 'against' && criterion.kind !== 'judgment' && finding.check.kind !== 'command') {
      out.push(diagnostic(`/findings/${index}/check`, '§6',
        `a blocking finding against the ${criterion.kind} criterion ${criterion.id} must carry a command check that runs its case`));
    }
    if (entry.status === 'extension') {
      if (BUILDER_FIXES.has(finding.remedy.kind)) {
        out.push(diagnostic(`/findings/${index}/remedy`, '§6',
          `${finding.id} is an extension, so its remedy must be delegate to the criterion's owner or decide, never a ${finding.remedy.kind} the builder applies`));
      } else if (finding.remedy.kind === 'delegate' && criterion?.owner && finding.remedy.role !== criterion.owner) {
        out.push(diagnostic(`/findings/${index}/remedy/role`, '§6',
          `${finding.id} is an extension of ${criterion.id}, whose owner is ${criterion.owner}, not ${finding.remedy.role}`, 'warning'));
      }
    }
  });
  contract.criteria.forEach((criterion) => {
    if (!response.coverage.classes.includes(criterion.class)) {
      out.push(diagnostic('/coverage/classes', '§8', `coverage does not list the criterion class ${criterion.class}`, 'warning'));
    }
  });
  if (response.gate.version === undefined) {
    out.push(diagnostic('/gate/version', '§8', 'the gate does not name the contract fingerprint in gate.version, so a stale brief cannot be detected', 'warning'));
  } else if (response.gate.version !== contract.contract.fingerprint) {
    out.push(diagnostic('/gate/version', '§8', `the gate names ${response.gate.version}, not the contract fingerprint ${contract.contract.fingerprint}`));
  }
  return { diagnostics: out, findings, extension: findings.some((entry) => entry.status === 'extension') };
}

function budgetDiagnostics(contract, response, extensionRounds) {
  const budget = contract.budget.extensions;
  const revision = contract.contract.revision;
  if (extensionRounds > budget) {
    return [diagnostic('/verdict', '§6',
      `extension round ${extensionRounds} exceeds the budget of ${budget} on revision ${revision}; the owner answers an escalation with a new revision`)];
  }
  if (extensionRounds < budget) return [];
  if (response.verdict !== 'escalate') {
    return [diagnostic('/verdict', '§6', `the extension budget of revision ${revision} is spent, so the gate must escalate with the three answers: grow, close or narrow`)];
  }
  const answers = (response.findings || []).some((finding) => finding.remedy.kind === 'decide' && Array.isArray(finding.remedy.options)
    && ANSWERS.every((answer) => finding.remedy.options.some((option) => String(option).toLowerCase().startsWith(answer))));
  if (!answers) {
    return [diagnostic('/findings', '§6', 'an escalation at the extension budget needs a decide remedy whose options are grow, close and narrow')];
  }
  return [];
}

export function validateAgainst(contract, response) {
  const contractResult = validateContract(contract);
  if (contractResult.errors.length > 0) return { ...contractResult, findings: [] };
  const shape = responseDiagnostics(response);
  if (shape.length > 0) return { ...split(shape), findings: [] };
  const round = roundDiagnostics(contract, response);
  const diagnostics = [...contractResult.warnings, ...round.diagnostics];
  if (round.extension) diagnostics.push(...budgetDiagnostics(contract, response, 1));
  return { ...split(diagnostics), findings: round.findings };
}

export function validateChain(contracts, responses) {
  const out = [];
  const revisions = [contracts].flat().filter(isObject)
    .sort((left, right) => (left.contract?.revision ?? 0) - (right.contract?.revision ?? 0));
  if (revisions.length === 0) return split([diagnostic('$', 'schema', 'a chain needs at least one contract')]);
  revisions.forEach((contract, index) => {
    const result = validateContract(contract);
    out.push(...prefixed(`contracts[${index}]`, [...result.errors, ...result.warnings]));
  });
  if (out.some((entry) => entry.severity === 'error')) return split(out);

  revisions.forEach((contract, index) => {
    const path = `contracts[${index}]/contract`;
    if (contract.contract.revision !== index + 1) {
      out.push(diagnostic(`${path}/revision`, '§3', `revision ${contract.contract.revision} where ${index + 1} was expected; revisions are consecutive from 1`));
    }
    if (index === 0) return;
    const previous = revisions[index - 1].contract;
    if (contract.contract.id !== previous.id) out.push(diagnostic(`${path}/id`, '§3', `revision ${contract.contract.revision} carries the id ${contract.contract.id}, not ${previous.id}`));
    if (contract.contract.fingerprint === previous.fingerprint) {
      out.push(diagnostic(`${path}/fingerprint`, '§3', `revision ${contract.contract.revision} carries the fingerprint of revision ${previous.revision}; a revision changes the criteria`));
    }
  });

  const byFingerprint = new Map(revisions.map((contract) => [contract.contract.fingerprint, contract]));
  const extensionRounds = new Map();
  let latest = 0;
  (responses || []).forEach((response, index) => {
    const prefix = `rounds[${index}]`;
    const shape = responseDiagnostics(response);
    if (shape.length > 0) { out.push(...prefixed(prefix, shape)); return; }
    const contract = byFingerprint.get(response.gate.version);
    if (!contract) {
      out.push(diagnostic(`${prefix}/gate/version`, '§8',
        `round ${index + 1} names ${response.gate.version ?? 'no fingerprint'}, which is no revision of this contract; the brief is stale or unbound`));
      return;
    }
    const revision = contract.contract.revision;
    if (revision < latest) {
      out.push(diagnostic(`${prefix}/gate/version`, '§8', `round ${index + 1} is judged against revision ${revision} after a round against revision ${latest}; the brief is stale`));
    }
    latest = Math.max(latest, revision);
    const round = roundDiagnostics(contract, response);
    out.push(...prefixed(prefix, round.diagnostics));
    if (round.extension) {
      const count = (extensionRounds.get(revision) ?? 0) + 1;
      extensionRounds.set(revision, count);
      out.push(...prefixed(prefix, budgetDiagnostics(contract, response, count)));
    }
  });
  return split(out);
}
