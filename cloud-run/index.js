const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const admin = require('firebase-admin');

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || 'epsilonai-29b8c';
admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

const app = express();
app.use(express.json());
app.use(cors({
  origin: [
    'https://www.epsilonai.eu',
    'https://epsilonai.eu',
    'http://localhost:3000'
  ],
  methods: ['GET', 'POST']
}));

const PORT = process.env.PORT || 8080;

function parseGitHubRepoUrl(input) {
  let raw = (input || '').trim();
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  const u = new URL(raw);
  if (u.hostname.toLowerCase() !== 'github.com') throw new Error('Only GitHub URLs are supported.');
  const parts = u.pathname.split('/').filter(Boolean);
  if (parts.length < 2) throw new Error('Invalid GitHub URL. Use format: https://github.com/owner/repo');
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, '');
  if (!owner || !repo) throw new Error('Invalid GitHub URL. Use format: https://github.com/owner/repo');
  return {
    owner,
    repo,
    repoName: `${owner}/${repo}`,
    repoUrl: `https://github.com/${owner}/${repo}`
  };
}

function isValidGitHubUrl(url) {
  try {
    parseGitHubRepoUrl(url);
    return true;
  } catch (_) {
    return false;
  }
}

function friendlyScanError(message) {
  const msg = String(message || '');
  if (/could not read Username for 'https:\/\/github\.com'|terminal prompts disabled/i.test(msg)) {
    return 'This repository appears to be private or requires authentication. Only public GitHub repositories are supported right now.';
  }
  if (/Repository not found|not found/i.test(msg)) {
    return 'Repository not found. Please check the URL and make sure the repository is public.';
  }
  if (/rate limit/i.test(msg)) {
    return 'GitHub rate limit reached. Please try again in a few minutes.';
  }
  return msg.split('\n').slice(0, 6).join(' ').trim() || 'Scan failed. Please try again.';
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
    const baseEnv = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
    const execOpts = { timeout: 600000, maxBuffer: 50 * 1024 * 1024, env: baseEnv, ...opts };
    if (opts.env) execOpts.env = { ...baseEnv, ...opts.env };
    exec(cmd, execOpts, (err, stdout, stderr) => {
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
  const parsed = parseGitHubRepoUrl(rawUrl);

  const scanData = {
    status: 'cloning',
    step: 'Cloning repository...',
    repoUrl: parsed.repoUrl,
    repoName: parsed.repoName,
    owner: parsed.owner,
    repo: parsed.repo,
    startedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  db.collection('scans').doc(scanId).set(scanData)
    .then(() => {
      runScan(scanId, parsed);
      res.json({ scanId });
    })
    .catch(err => {
      console.error('Firestore write failed:', err && (err.stack || err.message || err));
      res.status(500).json({ error: err.message });
    });
});

app.get('/api/scan/:id', async (req, res) => {
  try {
    const doc = await db.collection('scans').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Scan not found' });
    const data = doc.data() || {};
    for (const k of ['startedAt', 'completedAt']) {
      const v = data[k];
      if (v && typeof v.toDate === 'function') data[k] = v.toDate().toISOString();
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function runScan(scanId, parsed) {
  const repoUrl = parsed.repoUrl;
  const tmpDir = path.join(os.tmpdir(), `epsilon-${scanId}`);
  const repoDir = path.join(tmpDir, 'repo');
  const dbDir = path.join(tmpDir, 'db');
  const resultsFile = path.join(tmpDir, 'results.sarif');
  const docRef = db.collection('scans').doc(scanId);

  async function updateStatus(fields) {
    try { await docRef.update(fields); } catch (_) {}
  }

  try {
    fs.mkdirSync(tmpDir, { recursive: true });

    await updateStatus({ status: 'cloning', step: 'Checking repository access...' });
    try {
      const r = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`, {
        headers: {
          'User-Agent': 'epsilonai-scan-service',
          'Accept': 'application/vnd.github+json'
        }
      });
      if (r.status === 200) {
        const j = await r.json();
        if (j && j.private) throw new Error('Private repositories are not supported.');
      } else if (r.status === 404) {
        throw new Error('Repository not found.');
      } else if (r.status === 403) {
        // Rate limited or blocked. We'll still attempt clone; git will fail cleanly if needed.
      }
    } catch (e) {
      throw new Error(friendlyScanError(e.message));
    }

    await updateStatus({ status: 'cloning', step: 'Cloning repository...' });
    await execAsync(`git clone --depth 1 "${repoUrl}" "${repoDir}"`);

    await updateStatus({ status: 'detecting', step: 'Detecting language...' });
    const lang = detectLanguage(repoDir);
    await updateStatus({ language: lang });

    await updateStatus({ status: 'creating_db', step: 'Building analysis database...' });
    await execAsync(`codeql database create "${dbDir}" --language=${lang} --source-root="${repoDir}" --overwrite`);

    await updateStatus({ status: 'analyzing', step: 'Running security analysis...' });
    const queryPack = `codeql/${lang}-queries:codeql-suites/${lang}-security-extended.qls`;
    await execAsync(`codeql database analyze "${dbDir}" --format=sarif-latest --output="${resultsFile}" ${queryPack}`);

    await updateStatus({ status: 'parsing', step: 'Generating report...' });
    const results = parseSarif(resultsFile);

    await updateStatus({
      status: 'complete',
      step: 'Done',
      results,
      completedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    await updateStatus({ status: 'error', step: 'Failed', error: friendlyScanError(err.message) });
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
}

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Scan service running on port ${PORT}`);
});
