const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
const scans = new Map();

function isValidGitHubUrl(url) {
  return /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+/i.test(url.replace(/\/+$/, ''));
}

function detectLanguage(repoDir) {
  const langMap = {
    javascript: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'],
    python: ['.py'],
    java: ['.java'],
    csharp: ['.cs'],
    go: ['.go'],
    ruby: ['.rb'],
    cpp: ['.cpp', '.c', '.cc', '.h', '.hpp'],
    swift: ['.swift']
  };
  const counts = {};
  function walk(dir, depth) {
    if (depth > 8) return;
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'vendor' || entry.name === '__pycache__') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, depth + 1);
        else {
          const ext = path.extname(entry.name).toLowerCase();
          for (const [lang, exts] of Object.entries(langMap)) {
            if (exts.includes(ext)) counts[lang] = (counts[lang] || 0) + 1;
          }
        }
      }
    } catch (_) {}
  }
  walk(repoDir, 0);
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted.length > 0 ? sorted[0][0] : 'javascript';
}

function execAsync(cmd, opts = {}) {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: 600000, maxBuffer: 50 * 1024 * 1024, ...opts }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout);
    });
  });
}

function parseSarif(sarifPath) {
  const raw = JSON.parse(fs.readFileSync(sarifPath, 'utf8'));
  const run = raw.runs && raw.runs[0];
  if (!run) return { findings: [], summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0 } };

  const rules = {};
  if (run.tool?.driver?.rules) {
    for (const rule of run.tool.driver.rules) {
      rules[rule.id] = {
        name: rule.shortDescription?.text || rule.name || rule.id,
        description: rule.fullDescription?.text || '',
        severity: parseFloat(rule.properties?.['security-severity'] || '0'),
        tags: rule.properties?.tags || []
      };
    }
  }

  const findings = (run.results || []).map(r => {
    const rule = rules[r.ruleId] || {};
    const loc = r.locations?.[0]?.physicalLocation;
    const secSev = rule.severity || 0;
    let severity = 'low';
    if (secSev >= 9) severity = 'critical';
    else if (secSev >= 7) severity = 'high';
    else if (secSev >= 4) severity = 'medium';
    else if (r.level === 'error') severity = 'high';
    else if (r.level === 'warning') severity = 'medium';

    return {
      ruleId: r.ruleId,
      name: rule.name || r.ruleId,
      description: rule.description,
      message: r.message?.text || '',
      severity,
      securitySeverity: secSev,
      file: loc?.artifactLocation?.uri || '',
      line: loc?.region?.startLine || 0,
      column: loc?.region?.startColumn || 0
    };
  });

  const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  findings.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);

  return {
    findings,
    summary: {
      total: findings.length,
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length
    }
  };
}

app.post('/api/scan', (req, res) => {
  const rawUrl = (req.body.repoUrl || '').trim();
  if (!rawUrl || !isValidGitHubUrl(rawUrl)) {
    return res.status(400).json({ error: 'Invalid GitHub URL. Use format: https://github.com/owner/repo' });
  }
  const scanId = crypto.randomBytes(8).toString('hex');
  const repoUrl = rawUrl.replace(/\/+$/, '').replace(/\.git$/, '');
  const repoName = repoUrl.replace('https://github.com/', '');
  scans.set(scanId, { status: 'cloning', repoUrl, repoName, startedAt: new Date().toISOString() });
  runScan(scanId, repoUrl);
  res.json({ scanId });
});

app.get('/api/scan/:id', (req, res) => {
  const scan = scans.get(req.params.id);
  if (!scan) return res.status(404).json({ error: 'Scan not found' });
  res.json(scan);
});

async function runScan(scanId, repoUrl) {
  const tmpDir = path.join(os.tmpdir(), `epsilon-${scanId}`);
  const repoDir = path.join(tmpDir, 'repo');
  const dbDir = path.join(tmpDir, 'db');
  const resultsFile = path.join(tmpDir, 'results.sarif');

  function updateStatus(fields) {
    scans.set(scanId, { ...scans.get(scanId), ...fields });
  }

  try {
    fs.mkdirSync(tmpDir, { recursive: true });

    updateStatus({ status: 'cloning', step: 'Cloning repository...' });
    await execAsync(`git clone --depth 1 "${repoUrl}" "${repoDir}"`);

    updateStatus({ status: 'detecting', step: 'Detecting language...' });
    const lang = detectLanguage(repoDir);
    updateStatus({ language: lang });

    updateStatus({ status: 'creating_db', step: 'Building analysis database...' });
    await execAsync(`codeql database create "${dbDir}" --language=${lang} --source-root="${repoDir}" --overwrite`);

    updateStatus({ status: 'analyzing', step: 'Running security analysis...' });
    const queryPack = `codeql/${lang}-queries:codeql-suites/${lang}-security-extended.qls`;
    await execAsync(`codeql database analyze "${dbDir}" --format=sarif-latest --output="${resultsFile}" ${queryPack}`);

    updateStatus({ status: 'parsing', step: 'Generating report...' });
    const results = parseSarif(resultsFile);

    updateStatus({ status: 'complete', step: 'Done', results, completedAt: new Date().toISOString() });
  } catch (err) {
    updateStatus({ status: 'error', step: 'Failed', error: err.message });
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
}

exec('codeql --version', (err, stdout) => {
  if (err) {
    console.warn('\n  ⚠  CodeQL CLI not found. Install with: brew install --cask codeql');
    console.warn('     Server will start but scans will fail until CodeQL is installed.\n');
  } else {
    console.log('  ✓ CodeQL:', stdout.split('\n')[0]);
    const packs = ['codeql/javascript-queries', 'codeql/python-queries', 'codeql/java-queries', 'codeql/go-queries', 'codeql/ruby-queries'];
    exec('codeql pack download ' + packs.join(' '), { timeout: 120000 }, (e2, s2) => {
      if (!e2) console.log('  ✓ Query packs ready');
      else console.warn('  ⚠  Could not download query packs:', e2.message.split('\n')[0]);
    });
  }
});

app.listen(PORT, () => {
  console.log(`\n  εpsilonAI server → http://localhost:${PORT}\n`);
});
