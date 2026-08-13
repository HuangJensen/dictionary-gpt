// 导出词典：2字母分组 + 大分组再按3字母拆分（加速）
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const RESERVED = new Set(['con','prn','aux','nul','com1','com2','com3','com4','com5','com6','com7','com8','com9','lpt1','lpt2','lpt3','lpt4','lpt5','lpt6','lpt7','lpt8','lpt9']);
function fname(key) { return RESERVED.has(key) ? key + '_' : key; }
const THRESHOLD = 220 * 1024; // 超过 220KB 的 2 字母组再拆成 3 字母

function chunk2(word) {
  const w = (word || '').trim().toLowerCase();
  const m2 = w.match(/^([a-z])([a-z])/);
  if (m2) return m2[1] + m2[2];
  const m1 = w.match(/^([a-z])/);
  if (m1) return m1[1] + '0';
  return '00';
}
function chunk3(word) {
  const w = (word || '').trim().toLowerCase();
  const m = w.match(/^([a-z])([a-z])([a-z])/);
  return m ? m[1] + m[2] + m[3] : null;
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
  const toEntry = (r) => {
    const e = { w: r.word };
    if (r.traditional) e.tr = r.traditional;
    if (r.pinyin) e.py = r.pinyin;
    if (r.phonetic) e.ph = r.phonetic;
    if (r.definition) e.d = r.definition;
    if (r.pos) e.p = r.pos;
    if (r.tag) e.t = r.tag;
    if (r.exchange) e.ex = r.exchange;
    if (r.source) e.s = r.source;
    return e;
  };

  // 第一遍：按 2 字母分组
  const g2 = {};
  rows.forEach((r) => {
    const key = chunk2(r.word);
    if (!g2[key]) g2[key] = [];
    g2[key].push(toEntry(r));
  });

  const outDir = path.join(__dirname, '..', 'docs', 'static-data');
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of fs.readdirSync(outDir)) {
    if (f.endsWith('.json.gz') || f === 'index.json') fs.unlinkSync(path.join(outDir, f));
  }

  const allKeys = {};
  let bigCount = 0;
  // 写 2 字母文件，记录大组
  for (const key of Object.keys(g2).sort()) {
    const gz = zlib.gzipSync(Buffer.from(JSON.stringify(g2[key]), 'utf8'), { level: 9 });
    fs.writeFileSync(path.join(outDir, key + '.json.gz'), gz);
    allKeys[key] = fname(key);
    if (gz.length > THRESHOLD) {
      // 大组：再按 3 字母拆（单词不足3个字母的留在2字母文件里）
      const g3 = {};
      for (const e of g2[key]) {
        const k3 = chunk3(e.w);
        if (k3) {
          if (!g3[k3]) g3[k3] = [];
          g3[k3].push(e);
        }
      }
      for (const k3 of Object.keys(g3)) {
        const gz3 = zlib.gzipSync(Buffer.from(JSON.stringify(g3[k3]), 'utf8'), { level: 9 });
        fs.writeFileSync(path.join(outDir, fname(k3) + '.json.gz'), gz3);
        allKeys[k3] = fname(k3);
      }
      bigCount++;
      console.log(`拆分了 ${key}: ${Object.keys(g3).length} 个子组`);
    }
  }
  fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(allKeys));
  fs.writeFileSync(path.join(outDir, 'keys.js'), 'window.DICT_KEYS=' + JSON.stringify(Object.keys(allKeys)) + ';');
  console.log(`完成：2字母组 ${Object.keys(g2).length} 个，拆分的组 ${bigCount} 个，3字母子文件已生成`);
  await conn.end();
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
