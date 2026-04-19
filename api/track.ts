/**
 * Lightweight tracking ingestion endpoint for Vercel Functions.
 * - Accepts client analytics events from /api/track
 * - Enriches with server-side metadata (ip/ua/host)
 * - Optionally forwards to an external sink (e.g. Alibaba Cloud endpoint)
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  const body = req.body || {};
  const token = req.headers['x-track-key'];
  const expectedToken = process.env.ANALYTICS_WRITE_KEY;

  if (expectedToken && token !== expectedToken) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return;
  }

  const event = {
    event: body.event || 'unknown',
    ts: typeof body.ts === 'number' ? body.ts : Date.now(),
    sessionId: body.sessionId || null,
    userId: body.userId || null,
    path: body.path || null,
    locale: body.locale || null,
    props: body.props || {},
    server: {
      receivedAt: Date.now(),
      ip:
        req.headers['x-real-ip']
        || req.headers['x-forwarded-for']
        || null,
      userAgent: req.headers['user-agent'] || null,
      host: req.headers['host'] || null,
      referer: req.headers['referer'] || null,
    },
  };

  // Always log once to Vercel runtime logs for quick debugging / fallback analysis.
  try {
    console.log('[track-event]', JSON.stringify(event));
  } catch {
    // ignore log serialization failure
  }

  // Optional forwarder: set ANALYTICS_WEBHOOK_URL to your ingestion endpoint.
  // Example: Alibaba Cloud Function/HTTP endpoint that writes to SLS/ClickHouse.
  const webhook = process.env.ANALYTICS_WEBHOOK_URL;
  if (webhook) {
    try {
      const r = await fetch(webhook, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(process.env.ANALYTICS_WEBHOOK_TOKEN
            ? { authorization: `Bearer ${process.env.ANALYTICS_WEBHOOK_TOKEN}` }
            : {}),
        },
        body: JSON.stringify(event),
      });

      if (!r.ok) {
        console.error('[track-forward-failed]', r.status, await r.text());
      }
    } catch (err) {
      console.error('[track-forward-error]', err);
    }
  }

  res.status(200).json({ ok: true });
}

