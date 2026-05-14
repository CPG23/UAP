const GITHUB_API = 'https://api.github.com';
const REPO_OWNER = 'CPG23';
const REPO_NAME = 'UAP';
const WORKFLOW_FILE = 'daily-scan.yml';
const DEFAULT_ALLOWED_ORIGIN = 'https://cpg23.github.io';
const MIN_SCAN_INTERVAL_SECONDS = 180;

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: corsHeaders(origin, { 'Content-Type': 'application/json; charset=utf-8' })
  });
}

function corsHeaders(origin, extra) {
  return Object.assign({
    'Access-Control-Allow-Origin': origin || DEFAULT_ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-UAP-Scan-Pin',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store'
  }, extra || {});
}

function allowedOrigin(request, env) {
  const requestOrigin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (allowed.includes(requestOrigin)) return requestOrigin;
  return allowed[0] || DEFAULT_ALLOWED_ORIGIN;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch (err) {
    return {};
  }
}

async function requirePin(request, env) {
  if (!env.SCAN_PIN) return { ok: false, status: 503, message: 'Scan-PIN ist im Worker noch nicht eingerichtet.' };
  const body = request.method === 'POST' ? await readJson(request) : {};
  const supplied = request.headers.get('X-UAP-Scan-Pin') || body.pin || '';
  if (String(supplied) !== String(env.SCAN_PIN)) {
    return { ok: false, status: 401, message: 'Die Scan-PIN stimmt nicht.' };
  }
  return { ok: true };
}

async function githubFetch(path, env, init) {
  if (!env.GITHUB_TOKEN) {
    return { ok: false, status: 503, data: { message: 'GitHub-Token ist im Worker noch nicht eingerichtet.' } };
  }
  const response = await fetch(`${GITHUB_API}${path}`, Object.assign({
    headers: {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'UAP-News-Manual-Scan'
    }
  }, init || {}));

  if (response.status === 204) return { ok: true, status: response.status, data: null };
  let data = null;
  try {
    data = await response.json();
  } catch (err) {
    data = { message: await response.text() };
  }
  return { ok: response.ok, status: response.status, data };
}

async function rateLimit(origin) {
  const key = new Request(`https://uap-news.internal/scan-lock/${encodeURIComponent(origin || 'global')}`);
  const cache = caches.default;
  const existing = await cache.match(key);
  if (existing) return false;
  await cache.put(key, new Response('locked', {
    headers: { 'Cache-Control': `max-age=${MIN_SCAN_INTERVAL_SECONDS}` }
  }));
  return true;
}

async function triggerScan(env) {
  return githubFetch(`/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/dispatches`, env, {
    method: 'POST',
    body: JSON.stringify({ ref: 'main' })
  });
}

async function latestRun(env, since) {
  const result = await githubFetch(`/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/runs?branch=main&event=workflow_dispatch&per_page=10`, env);
  if (!result.ok || !since || !result.data || !Array.isArray(result.data.workflow_runs)) return result;

  const minTime = Date.parse(since);
  if (!Number.isFinite(minTime)) return result;

  result.data.workflow_runs = result.data.workflow_runs.filter((run) => {
    const created = Date.parse(run.created_at || run.run_started_at || '');
    return Number.isFinite(created) && created >= minTime - 30000;
  });
  return result;
}

function normalizeRun(run) {
  if (!run) return null;
  return {
    id: run.id,
    number: run.run_number,
    status: run.status,
    conclusion: run.conclusion,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    startedAt: run.run_started_at,
    url: run.html_url
  };
}

async function handleScan(request, env, origin) {
  const pin = await requirePin(request, env);
  if (!pin.ok) return json({ ok: false, message: pin.message }, pin.status, origin);

  const allowed = await rateLimit(origin);
  if (!allowed) {
    return json({ ok: false, message: 'Ein Scan wurde gerade erst gestartet. Bitte kurz warten.' }, 429, origin);
  }

  const startedAt = new Date().toISOString();
  const dispatch = await triggerScan(env);
  if (!dispatch.ok) {
    return json({ ok: false, message: dispatch.data && dispatch.data.message ? dispatch.data.message : 'GitHub konnte den Scan nicht starten.' }, dispatch.status, origin);
  }

  const run = await latestRun(env, startedAt);
  const latest = run.ok && run.data && run.data.workflow_runs ? normalizeRun(run.data.workflow_runs[0]) : null;
  return json({ ok: true, message: 'Scan gestartet.', startedAt, run: latest }, 202, origin);
}

async function handleStatus(request, env, origin) {
  const pin = await requirePin(request, env);
  if (!pin.ok) return json({ ok: false, message: pin.message }, pin.status, origin);

  const url = new URL(request.url);
  const run = await latestRun(env, url.searchParams.get('since'));
  if (!run.ok) {
    return json({ ok: false, message: run.data && run.data.message ? run.data.message : 'GitHub-Status konnte nicht gelesen werden.' }, run.status, origin);
  }

  const latest = run.data && run.data.workflow_runs ? normalizeRun(run.data.workflow_runs[0]) : null;
  return json({ ok: true, run: latest }, 200, origin);
}

export default {
  async fetch(request, env) {
    const origin = allowedOrigin(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });

    const url = new URL(request.url);
    if (url.pathname === '/scan' && request.method === 'POST') return handleScan(request, env, origin);
    if (url.pathname === '/status' && request.method === 'GET') return handleStatus(request, env, origin);

    return json({ ok: false, message: 'Nicht gefunden.' }, 404, origin);
  }
};
