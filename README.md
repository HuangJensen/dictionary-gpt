# 📖 词典GPT —— 免费在线词典查询

一个轻量级的在线词典查询应用，技术栈：**JavaScript + Node.js + MySQL + GitHub**。

- ✅ **免费**：数据库用 TiDB Cloud Serverless（MySQL 兼容、免信用卡），部署用 Render 免费版
- ✅ **内存小**：只依赖 3 个运行时包（express / mysql2 / dotenv），小连接池，默认堆内存上限 256MB
- ✅ **可互联网访问**：部署到 Render / Vercel 后，任何人通过 URL 即可访问
- ✅ **词库大**：默认内置 ECDICT 英汉词典（约 76 万词条，MIT 协议），含音标、词性、考试标签、词形变化

## 功能

- 精确匹配 / 前缀匹配 / 模糊搜索
- 显示：单词、音标（IPA）、拼音、词性、考试标签（中考/高考/四级/六级/考研/托福/雅思/GRE）、中文+英文释义、词形变化、数据来源
- 简洁中文网页界面 + JSON API
- 健康检查接口

## 项目结构

```
词典GPT/
├── server.js              # 主服务：Express + mysql2 连接池
├── public/                # 网页前端（原生 HTML/JS/CSS，无框架）
├── db/
│   ├── schema.sql         # 建表语句（支持 CEDICT + ECDICT 字段）
│   ├── sample.csv         # 示例词条
│   └── seed.js            # 示例 CSV 导入脚本
├── scripts/
│   ├── import-cedict.js   # 导入 CC-CEDICT（约 12 万词条，拼音）
│   └── import-ecdict.js   # 导入 ECDICT（约 76 万词条，音标/词性/标签）
├── data/                  # 词库文件（git 已忽略，不提交）
├── .env.example           # 环境变量模板
├── .github/workflows/     # CI：语法检查
└── README.md
```

## 本地快速开始

### 1. 准备数据库

任选其一：

