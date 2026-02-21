# epsilonAI

Security and efficiency assessments for AI-built applications.

**Live:** [www.epsilonai.eu](https://www.epsilonai.eu)

## Quick Start (local dev)

```bash
npm install
npm start
```

Server runs at `http://localhost:3000`.

## Project Structure

```
index.html              Frontend (self-contained HTML/CSS/JS)
server.js               Local dev server (Express + scan logic)
package.json            Dependencies for Render
firebase.json           Firebase project config
firestore.rules         Firestore security rules
cloud-run/
  index.js              Cloud Run scan service (Express + Firestore)
  Dockerfile            Container with Node + CodeQL CLI
  deploy.sh             One-command deploy to Cloud Run
  package.json          Service dependencies
```

## Architecture

```
[Browser]  www.epsilonai.eu
    |
    |  Static site (Render + GoDaddy DNS)
    |
    |  POST /api/scan  →  [Cloud Run]  scan-service
    |  GET  /api/scan/:id              (scales to zero)
    |                                       |
    |                     Clone repo → CodeQL scan → Parse SARIF
    |                                       |
    |                                  [Firestore]
    |                                  scans/{id}
    |  ← poll status / results              |
```

## Deploying the Scan Backend (Firebase Cloud Run)

### Prerequisites

```bash
# Install Google Cloud CLI if you don't have it
brew install google-cloud-sdk

# Login and set project
gcloud auth login
gcloud config set project epsilonai-29b8c

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  firestore.googleapis.com \
  artifactregistry.googleapis.com
```

### Create Firestore Database (one time)

```bash
gcloud firestore databases create --location=us-central1
```

### Deploy Firestore Rules

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules --project epsilonai-29b8c
```

### Deploy Cloud Run

```bash
cd cloud-run
./deploy.sh
```

This builds the Docker image (Node + CodeQL), pushes it, and deploys to Cloud Run. It prints the service URL when done.

### Connect Frontend to Cloud Run

After deploy, update the one line in `index.html`:

```js
var SCAN_API = 'https://scan-service-XXXXX-uc.a.run.app';
```

Push to GitHub, Render auto-deploys, done.

## Cost

| Component | Cost |
|-----------|------|
| Render (frontend) | Free tier or $7/mo |
| GoDaddy (domain) | ~$12/yr |
| Cloud Run | ~$0.01 per scan (scales to zero) |
| Firestore | Negligible (free tier covers thousands of scans) |

**Zero idle cost.** You only pay when someone actually scans a repo.

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start local dev server |
| `npm run dev` | Same as start |
| `cd cloud-run && ./deploy.sh` | Deploy scan backend |

## Tech Stack

- Node.js / Express
- CodeQL CLI (security analysis engine)
- Firebase Cloud Run + Firestore
- Render (frontend hosting)
- GoDaddy (DNS)
- Vanilla HTML, CSS, JavaScript
