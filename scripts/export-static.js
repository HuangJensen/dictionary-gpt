// 导出词典数据为按前两个字母分组的 gzip JSON（加速 GitHub Pages 静态搜索）
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function chunkOf(word) {
  const w = (word || '').trim().toLowerCase();
  const m2 = w.match(/^([a-z])([a-z])/);
  if (m2) return m2[1] + m2[2];
  const m1 = w.match(/^([a-z])/);
  if (m1) return m1[1] + '0'; // 单字母单词
  return '00'; // 数字/符号开头
}

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
  const groups = {};
  rows.forEach((r) => {
    const key = chunkOf(r.word);
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
  // 清空旧文件
  for (const f of fs.readdirSync(outDir)) {
    if (f.endsWith('.json.gz') || f === 'index.json') fs.unlinkSync(path.join(outDir, f));
  }
  let totalGz = 0;
  const meta = {};
  let max = 0, maxKey = '';
  for (const key of Object.keys(groups).sort()) {
    const gz = zlib.gzipSync(Buffer.from(JSON.stringify(groups[key]), 'utf8'), { level: 9 });
    fs.writeFileSync(path.join(outDir, key + '.json.gz'), gz);
    totalGz += gz.length;
    meta[key] = groups[key].length;
    if (gz.length > max) { max = gz.length; maxKey = key; }
  }
  fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(meta));
  console.log(`共 ${Object.keys(groups).length} 个分组, gzip 总 ${(totalGz/1024/1024).toFixed(1)}MB`);
  console.log(`最大分组 ${maxKey}: ${(max/1024).toFixed(0)}KB (${meta[maxKey]} 条)`);
  await conn.end();
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