- 本地安装 MySQL，执行建表：`mysql -u root -p < db/schema.sql`
- 或注册 [TiDB Cloud Serverless](https://tidbcloud.com)（免费），在 SQL Editor 中执行 `db/schema.sql` 里的建表语句

### 2. 配置环境变量

```bash
cp .env.example .env
```

按需修改 `.env` 里的数据库连接信息。使用 TiDB Cloud Serverless 时：

```bash
DB_HOST=xxx.tidbcloud.com
DB_PORT=4000
DB_USER=xxx.root
DB_PASSWORD=你的密码
DB_NAME=dictionary
DB_SSL=true
```

### 3. 安装依赖

```bash
npm install
```

### 4. 导入词库（二选一）

导入 ECDICT 完整词库（约 76 万词条，**推荐**，文件约 63MB）：

```bash
# 先下载 https://github.com/skywind3000/ECDICT 的 ecdict.csv 到 data/ 目录
node scripts/import-ecdict.js data/ecdict.csv --reset
```

或导入 CC-CEDICT（约 12 万词条，脚本自动下载，约 9MB）：

```bash
npm run import:cedict -- --reset
```

或先导入内置示例数据（10 条）：

```bash
npm run seed
```

### 5. 启动

```bash
npm start
```

打开 http://localhost:3000 即可查询。

## API 文档

| 接口 | 说明 |
| --- | --- |
| GET /health | 健康检查 |
| GET /api/search?q=hello | 查询（默认前缀匹配） |
| GET /api/search?q=hello&mode=exact | 精确匹配 |
| GET /api/search?q=run&mode=fuzzy | 模糊搜索（单词/音标/释义） |

返回示例：

```json
{
  "query": "hello",
  "mode": "exact",
  "count": 1,
  "results": [
    {
      "id": 445216,
      "word": "hello",
      "traditional": "",
      "pinyin": "",
      "phonetic": "həˈləʊ",
      "definition": "int. 你好；喂
n. 表示问候",
      "pos": "int/n",
      "tag": "zk gk",
      "exchange": "s:hellos",
      "audio": "",
      "source": "ECDICT"
    }
  ]
}
```

## 免费部署到互联网

推荐组合（全部免费、无需信用卡）：

| 组件 | 免费方案 |
| --- | --- |
| 代码仓库 | GitHub |
| 数据库 | TiDB Cloud Serverless（MySQL 兼容，免费额度大） |
| 后端 + 前端托管 | Render 免费版（512MB 内存，Node.js） |

### 步骤

1. **把代码推送到 GitHub**

   ```bash
   git init
   git add .
   git commit -m "init dictionary app"
   git branch -M main
   git remote add origin https://github.com/你的用户名/词典GPT.git
   git push -u origin main
   ```

2. **创建免费数据库 TiDB Cloud Serverless**

   - 打开 https://tidbcloud.com 注册（无需信用卡）
   - Create Cluster → 选择 Serverless（免费）→ 创建
   - 在 Overview 点 Connect，记录连接串，格式：`mysql://用户:密码@主机:4000/dictionary`
   - 在 SQL Editor 执行 `db/schema.sql` 建表
   - 把词库导入云端数据库（本机执行，连接的是云端地址）：
     ```bash
     node scripts/import-ecdict.js data/ecdict.csv --reset
     ```

3. **在 Render 部署**

   - 打开 https://render.com 注册（无需信用卡）
   - New → Web Service → 连接你的 GitHub 仓库
   - 配置：
     - Build Command: `npm install`
     - Start Command: `npm start`
   - Environment 填入 .env 里的变量（DB_HOST、DB_PORT、DB_USER、DB_PASSWORD、DB_NAME、DB_SSL=true）
   - 点击 Create Web Service，等待部署完成
   - 之后每次 push 到 GitHub 都会自动重新部署

4. **完成**

   - 打开 Render 分配给你的 `https://你的应用.onrender.com` 即可全球访问
   - 免费版 15 分钟无请求后会休眠，再次访问自动唤醒（约 30 秒），适合个人/学习用途

### 其他可选方案

- 前端放到 GitHub Pages / Vercel，只把 API 放 Render（后端已开启 CORS，跨域可用）
- 数据库也可以换：本地 MySQL、db4free.net、Aiven 等，只需改 `.env`
- 想一直在线不休眠：升级 Render 付费（约 $7/月），或用 Oracle Cloud 免费 VM 自建 MySQL

## 内存优化说明

- 依赖极少：只有 `express`、`mysql2`、`dotenv` 三个运行时依赖，不用 ORM
- `mysql2` 使用连接池，`DB_POOL_SIZE` 默认 5，够用且省内存
- `npm start` 使用 `--max-old-space-size=256` 限制堆内存
- 导入 ECDICT 采用流式逐行读取 + 批量插入，内存占用稳定
- 大词库查询建议用 exact / prefix（走索引），fuzzy 会全表扫描，较慢

## 部署到 Vercel（无需信用卡，推荐国内用户）

如果不想用 Render（部分地区会被要求绑信用卡验证），改用 Vercel 免费部署，**全程不需要银行卡**：

1. 打开 https://vercel.com 用 **GitHub 账号**注册登录（免费，不绑卡）
2. 点 **Add New → Project** → 选择 dictionary-gpt 仓库 → **Import**
3. 在 **Environment Variables** 里填（和 .env 一样）：

```
DB_HOST=gateway01.ap-northeast-1.prod.aws.tidbcloud.com
DB_PORT=4000
DB_USER=2D1J24xtKs4xwp6.root
DB_PASSWORD=你的TiDB密码
DB_NAME=dictionary
DB_SSL=true
```

4. 点 **Deploy**，等 1~2 分钟
5. 完成后得到网址：https://dictionary-gpt.vercel.app（可自定义）

> 项目已适配 Vercel：`api/index.js` 作为入口 + `vercel.json` 路由，前端页面和 API 都由同一个函数提供，无需额外配置。
## 数据来源与许可

- ECDICT：https://github.com/skywind3000/ECDICT （MIT 协议，约 76 万词条）
- CC-CEDICT：https://www.mdbg.net/chinese/dictionary?page=cc-cedict （CC BY-SA 4.0，约 12 万词条）

## 常见问题

- **启动后 /health 返回 503**：数据库连不上，检查 .env 的 host / port / 账号密码，以及 DB_SSL 是否设置正确
- **TiDB Cloud 连接报错**：Serverless 要求 TLS，必须 `DB_SSL=true`
- **fuzzy 搜索慢**：词库很大时模糊搜索会全表扫描，属正常现象，建议用前缀匹配
- **Render 免费版休眠**：个人使用完全够用，也可用 UptimeRobot 定时 ping 保持唤醒（注意免费额度 750 小时/月）
- **ECDICT 下载慢/失败**：国内可用加速镜像，如 `https://ghfast.top/https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv`（支持断点续传）
