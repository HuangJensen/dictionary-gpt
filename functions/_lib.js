// 共享：根据环境变量拼 TiDB 连接串（Cloudflare Pages Functions 专用，HTTPS 驱动）
export function buildUrl(env) {
  const host = env.DB_HOST || '127.0.0.1';
  const port = env.DB_PORT || '4000';
  const user = env.DB_USER || 'root';
  const pass = env.DB_PASSWORD || '';
  const db = env.DB_NAME || 'dictionary';
  return 'mysql://' + encodeURIComponent(user) + ':' + encodeURIComponent(pass) + '@' + host + ':' + port + '/' + db;
}
