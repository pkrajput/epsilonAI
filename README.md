# GitTRACE landing page

Public marketing site for **GitTRACE**. The product is git-like, local-first
version control with reasoning and decision recording, branch merging, and
end-to-end encrypted team sync. The product source lives in `TRACER/week5`
(internal name). Everything user-facing on the site says GitTRACE.

**Hosting:** a single self-contained `index.html` served by `server.js`
(Express) on Render.

## Local dev

```bash
npm install
npm start          # → http://localhost:3000
```

## Structure

```
index.html          The landing page (inline HTML/CSS/JS/SVG, no assets)
install.html        The install guide, served at /install (linked from the nav)
server.js           Tiny Express server with /healthz and a keep-alive ping
package.json        Express only, no build step
firebase.json       Firebase project config (used by the product's sync backend)
firestore.rules     Firestore security rules
cloud-run/          Legacy scan service (not used by the landing page)
```

The animated graph on the page recreates the decision tree recorded in
`TRACER/week5/demo/game/artifacts`, and the terminal demo replays a real CLI
session (commands and output captured verbatim).

## Render cold starts

Render's free tier spins the instance down after about 15 minutes without
traffic, so the first visitor afterwards waits through a cold boot. Mitigations
in place:

1. **Fast boot.** `server.js` does nothing at startup except bind the port.
2. **`/healthz`.** A zero-work health endpoint for uptime pingers.
3. **In-app keep-alive.** When running on Render (detected via the
   `RENDER_EXTERNAL_URL` env var that Render sets automatically), the server
   pings its own `/healthz` every 10 minutes to reset the idle timer. Disable
   with `KEEP_ALIVE=0`. It never runs locally.

**Remaining manual step (recommended):** an in-app self-ping cannot wake an
instance that has already spun down, for example after a deploy or a crash.
For a fully robust fix, point a free external pinger at the health endpoint.
[UptimeRobot](https://uptimerobot.com) or [cron-job.org](https://cron-job.org)
hitting `https://<your-render-url>/healthz` every 10 minutes works. A paid
Render instance never spins down and needs none of this.
