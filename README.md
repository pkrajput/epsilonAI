# GitTRACE landing page

Public marketing site for **GitTRACE**. The product is git-like, local-first
version control with reasoning and decision recording, branch merging, and
end-to-end encrypted team sync. The product source lives in `TRACER/week5`
(internal name). Everything user-facing on the site says GitTRACE.

**Hosting:** `index.html` plus the codegraph figures in `assets/`, served by
`server.js` (Express) on Render.

## Local dev

```bash
npm install
npm start          # → http://localhost:3000
```

## Structure

```
index.html          The landing page (inline HTML/CSS/JS/SVG)
why.html            Why GitTRACE exists, served at /why
vision.html         The autonomous-company vision story, served at /vision
install.html        The install guide, served at /install (linked from the nav)
assets/             Site modules (collab graph, vision story) and figures
server.js           Tiny Express server with /healthz and a keep-alive ping
package.json        Express only, no build step
firebase.json       Firebase project config (used by the product's sync backend)
firestore.rules     Firestore security rules
cloud-run/          Legacy scan service (not used by the landing page)
```

The animated decision map recreates a recorded session. The collaboration
demo types out a product manager and two agents working on one shared memory
graph, and drives the optional live graph module (`assets/collab-graph.js`,
`GitTraceCollabGraph.init/step`) when it is present. The two codegraph figures
in `assets/` are screenshots of the actual product panel (`codegraph-trace
panel`, code structure view in its graph and radial tree layouts) running on a
small demo shop repo.

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

4. **External pinger (GitHub Actions).** The in-app self-ping cannot wake an
   instance that has already spun down, for example after a deploy or a
   crash. `.github/workflows/keepalive.yml` pings `/healthz` from GitHub's
   side every 10 minutes and can wake a sleeping instance.

**One-time setup for the pinger:** add a repository variable `SITE_URL` with
the public site URL (GitHub repo -> Settings -> Secrets and variables ->
Actions -> Variables), e.g. `https://your-service.onrender.com`. Note that
GitHub pauses scheduled workflows after 60 days without repo activity, and
schedule ticks can be delayed a few minutes under load. If you want a
second belt-and-braces pinger, [UptimeRobot](https://uptimerobot.com) or
[cron-job.org](https://cron-job.org) hitting the same endpoint also works.
A paid Render instance never spins down and needs none of this.
