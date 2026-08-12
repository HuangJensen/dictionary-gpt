// ============================================================
// 在线词典查询服务：Node.js + Express + MySQL (mysql2)
// 低内存设计：仅依赖 express + mysql2 + dotenv，小连接池
// 部署：Render 免费版 / 任意 Node 平台，数据库用免费 MySQL/TiDB
// ============================================================
require('dotenv').config();

const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');

const PORT = Number(process.env.PORT || 3000);

// 小连接池：connectionLimit 控制并发连接数，显著降低内存占用
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'dictionary',
  charset: 'utf8mb4',
  connectionLimit: Number(process.env.DB_POOL_SIZE || 5),
  waitForConnections: true,
  queueLimit: 0,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

// 连接池出错不要拖垮进程
pool.on('error', (err) => {
  console.error('[db] pool error:', err.message);
});

const app = express();
app.disable('x-powered-by');
app.use(express.static(path.join(__dirname, 'public')));

// 跨域：前端可部署在 GitHub Pages / Vercel 等任意位置
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// 健康检查
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'up' });
  } catch (err) {
    res.status(503).json({ status: 'degraded', db: 'down', error: err.message });
  }
});

// 词典查询
// GET /api/search?q=hello&mode=prefix&limit=20
// mode: exact(精确) | prefix(前缀,默认) | fuzzy(模糊)
app.get('/api/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const mode = ['exact', 'prefix', 'fuzzy'].includes(req.query.mode) ? req.query.mode : 'prefix';
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);

  if (!q) {
    return res.status(400).json({ error: '缺少查询词，请提供 q 参数' });
  }

  const cols = 'id, word, traditional, pinyin, definition, source';
  let sql;
  let params;
  if (mode === 'exact') {
    sql = 'SELECT ' + cols + ' FROM entries WHERE word = ? ORDER BY word LIMIT ?';
    params = [q, limit];
  } else if (mode === 'fuzzy') {
    sql = 'SELECT ' + cols + ' FROM entries WHERE word LIKE ? OR pinyin LIKE ? OR definition LIKE ? ORDER BY word LIMIT ?';
    params = ['%' + q + '%', '%' + q + '%', '%' + q + '%', limit];
  } else {
    sql = 'SELECT ' + cols + ' FROM entries WHERE word LIKE ? ORDER BY word LIMIT ?';
    params = [q + '%', limit];
  }

  try {
    const [rows] = await pool.query(sql, params);
    res.json({ query: q, mode: mode, count: rows.length, results: rows });
  } catch (err) {
    console.error('[search]', err.message);
    res.status(500).json({ error: '数据库查询失败', detail: err.message });
  }
});

// 404 与错误处理
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('Dictionary API running at http://localhost:' + PORT);
  console.log('Health check: http://localhost:' + PORT + '/health');
});
