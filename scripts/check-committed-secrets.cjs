/** Offline guard for high-confidence committed secrets, not a full secret audit. */
const { execFileSync } = require('node:child_process');
const { readFileSync, existsSync } = require('node:fs');
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' })
  .split('\0').filter((path) => path && existsSync(path));
const patterns = [
  ['private key', /^-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----$/m],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})\b/],
  ['Google client secret', /\bGOCSPX-[A-Za-z0-9_-]{20,}\b/],
  ['OpenAI key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{40,}\b/],
  ['AWS access key ID', /\bAKIA[0-9A-Z]{16}\b/],
];
let findings = 0;
for (const path of files) {
  if (/(^|\/)\.env(?:$|\.(?!example(?:$|\.)))/.test(path)) {
    console.error(`${path}: committed environment file; keep values in secure runtime settings`);
    findings++;
  }
  const contents = readFileSync(path);
  if (contents.includes(0)) continue;
  const text = contents.toString('utf8');
  for (const [label, pattern] of patterns) {
    if (pattern.test(text)) {
      // Never print the matching credential or surrounding source text.
      console.error(`${path}: possible ${label}; remove and investigate rotation`);
      findings++;
    }
  }
}
if (findings) process.exitCode = 1;
else console.log(`No high-confidence credential patterns found in ${files.length} versioned or unignored files. History and generic passwords remain outside this guard.`);
