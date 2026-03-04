const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const dataDir = path.join(rootDir, 'data');
const reportFile = path.join(rootDir, 'reports', 'website-audit.md');
const complaintsFile = path.join(dataDir, 'fish-complaints.json');

function loadLocalEnv() {
  const envPath = path.join(rootDir, '.env');
  if (!fs.existsSync(envPath)) return;

  const raw = fs.readFileSync(envPath, 'utf8');
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const idx = trimmed.indexOf('=');
    if (idx <= 0) return;

    const key = trimmed.slice(0, idx).trim();
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) return;
    if (Object.prototype.hasOwnProperty.call(process.env, key)) return;

    process.env[key] = trimmed.slice(idx + 1).trim();
  });
}

function collectFindings() {
  const findings = [];
  const adminKey = String(process.env.ADMIN_KEY || '').trim();

  if (!adminKey || adminKey === 'change-this-admin-key') {
    findings.push({
      severity: 'high',
      issue: 'ADMIN_KEY is missing or using default value.',
      fix: 'Set a strong ADMIN_KEY in .env before deployment.'
    });
  }

  if (String(process.env.NODE_ENV || 'development') !== 'production') {
    findings.push({
      severity: 'medium',
      issue: 'NODE_ENV is not production.',
      fix: 'Set NODE_ENV=production in live environment.'
    });
  }

  if (process.env.TRUST_PROXY !== '1') {
    findings.push({
      severity: 'medium',
      issue: 'TRUST_PROXY is not enabled.',
      fix: 'Set TRUST_PROXY=1 when running behind reverse proxy.'
    });
  }

  if (!fs.existsSync(path.join(publicDir, 'index.html'))) {
    findings.push({
      severity: 'high',
      issue: 'public/index.html is missing.',
      fix: 'Ensure site entry file is deployed.'
    });
  }

  if (!fs.existsSync(path.join(publicDir, 'styles.css'))) {
    findings.push({
      severity: 'high',
      issue: 'public/styles.css is missing.',
      fix: 'Ensure stylesheet is deployed.'
    });
  }

  if (!fs.existsSync(complaintsFile)) {
    findings.push({
      severity: 'low',
      issue: 'fish-complaints.json not yet initialized.',
      fix: 'Create the file with [] or submit one complaint from UI.'
    });
  }

  return findings;
}

function toMarkdown(findings) {
  const createdAt = new Date().toISOString();
  const lines = [
    '# Website Audit Report',
    '',
    `Generated at: ${createdAt}`,
    '',
    '## Summary',
    `- Total findings: ${findings.length}`,
    `- High: ${findings.filter((x) => x.severity === 'high').length}`,
    `- Medium: ${findings.filter((x) => x.severity === 'medium').length}`,
    `- Low: ${findings.filter((x) => x.severity === 'low').length}`,
    ''
  ];

  if (!findings.length) {
    lines.push('## Findings', '', '- No critical issues found.');
    return lines.join('\n');
  }

  lines.push('## Findings', '');
  findings.forEach((item, index) => {
    lines.push(`${index + 1}. [${item.severity.toUpperCase()}] ${item.issue}`);
    lines.push(`   - Fix: ${item.fix}`);
  });

  lines.push('', '## Protections Included', '', '- Security headers', '- API rate limiting', '- Complaint input validation', '- Admin gate for complaint listing');
  return lines.join('\n');
}

async function main() {
  loadLocalEnv();
  await fsPromises.mkdir(path.dirname(reportFile), { recursive: true });

  const findings = collectFindings();
  const markdown = toMarkdown(findings);

  await fsPromises.writeFile(reportFile, markdown);
  console.log(`Audit report generated: ${reportFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
