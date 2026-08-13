// GET /api/search?q=hello&mode=exact|prefix|fuzzy&limit=20
import { connect } from '@tidbcloud/serverless';
import { buildUrl } from '../_lib';

const COLS = 'id, word, traditional, pinyin, phonetic, definition, pos, tag, exchange, audio, source';

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const q = (url.searchParams.get('q') || '').trim();
  const mode = ['exact', 'prefix', 'fuzzy'].includes(url.searchParams.get('mode'))
    ? url.searchParams.get('mode')
    : 'prefix';
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 20, 1), 100);

  const json = (body, status) => new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

  if (!q) return json({ error: '缺少查询词，请提供 q 参数' }, 400);

  let sql;
  let params;
  if (mode === 'exact') {
    sql = 'SELECT ' + COLS + ' FROM entries WHERE word = ? ORDER BY word LIMIT ?';
    params = [q, limit];
  } else if (mode === 'fuzzy') {
    sql = 'SELECT ' + COLS + ' FROM entries WHERE word LIKE ? OR phonetic LIKE ? OR definition LIKE ? ORDER BY word LIMIT ?';
    params = ['%' + q + '%', '%' + q + '%', '%' + q + '%', limit];
  } else {
    sql = 'SELECT ' + COLS + ' FROM entries WHERE word LIKE ? ORDER BY word LIMIT ?';
    params = [q + '%', limit];
  }

  try {
    const conn = connect({ url: buildUrl(context.env) });
    const rows = await conn.execute(sql, params);
    return json({ query: q, mode: mode, count: rows.length, results: rows });
  } catch (err) {
    console.error('search error:', err && err.message);
    return json({ error: '数据库查询失败', detail: err && err.message }, 500);
  }
}
