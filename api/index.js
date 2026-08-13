// Vercel 入口：把整个 Express 应用交给 Vercel 托管
// 前端页面(public/)与 /api/search 接口都由它提供
const app = require('../server');

module.exports = app;
