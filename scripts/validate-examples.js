#!/usr/bin/env node
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { validateContract, validateChain } from '../packages/validator/index.js';

const usage = 'usage: validate-examples.js [contract.json ...] [--chain dir ...]';
const args = process.argv.slice(2);
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const chainFiles = (dir) => readdirSync(dir).filter((name) => name.endsWith('.json')).sort().map((name) => join(dir, name));
const isContract = (object) => Object.hasOwn(object, 'aac');

export function readChain(dir) {
  const objects = chainFiles(dir).map(read);
  return { contracts: objects.filter(isContract), responses: objects.filter((object) => !isContract(object)) };
}

const targets = [];
if (args.length === 0) {
  readdirSync('examples').filter((name) => name.endsWith('.json')).forEach((name) => targets.push({ file: join('examples', name) }));
  readdirSync('examples/chains').forEach((dir) => targets.push({ chain: join('examples/chains', dir) }));
} else {
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--chain') targets.push({ chain: args[++index] });
    else if (args[index].startsWith('-')) { console.error(usage); process.exit(2); }
    else if (statSync(args[index]).isDirectory()) targets.push({ chain: args[index] });
    else targets.push({ file: args[index] });
  }
}

let failed = 0;
for (const target of targets) {
  const { errors, warnings } = target.chain
    ? (({ contracts, responses }) => validateChain(contracts, responses))(readChain(target.chain))
    : validateContract(read(target.file));
  const name = target.chain || target.file;
  if (errors.length === 0) console.log(`ok    ${name}`);
  else {
    failed += 1;
    console.log(`FAIL  ${name}`);
    errors.forEach((error) => console.log(`      ${error.rule} ${error.path}: ${error.message}`));
  }
  warnings.forEach((warning) => console.log(`      warn ${warning.rule} ${warning.path}: ${warning.message}`));
}
console.log(`${targets.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
