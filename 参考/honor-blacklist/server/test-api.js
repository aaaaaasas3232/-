const http = require('http');

function postRequest(path, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const url = new URL(`http://localhost:3000${path}`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`[${path}] 状态码: ${res.statusCode}`);
        console.log(`[${path}] 响应: ${data.substring(0, 200)}`);
        resolve(data);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function test() {
  console.log('=== 测试后端 API ===\n');

  // 1. 健康检查
  await new Promise((resolve) => {
    http.get('http://localhost:3000/api/health', res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        console.log('[GET /api/health] ' + data);
        resolve();
      });
    });
  });

  // 2. 登录测试
  await postRequest('/api/users/login', { username: 'admin', password: 'admin123' });

  // 3. 注册测试
  await postRequest('/api/users/register', { username: 'testuser', password: 'test123456', honorWorldId: '' });

  // 4. 统计
  await new Promise((resolve) => {
    http.get('http://localhost:3000/api/stats', res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        console.log('[GET /api/stats] ' + data);
        resolve();
      });
    });
  });

  console.log('\n=== 测试完成 ===');
}

test().catch(console.error);
