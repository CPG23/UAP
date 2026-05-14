# UAP News Manual Scan Worker

This worker lets the public GitHub Pages app start the private GitHub Actions scan without exposing a GitHub token in the browser.

## Required secrets

Set these in Cloudflare Workers:

- `GITHUB_TOKEN`: Fine-grained GitHub token with access to `CPG23/UAP` and Actions write permission.
- `SCAN_PIN`: Short private PIN used by the app before it can start a scan.

## Optional variables

- `ALLOWED_ORIGIN`: Defaults to `https://cpg23.github.io`. Use a comma-separated list if another origin should be allowed.

## App connection

After deploying the Worker, set the Worker URL in `manual-scan-link-fix.js`:

```js
var SCAN_API_URL = 'https://your-worker.your-account.workers.dev';
```

The app will then show a `SCAN` button, ask for the PIN once, start the workflow, poll the run status, and compare `latest-news.json` before and after the scan to report whether new visible articles were found.

## Cloudflare commands

```bash
wrangler secret put GITHUB_TOKEN
wrangler secret put SCAN_PIN
wrangler deploy cloudflare-worker/manual-scan-worker.js
```

Do not put the GitHub token into any app file. It belongs only in the Worker secret store.
