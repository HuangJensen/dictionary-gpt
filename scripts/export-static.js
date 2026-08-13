// 导出词典数据为按首字母分组的 gzip JSON（供 GitHub Pages 静态部署）
// 用法: node scripts/export-static.js
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '123456',
    database: process.env.DB_NAME || 'dictionary',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  console.log('读取全部词条…');
  const [rows] = await conn.query(
    'SELECT word, traditional, pinyin, phonetic, definition, pos, tag, exchange, source FROM entries'
  );

  // 按首字母分组（a-z，其他归入 0）
  const groups = {};
  rows.forEach((r) => {
    const first = (r.word || '').trim().charAt(0).toLowerCase();
    const key = /^[a-z]$/.test(first) ? first : '0';
    if (!groups[key]) groups[key] = [];
    const e = { w: r.word };
    if (r.traditional) e.tr = r.traditional;
    if (r.pinyin) e.py = r.pinyin;
    if (r.phonetic) e.ph = r.phonetic;
    if (r.definition) e.d = r.definition;
    if (r.pos) e.p = r.pos;
    if (r.tag) e.t = r.tag;
    if (r.exchange) e.ex = r.exchange;
    if (r.source) e.s = r.source;
    groups[key].push(e);
  });

  const outDir = path.join(__dirname, '..', 'docs', 'static-data');
  fs.mkdirSync(outDir, { recursive: true });

  let totalRaw = 0;
  let totalGz = 0;
  const meta = {};
  for (const key of Object.keys(groups).sort()) {
    const arr = groups[key];
    const json = JSON.stringify(arr);
    const gz = zlib.gzipSync(Buffer.from(json, 'utf8'), { level: 9 });
    fs.writeFileSync(path.join(outDir, key + '.json.gz'), gz);
    totalRaw += json.length;
    totalGz += gz.length;
    meta[key] = arr.length;
    console.log(`${key}: ${arr.length} 条, gz=${(gz.length / 1024 / 1024).toFixed(2)}MB`);
  }
  fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(meta));
  console.log(`\n总计 ${rows.length} 条, 原始 ${(totalRaw / 1024 / 1024).toFixed(1)}MB, gzip ${(totalGz / 1024 / 1024).toFixed(1)}MB`);
  await conn.end();
}

main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
