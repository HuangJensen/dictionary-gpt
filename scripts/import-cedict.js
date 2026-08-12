// 导入 CC-CEDICT（免费中英词典，约 12 万词条，CC BY-SA 4.0）
// 用法: node scripts/import-cedict.js [--reset]
// 数据来源: https://www.mdbg.net/chinese/dictionary?page=cc-cedict
require('dotenv').config();
const https = require('https');
const mysql = require('mysql2/promise');

const CEDICT_URL = 'https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt';

const TONES = {
  a: ['a', 'ā', 'á', 'ǎ', 'à'],
  e: ['e', 'ē', 'é', 'ě', 'è'],
  i: ['i', 'ī', 'í', 'ǐ', 'ì'],
  o: ['o', 'ō', 'ó', 'ǒ', 'ò'],
  u: ['u', 'ū', 'ú', 'ǔ', 'ù'],
  'ü': ['ü', 'ǖ', 'ǘ', 'ǚ', 'ǜ'],
};

// 把 ni3 hao3 转成带声调的 nǐ hǎo
function addToneMarks(py) {
  return py.split(/\s+/).map(function (syl) {
    if (!/\d$/.test(syl)) return syl;
    var tone = Number(syl.slice(-1));
    var body = syl.slice(0, -1).toLowerCase();
    if (tone < 1 || tone > 5) return syl;
    var idx = -1;
    for (var i = 0; i < body.length; i++) {
      var ch = body[i];
      if (ch === 'a' || ch === 'e') { idx = i; break; }
      if ('iouü'.indexOf(ch) >= 0) { idx = i; }
      if (ch === 'v') { idx = i; }
    }
    if (idx < 0) return syl;
    var base = body[idx] === 'v' ? 'ü' : body[idx];
    var marked = TONES[base][tone];
    return body.slice(0, idx) + marked + body.slice(idx + 1);
  }).join(' ');
}

function download(url) {
  return new Promise(function (resolve, reject) {
    https.get(url, function (res) {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error('HTTP ' + res.statusCode + ' from ' + url));
      }
      var chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () { resolve(Buffer.concat(chunks).toString('utf8')); });
    }).on('error', reject);
  });
}

// 解析一行: Traditional Simplified [pin1 yin1] /def1/def2/
function parseLine(line) {
  var m = line.match(/^(\S+) (\S+) \[([^\]]+)\] \/(.*)\/$/);
  if (!m) return null;
  return {
    simplified: m[2],
    traditional: m[1],
    pinyin: addToneMarks(m[3]),
    definition: m[4].replace(/\//g, '；').replace(/\r/g, ''),
  };
}

async function main() {
  const reset = process.argv.includes('--reset');
  console.log('下载 CEDICT 词库中…');
  const text = await download(CEDICT_URL);
  console.log('下载完成，共 ' + text.length + ' 字符，开始解析…');

  const rows = [];
  text.split(/\n/).forEach(function (line) {
    if (!line || line.startsWith('#')) return;
    const item = parseLine(line);
    if (item) rows.push(item);
  });
  console.log('解析完成，共 ' + rows.length + ' 词条，开始写入数据库…');

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

  const sql = 'INSERT INTO entries (word, traditional, pinyin, definition, source) VALUES ?';
  const BATCH = 1000;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH).map(function (r) {
      return [r.simplified, r.traditional, r.pinyin, r.definition, 'CEDICT'];
    });
    const [result] = await conn.query(sql, [batch]);
    inserted += result.affectedRows;
    if (i % 20000 === 0) console.log('已写入 ' + inserted + ' 条…');
  }
  console.log('导入完成: 共 ' + inserted + ' 条');
  await conn.end();
}

main().catch(function (err) {
  console.error('导入失败:', err.message);
  process.exit(1);
});
