# epsilonAI

Security and efficiency assessments for AI-built applications.

## Quick Start

```bash
npm install
npm start
```

Server runs at `http://localhost:3000`.

## Project Structure

```
index.html   - Single-page frontend (self-contained HTML/CSS/JS)
server.js    - Express API server (handles scan requests)
package.json - Dependencies and scripts
```

## Scripts

| Command       | Description                          |
|---------------|--------------------------------------|
| `npm start`   | Start the production server          |
| `npm run dev` | Start the development server         |
| `npm run build` | No-op (no build step needed)       |

## Environment Variables

| Variable | Default | Description              |
|----------|---------|--------------------------|
| `PORT`   | `3000`  | Server port              |

## Deploying to Render

1. Push this repo to GitHub
2. Create a new **Web Service** on [render.com](https://render.com)
3. Connect your GitHub repo
4. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** `Node`
5. Deploy

Render auto-detects the `PORT` environment variable. No additional config needed for the web server.

**Note:** The security scan feature requires CodeQL CLI on the host. On Render's free tier, scans will return an error since CodeQL isn't pre-installed. For full scan functionality, deploy the backend to a custom Docker environment or Firebase Cloud Run (see below).

## Future: GoDaddy + Firebase

- **GoDaddy**: Host `index.html` as a static site, point API calls to Firebase
- **Firebase Cloud Run**: Runs scan logic in a Docker container with CodeQL, pay-per-invocation
- **Firestore**: Stores scan results persistently

## Tech Stack

- Node.js / Express
- Vanilla HTML, CSS, JavaScript (no frameworks)
- Instrument Sans + Satoshi + JetBrains Mono (Google Fonts / Fontshare)
