// GitTRACE landing page server.
// Deliberately tiny: no startup work beyond binding the port, so Render cold
// starts are as fast as they can be.
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');

// Lightweight health endpoint for uptime pingers (UptimeRobot, cron-job.org, …)
// and for Render's own health checks. Does no work, allocates nothing.
app.get('/healthz', (req, res) => {
  res.type('text/plain').send('ok');
});

// Serve only the landing page, the why page, the install guide, and the
// assets folder, never the rest of the repo.
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Codegraph figures and optional modules shown on the landing page. Missing
// asset files must 404 (not redirect to the HTML page), otherwise a script tag
// pointing at an absent module would try to execute the landing page as JS.
app.use('/assets', express.static(path.join(__dirname, 'assets'), { maxAge: '1d' }));
app.use('/assets', (req, res) => {
  res.status(404).type('text/plain').send('not found');
});

app.get(['/why', '/why.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'why.html'));
});

app.get(['/install', '/install.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'install.html'));
});

app.get(['/vision', '/vision.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'vision.html'));
});

// Anything else goes home.
app.use((req, res) => {
  res.redirect('/');
});

app.listen(PORT, () => {
  console.log(`GitTRACE site → http://localhost:${PORT}`);
});

// ── Render free-tier keep-alive ──────────────────────────────────────────────
// Render's free tier spins instances down after ~15 minutes without traffic;
// the next visitor then eats a slow cold start. While the instance is awake,
// pinging our own public URL every 10 minutes resets that idle timer.
//
// Guarded by env vars so it never runs locally:
//   - RENDER_EXTERNAL_URL is set automatically by Render (the public URL).
//   - Set KEEP_ALIVE=0 to opt out (e.g. on a paid instance where it's moot).
//
// Limitation: a self-ping only works while the process is alive. It prevents
// spin-down but cannot wake an instance that is already asleep. The robust fix
// is an EXTERNAL pinger hitting /healthz every ~10 minutes (UptimeRobot or
// cron-job.org, both free) or a paid Render instance. See README.md.
const KEEP_ALIVE_URL = process.env.KEEP_ALIVE_URL || process.env.RENDER_EXTERNAL_URL;
if (KEEP_ALIVE_URL && process.env.KEEP_ALIVE !== '0') {
  const INTERVAL_MS = 10 * 60 * 1000;
  setInterval(() => {
    fetch(`${KEEP_ALIVE_URL.replace(/\/+$/, '')}/healthz`)
      .catch((err) => console.warn(`keep-alive ping failed: ${err.message}`));
  }, INTERVAL_MS).unref();
  console.log(`keep-alive: pinging ${KEEP_ALIVE_URL}/healthz every ${INTERVAL_MS / 60000} min`);
}
