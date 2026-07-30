const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const STATIC_DIR = process.env.STATIC_DIR || path.join(__dirname, '..');

// 确保上传目录存在
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 初始化数据库
const db = new Database(path.join(__dirname, 'data.db'));
db.pragma('journal_mode = WAL');

// ===== 所有表创建和数据初始化（在数据库模块里，不需要 app.listen）=====
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    honorWorldId TEXT,
    isBanned INTEGER DEFAULT 0,
    bannedAt TEXT,
    bannedReason TEXT,
    createdAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY,
    gameId TEXT NOT NULL,
    name TEXT,
    server TEXT,
    category TEXT,
    reason TEXT,
    description TEXT,
    evidence TEXT DEFAULT '[]',
    submitterId TEXT,
    status TEXT DEFAULT 'pending',
    rejectReason TEXT,
    createdAt TEXT NOT NULL,
    reviewedAt TEXT,
    reviewedBy TEXT,
    isControversy INTEGER DEFAULT 0,
    controversyVotes INTEGER DEFAULT 0,
    controversyOpposes INTEGER DEFAULT 0,
    controversyVoters TEXT DEFAULT '[]',
    controversyEndAt TEXT,
    controversyStatus TEXT
  );
  CREATE TABLE IF NOT EXISTS announcements (
    id TEXT PRIMARY KEY,
    type TEXT DEFAULT 'announcement',
    title TEXT NOT NULL,
    content TEXT,
    isPinned INTEGER DEFAULT 0,
    createdAt TEXT NOT NULL,
    author TEXT,
    updatedAt TEXT
  );
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    userId TEXT,
    type TEXT,
    title TEXT,
    body TEXT,
    recordId TEXT,
    isRead INTEGER DEFAULT 0,
    createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_records_status ON records(status);
  CREATE INDEX IF NOT EXISTS idx_records_gameId ON records(gameId);
  CREATE INDEX IF NOT EXISTS idx_messages_userId ON messages(userId);
`);

// 初始化管理员
if (!db.prepare('SELECT id FROM users WHERE role = ?').get('admin')) {
  db.prepare('INSERT INTO users (id, username, password, role, createdAt) VALUES (?, ?, ?, ?, ?)')
    .run('admin001', 'admin', 'admin123', 'admin', new Date().toISOString());
  console.log('默认管理员账号已创建: admin / admin123');
}

// 初始化示例数据
if (db.prepare('SELECT COUNT(*) as count FROM records').get().count === 0) {
  const now = new Date();
  const records = [
    ['1001','小甜超乖','','王者荣耀世界','正常交易被蹲','蹲人后拉黑消失','在王者荣耀世界蹲人后加了好友，约好一起玩，结果第二天直接拉黑消失，态度极其恶劣。','[]','approved',new Date(now - 86400000*5).toISOString(),new Date(now - 86400000*3).toISOString(),'管理员'],
    ['1002','乔妹不哭啦','','王者荣耀世界','卖家是骗子','以处CP名义骗钱','以处CP名义交往，后以各种理由借款，金额超过3000元后拉黑失联。','[]','approved',new Date(now - 86400000*12).toISOString(),new Date(now - 86400000*10).toISOString(),'管理员'],
    ['1003','陪玩小甜心','','王者荣耀世界','恶意陪玩','收钱后辱骂并挂机','下单陪玩后，中途挂机20分钟，重连后态度恶劣并辱骂雇主，严重影响心情。','[]','approved',new Date(now - 86400000*20).toISOString(),new Date(now - 86400000*18).toISOString(),'管理员'],
    ['1004','靠谱代练王','','王者荣耀世界','骗钱骗物','代练收钱后不服务','说好代打段位，付款后以各种理由拖延，三天后直接消失，账号密码全部拉黑。','[]','pending',new Date(now - 86400000*1).toISOString(),null,'管理员'],
    ['1005','王者小哥哥9','','王者荣耀世界','恶意放鸽子','约好陪玩后无故消失','约好晚上陪打排位，提前说好价格，临到时间点突然消失不回消息，浪费了宝贵时间。','[]','pending',new Date(now - 3600000*6).toISOString(),null,'管理员'],
    ['1006','测试路人甲','','王者荣耀世界','情感诈骗','假装恋爱骗钱','在游戏里假装处CP，交往一段时间后以各种理由借款2000元后拉黑。','[]','rejected',new Date(now - 86400000*3).toISOString(),new Date(now - 86400000*2).toISOString(),'管理员'],
  ];
  const insertRecord = db.prepare(`INSERT INTO records (id,gameId,name,server,category,reason,description,evidence,status,createdAt,reviewedAt,reviewedBy) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  records.forEach(r => insertRecord.run(...r));

  const announcements = [
    ['a001','announcement','欢迎来到王者曝光台 🫶','欢迎大家使用王者曝光台！本平台旨在为王者荣耀世界玩家提供曝光骗子、蹲人等违规行为的互助平台。我们倡导真实曝光、善意互助，共同维护良好的游戏社交环境。希望大家都能在这里找到帮助，也请各位在提交曝光时确保内容真实、证据充分哦～',1,new Date(now - 86400000*7).toISOString(),'管理员'],
    ['a002','announcement','关于平台立场的重要说明',`【关于ID交易的说明】\n\n近期有很多小伙伴问我们，为什么要做这个曝光平台，是不是官方支持的？\n\n这里统一说明一下：这是玩家自发搭建的互助平台，官方是不参与、不管理ID交易纠纷的。正因为如此，我们在平台上曝光的行为，也和官方完全无关 —— 我们只是玩家与玩家之间互相提醒的小工具～\n\n【我们的态度】\n我们只记录客观事实，不站队、不偏袒。证据充分的曝光会审核通过，虚假信息一律不收录。`,0,new Date(now - 86400000*5).toISOString(),'管理员'],
    ['a003','update','v1.1.0 更新：举报功能优化','1. 新增公告与更新日志模块\n2. 优化了搜索算法，结果更精准\n3. 修复了若干已知问题\n4. 提升了移动端显示效果',0,new Date(now - 86400000*3).toISOString(),'管理员'],
  ];
  const insertAnn = db.prepare(`INSERT INTO announcements (id,type,title,content,isPinned,createdAt,author) VALUES (?,?,?,?,?,?,?)`);
  announcements.forEach(a => insertAnn.run(...a));
  console.log('示例数据已初始化');
}

