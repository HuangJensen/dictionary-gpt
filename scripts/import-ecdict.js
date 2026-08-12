// 导入 ECDICT 英汉词典（约 76 万词条，MIT 协议）到 MySQL
// 用法: node scripts/import-ecdict.js [csv路径] [--reset]
// 数据来源: https://github.com/skywind3000/ECDICT
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mysql = require('mysql2/promise');

// 解析一行 CSV：支持引号内逗号、双引号转义，并去除行尾回车
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
  const file = process.argv[2] || path.join(__dirname, '..', 'data', 'ecdict.csv');
  const reset = process.argv.includes('--reset');
  if (!fs.existsSync(file)) { console.error('找不到文件: ' + file); process.exit(1); }

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'dictionary',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  if (reset) {
    await conn.query('TRUNCATE TABLE entries');
    console.log('已清空 entries 表');
  }

  const sql = 'INSERT INTO entries (word, traditional, pinyin, phonetic, definition, pos, tag, exchange, audio, source) VALUES ?';
  const BATCH = 1000;
  let batch = [];
  let total = 0;
  let skipped = 0;

  const rl = readline.createInterface({
    input: fs.createReadStream(file, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let first = true;
  for await (const line of rl) {
    if (first) { first = false; continue; } // 跳过表头
    if (!line.trim()) continue;
    const f = parseCSVLine(line);
    if (f.length < 4 || !f[0]) { skipped++; continue; }

    // 把字段内的 \n \t 转义字符还原为真实换行/制表符，便于展示
    const trans = (f[3] || '').replace(/\\n/g, '\n').replace(/\\t/g, '\t');
    const defEn = (f[2] || '').replace(/\\n/g, '\n').replace(/\\t/g, '\t');
    const definition = [trans, defEn].filter(Boolean).join('\n');

    batch.push([f[0], '', '', f[1] || '', definition, f[4] || '', f[7] || '', f[10] || '', f[12] || '', 'ECDICT']);
    if (batch.length >= BATCH) {
      const [r] = await conn.query(sql, [batch]);
      total += r.affectedRows;
      batch = [];
      if (total % 50000 < BATCH) console.log('已导入 ' + total + ' 条…');
    }
  }
  if (batch.length) {
    const [r] = await conn.query(sql, [batch]);
    total += r.affectedRows;
  }

  console.log('导入完成: 共 ' + total + ' 条，跳过 ' + skipped + ' 条');
  await conn.end();
}

main().catch((err) => {
  console.error('导入失败:', err.message);
  process.exit(1);
});
