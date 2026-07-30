# 王者曝光台 - 部署指南

## 一、项目结构

```
honor-blacklist/
├── index.html         # 首页/搜索
├── submit.html        # 曝光提交页
├── blacklist.html     # 黑ID一览
├── messages.html      # 私信通知
├── admin.html         # 管理后台
├── common.js          # 核心逻辑库（已对接API）
├── styles.css         # 样式文件
├── server/            # 后端服务
│   ├── server.js      # Express 服务器
│   ├── package.json   # 依赖配置
│   ├── Dockerfile     # Docker部署配置
│   └── railway.json   # Railway部署配置
└── package.json       # 项目根配置
```

## 二、部署后端（Railway）

Railway 是一个免费的 Node.js 托管平台，支持 SQLite 数据库，非常适合你这个项目。

### 步骤 1: 注册 Railway
1. 访问 https://railway.app
2. 用 GitHub 账号登录
3. 免费额度足够这个项目使用

### 步骤 2: 创建新项目
1. 点击 "New Project" → "Deploy from GitHub repo"
2. 如果没有 GitHub 仓库，先创建一个：
   ```bash
   # 在 honor-blacklist 目录下
   git init
   git add .
   git commit -m "init: 王者曝光台 + 后端"
   git remote add origin https://github.com/你的用户名/honor-blacklist.git
   git push -u origin main
   ```

### 步骤 3: 配置 Railway
1. 连接你的 GitHub 仓库
2. Railway 会自动检测 Node.js 项目
3. 设置环境变量（可选）:
   - `PORT`: 3000
   - `NODE_ENV`: production
4. Railway 会自动运行 `npm install` 和 `npm start`

### 步骤 4: 获取后端地址
部署完成后，Railway 会给你一个类似这样的地址：
```
https://honor-blacklist-server.up.railway.app
```

## 三、部署前端

### 方案 A: Cloudflare Pages（推荐，免费+快）

1. 注册 https://pages.cloudflare.com
2. 连接同一个 GitHub 仓库
3. 设置构建命令：`/`（留空或填 `/`）
4. 设置输出目录：`/`（留空）
5. **关键**：在页面设置中添加环境变量：
   - `API_BASE` = `https://你的railway地址.up.railway.app`
6. 部署完成，你会得到一个类似：
   ```
   https://honor-blacklist.pages.dev
   ```

### 方案 B: Vercel（也免费）

1. 注册 https://vercel.com
2. 导入 GitHub 仓库
3. Root Directory 选择 `/`（不是 server）
4. Build Command 留空
5. Output Directory 选择 `/`
6. 添加环境变量 `API_BASE`
7. 部署

### 方案 C: GitHub Pages（最简单）

1. 在 GitHub 仓库 Settings → Pages
2. Source: Deploy from a branch
3. Branch: main, / (root)
4. **重要**：需要在 `index.html` 的 `<head>` 中加入：
   ```html
   <meta name="api-base" content="https://你的railway地址.up.railway.app">
   ```
   这样前端才能找到后端。

## 四、部署后配置

### 更新前端 API 地址

部署前端后，需要让前端知道后端在哪里。有两种方式：

**方式一：修改 common.js（不推荐，每次更新都要改）**

在 `common.js` 顶部找到：
```javascript
window.API_BASE = (function() {
  const urlParams = new URLSearchParams(window.location.search);
  const paramBase = urlParams.get('apiBase');
  if (paramBase) return paramBase;
  const meta = document.querySelector('meta[name="api-base"]');
  if (meta) return meta.getAttribute('content');
  return 'http://localhost:3000';  // ← 改成你的 railway 地址
})();
```

**方式二（推荐）：在 index.html 的 head 中加一行**

```html
<meta name="api-base" content="https://你的railway地址.up.railway.app">
```

这样前端就会自动连接你的后端服务。

## 五、管理员账号

- **用户名**: admin
- **密码**: admin123

部署后请第一时间登录 admin.html 修改密码！

## 六、API 接口文档

后端提供以下 API：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/health | 健康检查 |
| POST | /api/users/register | 用户注册 |
| POST | /api/users/login | 用户登录 |
| GET | /api/records | 获取所有记录 |
| GET | /api/records/search?keyword=xxx | 搜索已通过记录 |
| POST | /api/records | 提交新曝光 |
| PUT | /api/records/:id | 更新记录状态 |
| DELETE | /api/records/:id | 删除记录 |
| POST | /api/records/batch | 批量操作 |
| GET | /api/stats | 获取统计数据 |
| GET | /api/announcements | 获取公告 |
| POST | /api/announcements | 发布公告 |
| GET | /api/messages | 获取私信 |
| POST | /api/messages | 发送私信 |
| POST | /api/upload | 上传图片 |
| GET | /api/users | 获取所有用户 |
| POST | /api/users/:id/ban | 封禁用户 |

## 七、数据迁移

如果之前有 localStorage 中的数据，需要导出后再导入：

1. 在浏览器控制台执行：
   ```javascript
   JSON.stringify({
     users: localStorage.getItem('users'),
     blacklist_records: localStorage.getItem('blacklist_records'),
     announcements: localStorage.getItem('announcements'),
   })
   ```
2. 把结果保存下来
3. 部署后让管理员通过后台手动添加，或联系开发者

## 八、常见问题

**Q: Railway 免费额度用完怎么办？**
A: Railway 有 $5/月的免费额度，普通使用完全够用。如果流量大，可以考虑 Railway Pro 或迁移到其他平台。

**Q: 图片上传失败？**
A: 确保后端服务正常运行，Railway 需要配置足够的磁盘空间（默认有 1GB）。

**Q: CORS 错误？**
A: 后端已经配置了 `cors()` 中间件，允许所有来源。如果还有问题，检查 Railway 的环境变量。

**Q: 数据会丢失吗？**
A: Railway 的免费层有持久化存储，但如果超过一定时间不活跃可能会休眠。建议定期备份数据。
