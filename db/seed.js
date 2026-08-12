// 从 CSV 导入词典数据到 MySQL
// 用法: node db/seed.js [csv路径] [--reset]
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

function parseCSVLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = false; }
      } else { cur += ch; }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur); cur = '';
    } else if (ch !== '\r') {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

async function main() {
  const file = process.argv[2] || path.join(__dirname, 'sample.csv');
  const reset = process.argv.includes('--reset');

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'dictionary',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) { console.error('CSV 为空'); process.exit(1); }

  const header = parseCSVLine(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map((l) => parseCSVLine(l));

  if (reset) {
    await conn.query('TRUNCATE TABLE entries');
    console.log('已清空 entries 表');
  }

  const sql = 'INSERT INTO entries (word, traditional, pinyin, definition, source) VALUES ?';
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH).map((r) => {
      const o = {};
      header.forEach((h, idx) => { o[h] = (r[idx] || '').trim(); });
      return [o.word, o.traditional || '', o.pinyin || '', o.definition || '', o.source || 'csv'];
    });
    const [result] = await conn.query(sql, [batch]);
    inserted += result.affectedRows;
  }
  console.log('导入完成: ' + inserted + ' 条');
  await conn.end();
}

main().catch((err) => {
  console.error('导入失败:', err.message);
  process.exit(1);
});
