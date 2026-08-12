// 一键把词库同步到云端数据库（TiDB Cloud Serverless 免费版等）
// 前提: 把 .env.cloud.example 复制为 .env.cloud，并填入你的真实数据库密码
// 用法: node scripts/sync-cloud.js
require('dotenv').config({ path: require('fs').existsSync('.env.cloud') ? '.env.cloud' : '.env' });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { importFromFile } = require('./import-ecdict');

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 4000),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    multipleStatements: true,
  });
  console.log('已连接云端数据库');

  // 建库建表（schema.sql 内含 CREATE DATABASE + USE + CREATE TABLE）
  await conn.query(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'));
  console.log('建库建表完成');

  const csv = process.argv[2] || path.join(__dirname, '..', 'data', 'ecdict.csv');
  const { total, skipped } = await importFromFile(conn, csv, {
    reset: process.argv.includes('--reset'),
    onProgress: function (n) {
      if (n % 100000 < 1000) console.log('已导入 ' + n + ' 条…');
    },
  });
  console.log('云端导入完成: 共 ' + total + ' 条，跳过 ' + skipped + ' 条');
  await conn.end();
}

main().catch(function (err) { console.error('同步失败:', err.message); process.exit(1); });
