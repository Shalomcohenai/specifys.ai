#!/usr/bin/env node
/**
 * Living Brief full eval runner (Part 1 timeline + Part 2 fidelity).
 *
 * Usage:
 *   node backend/scripts/living-brief-eval.js
 *   node backend/scripts/living-brief-eval.js --ai --rounds=2
 */
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const extra = process.argv.slice(2);

function run(script) {
  console.log(`\n======== ${path.basename(script)} ========`);
  const res = spawnSync(process.execPath, [script, ...extra], {
    cwd: root,
    stdio: 'inherit',
    env: process.env
  });
  return res.status || 0;
}

const p1 = run(path.join(__dirname, 'living-brief-eval-part1.js'));
const p2 = run(path.join(__dirname, 'living-brief-eval-part2.js'));
const code = p1 || p2;
console.log(`\n======== summary ========`);
console.log(`Part 1 exit=${p1} · Part 2 exit=${p2}`);
process.exit(code);