// ===== 全局中间件 =====
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ===== 辅助函数 =====
const getRecordFields = () => `id, gameId, name, server, category, reason, description, evidence,
  submitterId, status, rejectReason, createdAt, reviewedAt, reviewedBy,
  isControversy, controversyVotes, controversyOpposes, controversyVoters,
  controversyEndAt, controversyStatus`;

const parseRecord = (r) => {
  if (!r) return null;
  r.evidence = r.evidence ? JSON.parse(r.evidence) : [];
  r.isControversy = !!r.isControversy;
  r.controversyVoters = r.controversyVoters ? JSON.parse(r.controversyVoters) : [];
  return r;
};

// ===== 文件上传配置 =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext && mime);
  }
});

// ===== API 路由（必须放在静态文件之前！）=====

// --- 用户 API ---
app.get('/api/users', (req, res) => {
  try {
    const users = db.prepare('SELECT id,username,role,honorWorldId,isBanned,bannedAt,bannedReason,createdAt FROM users ORDER BY createdAt DESC').all();
    users.forEach(u => u.isBanned = !!u.isBanned);
    res.json({ ok: true, data: users });
  } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
});

app.post('/api/users/register', (req, res) => {
  try {
    const { username, password, honorWorldId } = req.body;
    if (!username || username.trim().length < 2) return res.json({ ok: false, msg: '用户名至少2个字符' });
    if (username.trim().length > 20) return res.json({ ok: false, msg: '用户名最多20个字符' });
    if (password && password.length < 6) return res.json({ ok: false, msg: '密码至少6个字符' });
    const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (exists) return res.json({ ok: false, msg: '用户名已存在' });
    if (honorWorldId) {
      const existHW = db.prepare('SELECT id FROM users WHERE LOWER(honorWorldId) = ?').get(honorWorldId.toLowerCase());
      if (existHW) return res.json({ ok: false, msg: '该王者荣耀世界ID已被注册，如需帮助请联系管理员' });
    }
    db.prepare('INSERT INTO users (id,username,password,role,honorWorldId,isBanned,createdAt) VALUES (?,?,?,?,?,0,?)')
      .run(Date.now().toString(), username.trim(), password, honorWorldId ? honorWorldId.trim() : '', new Date().toISOString());
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
});

app.post('/api/users/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) return res.json({ ok: false, msg: '用户名不存在' });
    if (user.isBanned) return res.json({ ok: false, msg: '该账号已被封禁，如有疑问请联系管理员' });
    if (user.password !== password) return res.json({ ok: false, msg: '密码错误' });
    res.json({ ok: true, user: { id: user.id, username: user.username, role: user.role, honorWorldId: user.honorWorldId, isBanned: false, createdAt: user.createdAt } });
  } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
});

