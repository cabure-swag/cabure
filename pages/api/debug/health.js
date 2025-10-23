export default function handler(_req, res) {
  res.status(200).json({
    ok: true,
    service: 'caburee',
    now: new Date().toISOString(),
    env: process.env.NODE_ENV || 'unknown',
    commit: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || 'unknown',
    checks: { uptime: 'ok', api: 'ok' }
  });
}
