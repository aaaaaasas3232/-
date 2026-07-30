const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;
const STATIC_DIR = path.join(__dirname, '..');
const API_BASE = process.env.API_BASE || 'http://localhost:3000';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];
  let filePath = path.join(STATIC_DIR, urlPath === '/' ? '/index.html' : urlPath);

  // 安全检查：不允许访问上级目录
  if (!filePath.startsWith(STATIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath);
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // 文件不存在，返回 404
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>404 Not Found</title></head>
<body style="font-family:sans-serif;padding:40px;text-align:center;background:#f5f5f5;">
  <h2 style="color:#E88AAA;">404 - 页面未找到</h2>
  <p>请访问 <a href="/">首页</a></p>
</body></html>`);
      return;
    }

    // 如果是 HTML 文件，注入 API_BASE 和一些头部配置
    if (ext === '.html') {
      let html = data.toString('utf8');
      // 在 </head> 标签前注入 API 配置
      const apiMeta = `<meta name="api-base" content="${API_BASE}">`;
      if (!html.includes('name="api-base"')) {
        html = html.replace('</head>', `  ${apiMeta}\n</head>`);
      }
      res.writeHead(200, {
        'Content-Type': mimeType,
        'X-API-Base': API_BASE,
      });
      res.end(html);
    } else {
      res.writeHead(200, { 'Content-Type': mimeType });
      res.end(data);
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n🌐 前端静态服务器已启动`);
  console.log(`📂 托管目录: ${STATIC_DIR}`);
  console.log(`🔗 访问地址: http://localhost:${PORT}/`);
  console.log(`📡 API 地址: ${API_BASE}`);
  console.log(`\n💡 提示：所有 HTML 页面的 API 地址已自动配置为: ${API_BASE}\n`);
});
