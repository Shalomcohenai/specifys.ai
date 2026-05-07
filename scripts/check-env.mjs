import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const SEARCH_TARGETS = ['assets', 'backend', 'pages', 'scripts', '_includes', '_layouts', '_config.yml'];
const ALLOWLIST_PATH = 'scripts/check-env.allow.txt';

function loadAllowlist() {
  if (!existsSync(ALLOWLIST_PATH)) return [];
  return readFileSync(ALLOWLIST_PATH, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

function runRg(pattern) {
  const args = ['--pcre2', '-n', '-H', pattern, ...SEARCH_TARGETS];
  return spawnSync('rg', args, { encoding: 'utf8' });
}

function isAllowed(line, allowlist) {
  return allowlist.some((entry) => line.includes(entry));
}

const checks = [
  {
    name: 'legacy ports in URLs/endpoints',
    pattern: '(https?://[^\\s\'"]*:(3000|3001|3002|5000|8080)\\b|localhost:(3000|3001|3002|5000|8080)\\b|127\\.0\\.0\\.1:(3000|3001|3002|5000|8080)\\b)'
  },
  {
    name: 'development URLs',
    pattern: '(localhost|127\\.0\\.0\\.1|render-dev\\.com|0\\.0\\.0\\.0)'
  },
  {
    name: 'hardcoded secrets/tokens',
    pattern: '(sk_live_[0-9A-Za-z]+|sk_test_[0-9A-Za-z]+|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z\\-_]{35}|xox[baprs]-[0-9A-Za-z-]+|(?i)(api[_-]?key|secret|password|token)\\s*[:=]\\s*[\'"][^\'"]{16,}[\'"])'
  }
];

const allowlist = loadAllowlist();
let failed = false;

for (const check of checks) {
  const result = runRg(check.pattern);
  const lines = `${result.stdout || ''}${result.stderr || ''}`
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !isAllowed(line, allowlist));

  if (lines.length > 0) {
    failed = true;
    console.error(`\n[check-env] Detected ${check.name}:`);
    lines.forEach((line) => console.error(`  ${line}`));
  }
}

if (failed) {
  console.error('\n[check-env] Failed. Fix or allowlist intentional matches in scripts/check-env.allow.txt');
  process.exit(1);
}

console.log('[check-env] Passed.');