app.post('/api/users/:id/ban', (req, res) => {
  try {
    db.prepare('UPDATE users SET isBanned=1, bannedAt=?, bannedReason=? WHERE id=?').run(new Date().toISOString(), req.body.reason || '', req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
});

app.post('/api/users/:id/unban', (req, res) => {
  try {
    db.prepare('UPDATE users SET isBanned=0, bannedAt=NULL, bannedReason=NULL WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
});

app.delete('/api/users/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
});

// --- 曝光记录 API ---
app.get('/api/records', (req, res) => {
  try {
    const { status, tab } = req.query;
    let records;
    if (tab === 'blacklist') {
      records = db.prepare(`SELECT ${getRecordFields()} FROM records WHERE status='approved' OR status='rejected' ORDER BY createdAt DESC`).all();
    } else if (status) {
      records = db.prepare(`SELECT ${getRecordFields()} FROM records WHERE status=? ORDER BY createdAt DESC`).all(status);
    } else {
      records = db.prepare(`SELECT ${getRecordFields()} FROM records ORDER BY createdAt DESC`).all();
    }
    res.json({ ok: true, data: records.map(parseRecord) });
  } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
});

app.get('/api/records/search', (req, res) => {
  try {
    const { keyword } = req.query;
    let records;
    if (keyword && keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      records = db.prepare(`SELECT ${getRecordFields()} FROM records WHERE status='approved' AND (LOWER(gameId) LIKE ? OR LOWER(name) LIKE ? OR LOWER(server) LIKE ?) ORDER BY createdAt DESC`)
        .all(`%${kw}%`, `%${kw}%`, `%${kw}%`);
    } else {
      records = db.prepare(`SELECT ${getRecordFields()} FROM records WHERE status='approved' ORDER BY createdAt DESC`).all();
    }
    res.json({ ok: true, data: records.map(parseRecord) });
  } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
});

app.get('/api/records/:id', (req, res) => {
  try {
    const record = db.prepare(`SELECT ${getRecordFields()} FROM records WHERE id=?`).get(req.params.id);
    res.json({ ok: true, data: parseRecord(record) });
  } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
});

app.post('/api/records', (req, res) => {
  try {
    const { gameId, name, server, category, reason, description, evidence, submitterId } = req.body;
    if (!gameId || !gameId.trim()) return res.json({ ok: false, msg: '请填写被曝光的ID' });
    const id = Date.now().toString();
    db.prepare(`INSERT INTO records (id,gameId,name,server,category,reason,description,evidence,submitterId,status,createdAt) VALUES (?,?,?,?,?,?,?,?,?,'pending',?)`)
      .run(id, gameId.trim(), name||'', server||'', category||'', reason||'', description||'', JSON.stringify(evidence||[]), submitterId||null, new Date().toISOString());
    const record = db.prepare(`SELECT ${getRecordFields()} FROM records WHERE id=?`).get(id);
    res.json({ ok: true, data: parseRecord(record) });
  } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
});

app.put('/api/records/:id', (req, res) => {
  try {
    const { status, rejectReason, reviewedBy } = req.body;
    const record = db.prepare('SELECT * FROM records WHERE id=?').get(req.params.id);
    if (!record) return res.status(404).json({ ok: false, msg: '记录不存在' });
    db.prepare(`UPDATE records SET status=?, rejectReason=?, reviewedAt=?, reviewedBy=? WHERE id=?`)
      .run(status||record.status, rejectReason!==undefined?rejectReason:record.rejectReason, new Date().toISOString(), reviewedBy||'管理员', req.params.id);
    const updated = db.prepare(`SELECT ${getRecordFields()} FROM records WHERE id=?`).get(req.params.id);
    res.json({ ok: true, data: parseRecord(updated) });
  } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
});

app.delete('/api/records/:id', (req, res) => {
  try { db.prepare('DELETE FROM records WHERE id=?').run(req.params.id); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
});

app.post('/api/records/batch', (req, res) => {
  try {
    const { ids, status, rejectReason, reviewedBy } = req.body;
    if (!ids || !Array.isArray(ids)) return res.json({ ok: false, msg: '请提供有效的ID列表' });
    const now = new Date().toISOString();
    const stmt = db.prepare(`UPDATE records SET status=?, rejectReason=?, reviewedAt=?, reviewedBy=? WHERE id=?`);
    const tx = db.transaction(items => { for (const id of items) stmt.run(status, rejectReason||null, now, reviewedBy||'管理员', id); });
    tx(ids);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
});

app.post('/api/records/:id/controversy', (req, res) => {
  try {
    const { action, userId } = req.body;
    const record = db.prepare('SELECT * FROM records WHERE id=?').get(req.params.id);
    if (!record) return res.status(404).json({ ok: false, msg: '记录不存在' });
    let voters = record.controversyVoters ? JSON.parse(record.controversyVoters) : [];
    let votes = record.controversyVotes || 0;
    let opposes = record.controversyOpposes || 0;
    if (action === 'vote' && !voters.includes(userId)) { voters.push(userId); votes++; }
    else if (action === 'oppose' && !voters.includes(userId)) { voters.push(userId); opposes++; }
    db.prepare(`UPDATE records SET controversyVotes=?, controversyOpposes=?, controversyVoters=?, controversyStatus='pending' WHERE id=?`)
      .run(votes, opposes, JSON.stringify(voters), req.params.id);
    const updated = db.prepare(`SELECT ${getRecordFields()} FROM records WHERE id=?`).get(req.params.id);
    res.json({ ok: true, data: parseRecord(updated) });
  } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
});

app.get('/api/stats', (req, res) => {
  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM records').get().count;
    const pending = db.prepare("SELECT COUNT(*) as count FROM records WHERE status='pending'").get().count;
    const approved = db.prepare("SELECT COUNT(*) as count FROM records WHERE status='approved'").get().count;
    const rejected = db.prepare("SELECT COUNT(*) as count FROM records WHERE status='rejected'").get().count;
    res.json({ ok: true, data: { total, pending, approved, rejected } });
  } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
});

// --- 公告 API ---
app.get('/api/announcements', (req, res) => {
  try {
    const announcements = db.prepare('SELECT * FROM announcements ORDER BY isPinned DESC, createdAt DESC').all();
    announcements.forEach(a => a.isPinned = !!a.isPinned);
    res.json({ ok: true, data: announcements });
  } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
});

app.post('/api/announcements', (req, res) => {
  try {
    const { type, title, content, isPinned } = req.body;
    const id = Date.now().toString();
    db.prepare(`INSERT INTO announcements (id,type,title,content,isPinned,createdAt,author) VALUES (?,?,?,?,?,?,'管理员')`)
      .run(id, type||'announcement', title, content||'', isPinned?1:0, new Date().toISOString());
    const ann = db.prepare('SELECT * FROM announcements WHERE id=?').get(id);
    ann.isPinned = !!ann.isPinned;
    res.json({ ok: true, data: ann });
  } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
});

app.put('/api/announcements/:id', (req, res) => {
  try {
    const { type, title, content, isPinned } = req.body;
    db.prepare(`UPDATE announcements SET type=?, title=?, content=?, isPinned=?, updatedAt=? WHERE id=?`)
      .run(type, title, content||'', isPinned?1:0, new Date().toISOString(), req.params.id);
    const ann = db.prepare('SELECT * FROM announcements WHERE id=?').get(req.params.id);
    ann.isPinned = !!ann.isPinned;
    res.json({ ok: true, data: ann });
  } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
});

app.delete('/api/announcements/:id', (req, res) => {
  try { db.prepare('DELETE FROM announcements WHERE id=?').run(req.params.id); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
});

// --- 私信 API ---
app.get('/api/messages', (req, res) => {
  try {
    const { userId } = req.query;
    const messages = userId
      ? db.prepare('SELECT * FROM messages WHERE userId=? ORDER BY createdAt DESC').all(userId)
      : db.prepare('SELECT * FROM messages ORDER BY createdAt DESC').all();
    messages.forEach(m => m.isRead = !!m.isRead);
    res.json({ ok: true, data: messages });
  } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
});

app.post('/api/messages', (req, res) => {
  try {
    const { userId, type, title, body, recordId } = req.body;
    const id = Date.now().toString();
    db.prepare(`INSERT INTO messages (id,userId,type,title,body,recordId,isRead,createdAt) VALUES (?,?,?,?,?,?,0,?)`)
      .run(id, userId||null, type||'info', title, body||'', recordId||null, new Date().toISOString());
    const msg = db.prepare('SELECT * FROM messages WHERE id=?').get(id);
    msg.isRead = !!msg.isRead;
    res.json({ ok: true, data: msg });
  } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
});

app.post('/api/messages/mark-read', (req, res) => {
  try { if (req.body.id) db.prepare('UPDATE messages SET isRead=1 WHERE id=?').run(req.body.id); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
});

app.post('/api/messages/mark-all-read', (req, res) => {
  try {
    if (req.body.userId) db.prepare('UPDATE messages SET isRead=1 WHERE userId=?').run(req.body.userId);
    else db.prepare('UPDATE messages SET isRead=1').run();
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
});

app.delete('/api/messages/:id', (req, res) => {
  try { db.prepare('DELETE FROM messages WHERE id=?').run(req.params.id); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
});

// --- 文件上传 ---
app.post('/api/upload', upload.array('files', 10), (req, res) => {
  const files = (req.files||[]).map(f => ({ filename: f.filename, originalname: f.originalname, size: f.size, url: `/uploads/${f.filename}` }));
  res.json({ ok: true, data: files });
});

// --- 管理员检查 ---
app.get('/api/admin/check', (req, res) => {
  const { username, password } = req.query;
  try {
    const user = db.prepare("SELECT * FROM users WHERE username=? AND role='admin'").get(username);
    if (!user || user.password !== password) return res.json({ ok: false });
    res.json({ ok: true, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
});

// --- 健康检查 ---
app.get('/api/health', (req, res) => { res.json({ ok: true, timestamp: new Date().toISOString() }); });

// ===== 静态文件服务（API 路由之后，/api/* 不会被匹配）=====
const API_BASE = process.env.API_BASE || '';
const MIME_TYPES = { '.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.gif':'image/gif', '.svg':'image/svg+xml', '.ico':'image/x-icon' };

// 托管上传目录
app.use('/uploads', express.static(UPLOAD_DIR));

// 静态文件（只处理 GET 请求，自动跳过 /api/*）
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  if (req.path.startsWith('/api')) return next();

  let urlPath = req.path === '/' ? '/index.html' : req.path;
  let filePath = path.join(STATIC_DIR, urlPath);
  if (!filePath.startsWith(STATIC_DIR)) return next();

  const ext = path.extname(filePath).toLowerCase();
  fs.readFile(filePath, (err, data) => {
    if (err) return next();
    if (ext === '.html') {
      let html = data.toString('utf8');
      if (API_BASE) {
        const apiMeta = `<meta name="api-base" content="${API_BASE}">`;
        if (!html.includes('name="api-base"')) html = html.replace('</head>', `  ${apiMeta}\n</head>`);
      }
      return res.type('html').send(html);
    }
    res.type(ext).send(data);
  });
});

// SPA fallback（GET 未匹配路由 → index.html）
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ ok: false, msg: 'Not found' });
  const indexPath = path.join(STATIC_DIR, 'index.html');
  if (API_BASE && fs.existsSync(indexPath)) {
    let html = fs.readFileSync(indexPath, 'utf8');
    const apiMeta = `<meta name="api-base" content="${API_BASE}">`;
    if (!html.includes('name="api-base"')) html = html.replace('</head>', `  ${apiMeta}\n</head>`);
    return res.type('html').send(html);
  }
  res.sendFile(indexPath);
});

// ===== 启动服务器 =====
app.listen(PORT, () => {
  console.log(`\n🎮 王者曝光台服务已启动`);
  console.log(`📡 端口: ${PORT}`);
  console.log(`🌐 访问: http://localhost:${PORT}/`);
  console.log(`👤 管理员: admin / admin123\n`);
});

module.exports = app;
