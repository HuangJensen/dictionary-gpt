// GET /health
import { connect } from '@tidbcloud/serverless';
import { buildUrl } from './_lib';

export async function onRequestGet(context) {
  const json = (body, status) => new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
  try {
    const conn = connect({ url: buildUrl(context.env) });
    await conn.execute('SELECT 1');
    return json({ status: 'ok', db: 'up' });
  } catch (err) {
    return json({ status: 'degraded', db: 'down', error: err && err.message }, 503);
  }
}
