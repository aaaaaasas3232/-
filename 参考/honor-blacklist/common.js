/* ================================================
   通用工具库 - 王者曝光台
   ================================================ */

/* ---- API 配置 ---- */
window.API_BASE = (function() {
  // 如果页面传入了 apiBase 参数会自动使用
  const urlParams = new URLSearchParams(window.location.search);
  const paramBase = urlParams.get('apiBase');
  if (paramBase) return paramBase;
  // 从 meta 标签读取
  const meta = document.querySelector('meta[name="api-base"]');
  if (meta) return meta.getAttribute('content');
  // 默认开发地址
  return 'http://localhost:3000';
})();

window.API_MODE = false; // true=使用后端API, false=使用localStorage（默认本地模式，服务器端自动检测）

// 自动检测后端是否可用（仅在默认模式下生效）
(function autoDetectBackend() {
  if (window.API_MODE) return; // 已强制开启则跳过
  const xhr = new XMLHttpRequest();
  xhr.open('GET', window.API_BASE + '/api/health', false);
  try {
    xhr.send();
    if (xhr.status >= 200 && xhr.status < 300) {
      window.API_MODE = true;
    }
  } catch (e) {
    // 后端不可用，保持 localStorage 模式
  }
})();

/* ---- 同步API请求（兼容原有同步调用方式） ---- */
function apiFetch(path, options = {}) {
  if (!window.API_MODE) return null;
  try {
    const xhr = new XMLHttpRequest();
    const method = options.method || 'GET';
    xhr.open(method, window.API_BASE + path, false); // false = 同步
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(options.body ? JSON.stringify(options.body) : null);
    if (xhr.status >= 200 && xhr.status < 300) {
      return JSON.parse(xhr.responseText);
    }
    return null;
  } catch (e) {
    console.warn('API 请求失败:', path, e);
    return null;
  }
}

/* ---- 异步上传图片到服务器（用于提交曝光时的图片） ---- */
function uploadImagesAsync(files) {
  // files: [{src, note}] 数组，其中 src 可能是 base64 或 URL
  if (!window.API_MODE || !files || files.length === 0) {
    return Promise.resolve(files);
  }

  const formData = new FormData();
  const base64Files = [];

  files.forEach((f, i) => {
    if (f.src && f.src.startsWith('data:')) {
      // 是 base64，转为 blob
      const byteString = atob(f.src.split(',')[1]);
      const mimeType = f.src.split(',')[0].match(/:(.*?);/)[1];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let j = 0; j < byteString.length; j++) {
        ia[j] = byteString.charCodeAt(j);
      }
      const blob = new Blob([ab], { type: mimeType });
      const ext = mimeType.split('/')[1] || 'jpg';
      formData.append('files', blob, `img_${i}.${ext}`);
      base64Files.push(i);
    }
  });

  if (base64Files.length === 0) {
    // 全部是URL，不需要上传
    return Promise.resolve(files);
  }

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', window.API_BASE + '/api/upload', true);
    xhr.onload = function() {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res && res.ok) {
            let urlIdx = 0;
            const result = files.map((f, i) => {
              if (base64Files.includes(i) && res.data[urlIdx]) {
                const uploaded = res.data[urlIdx];
                urlIdx++;
                return { src: window.API_BASE + uploaded.url, note: f.note };
              }
              return f;
            });
            resolve(result);
          }
        } catch (e) {
          console.warn('解析上传响应失败', e);
        }
      }
      // 即使失败也返回原文件
      resolve(files);
    };
    xhr.onerror = function() {
      console.warn('图片上传失败，将以 base64 形式提交');
      resolve(files);
    };
    xhr.send(formData);
  });
}

/* ---- Emoji 过滤 ---- */
const EMOJI_PATTERN = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2300}-\u{23FF}]|[\u{2B50}]|[\u{1FA00}-\u{1FAFF}]|[\u{231A}-\u{231B}]|[\u{23E9}-\u{23F3}]|[\u{23F8}-\u{23FA}]|[\u{25AA}-\u{25AB}]|[\u{25B6}]|[\u{25C0}]|[\u{25FB}-\u{25FE}]|[\u{2614}-\u{2615}]|[\u{2648}-\u{2653}]|[\u{267F}]|[\u{2693}]|[\u{26A1}]|[\u{26AA}-\u{26AB}]|[\u{26BD}-\u{26BE}]|[\u{26C4}-\u{26C5}]|[\u{26CE}]|[\u{26D4}]|[\u{26EA}]|[\u{26F2}-\u{26F3}]|[\u{26F5}]|[\u{26FA}]|[\u{26FD}]|[\u{2702}]|[\u{2705}]|[\u{2708}-\u{270D}]|[\u{270F}]|[\u{2712}]|[\u{2714}]|[\u{2716}]|[\u{271D}]|[\u{2721}]|[\u{2728}]|[\u{2733}-\u{2734}]|[\u{2744}]|[\u{2747}]|[\u{274C}]|[\u{274E}]|[\u{2753}-\u{2755}]|[\u{2757}]|[\u{2763}-\u{2764}]|[\u{2795}-\u{2797}]|[\u{27A1}]|[\u{27B0}]|[\u{27BF}]|[\u{2934}-\u{2935}]|[\u{2B05}-\u{2B07}]|[\u{2B1B}-\u{2B1C}]|[\u{2B55}]|[\u{3030}]|[\u{303D}]|[\u{3297}]|[\u{3299}]|[\u{1F004}]|[\u{1F0CF}]|[\u{1F170}-\u{1F171}]|[\u{1F17E}-\u{1F17F}]|[\u{1F18E}]|[\u{1F191}-\u{1F19A}]|[\u{1F201}-\u{1F202}]|[\u{1F21A}]|[\u{1F22F}]|[\u{1F232}-\u{1F23A}]|[\u{1F250}-\u{1F251}]|[\u{1F300}-\u{1F320}]|[\u{1F32D}-\u{1F335}]|[\u{1F337}-\u{1F37C}]|[\u{1F37D}-\u{1F37F}]|[\u{1F380}-\u{1F393}]|[\u{1F3A0}-\u{1F3C4}]|[\u{1F3C5}-\u{1F3C6}]|[\u{1F3C7}-\u{1F3CA}]|[\u{1F3CB}-\u{1F3CE}]|[\u{1F3CF}-\u{1F3D3}]|[\u{1F3D4}-\u{1F3E0}]|[\u{1F3E1}-\u{1F3F0}]|[\u{1F3F3}-\u{1F3F8}]|[\u{1F3F9}-\u{1F3FF}]|[\u{1F400}-\u{1F43E}]|[\u{1F43F}-\u{1F43F}]|[\u{1F440}]|[\u{1F441}-\u{1F441}]|[\u{1F442}-\u{1F4FD}]|[\u{1F4FE}-\u{1F4FF}]|[\u{1F500}-\u{1F53D}]|[\u{1F549}-\u{1F54E}]|[\u{1F54F}-\u{1F54F}]|[\u{1F550}-\u{1F579}]|[\u{1F57A}-\u{1F57A}]|[\u{1F57B}-\u{1F5A3}]|[\u{1F5A4}-\u{1F5A4}]|[\u{1F5A5}-\u{1F5D4}]|[\u{1F5D5}-\u{1F5FB}]|[\u{1F5FC}-\u{1F64F}]|[\u{1F650}-\u{1F67F}]|[\u{1F680}-\u{1F6C5}]|[\u{1F6CB}-\u{1F6CF}]|[\u{1F6D0}-\u{1F6D2}]|[\u{1F6D3}-\u{1F6D4}]|[\u{1F6D5}-\u{1F6D7}]|[\u{1F6D8}-\u{1F6DF}]|[\u{1F6E0}-\u{1F6E5}]|[\u{1F6E6}-\u{1F6E9}]|[\u{1F6EA}-\u{1F6EF}]|[\u{1F6F0}-\u{1F6F3}]|[\u{1F6F4}-\u{1F6FC}]|[\u{1F7E0}-\u{1F7EB}]|[\u{1F90C}-\u{1F93A}]|[\u{1F93C}-\u{1F945}]|[\u{1F946}]|[\u{1F947}-\u{1F978}]|[\u{1F979}-\u{1F9CB}]|[\u{1F9CC}-\u{1F9FF}]|[\u{1FA70}-\u{1FA74}]|[\u{1FA78}-\u{1FA7A}]|[\u{1FA80}-\u{1FA86}]|[\u{1FA90}-\u{1FAA8}]|[\u{1FAB0}-\u{1FAB6}]|[\u{1FAC0}-\u{1FAC2}]|[\u{1FAD0}-\u{1FAD6}]|[\u{1FAD7}-\u{1FAD9}]|[\u{1FAE0}-\u{1FAE7}]|[\u{1FAF0}-\u{1FAF6}]/gu;

function stripEmoji(str) {
  if (!str) return '';
  return str.replace(EMOJI_PATTERN, '');
}

function hasEmoji(str) {
  if (!str) return false;
  return EMOJI_PATTERN.test(str);
}

const ANNOUNCEMENT_TAG = {
  'announcement': { label: '公告', cls: 'tag-blue', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"/></svg>' },
  'update':       { label: '更新', cls: 'tag-green', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.6"/></svg>' },
  'pinned':       { label: '置顶', cls: 'tag-pink', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V8h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v2.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>' },
};

/* ================================================
   用户系统 DB
   ================================================ */
const DB_USERS = {
  // 获取所有用户
  getAll() {
    if (window.API_MODE) {
      const res = apiFetch('/api/users');
      return (res && res.ok ? res.data : JSON.parse(localStorage.getItem('users') || '[]'));
    }
    return JSON.parse(localStorage.getItem('users') || '[]');
  },

  // 保存全部用户
  saveAll(users) {
    localStorage.setItem('users', JSON.stringify(users));
  },

  // 根据用户名查找
  findByUsername(username) {
    const users = this.getAll();
    return users.find(u => u.username === username) || null;
  },

  // 根据王者荣耀世界ID查找
  findByHonorWorldId(honorWorldId) {
    if (!honorWorldId) return null;
    const users = this.getAll();
    return users.find(u => u.honorWorldId && u.honorWorldId.toLowerCase() === honorWorldId.toLowerCase()) || null;
  },

  // 注册新用户（普通用户）
  register(username, password, honorWorldId) {
    if (window.API_MODE) {
      const res = apiFetch('/api/users/register', { method: 'POST', body: { username, password, honorWorldId } });
      return res || { ok: false, msg: '网络错误，请检查后端服务是否启动' };
    }
    const users = this.getAll();
    if (users.some(u => u.username === username)) return { ok: false, msg: '用户名已存在' };
    if (honorWorldId && users.some(u => u.honorWorldId && u.honorWorldId.toLowerCase() === honorWorldId.toLowerCase())) {
      return { ok: false, msg: '该王者荣耀世界ID已被注册，如需帮助请联系管理员' };
    }
    if (username.trim().length < 2) return { ok: false, msg: '用户名至少2个字符' };
    if (username.trim().length > 20) return { ok: false, msg: '用户名最多20个字符' };
    if (hasEmoji(username)) return { ok: false, msg: '用户名不能包含表情' };
    if (password.length < 6) return { ok: false, msg: '密码至少6个字符' };

    users.push({
      id: Date.now().toString(),
      username: username.trim(),
      password: password,
      role: 'user',
      createdAt: new Date().toISOString(),
      honorWorldId: honorWorldId ? honorWorldId.trim() : '',
      isBanned: false,
      bannedAt: null,
      bannedReason: null,
    });
    this.saveAll(users);
    return { ok: true };
  },

  // 更新用户信息
  updateUser(id, data) {
    if (window.API_MODE) {
      // API模式下只记录本地
      const users = JSON.parse(localStorage.getItem('users') || '[]');
      const idx = users.findIndex(u => u.id === id);
      if (idx !== -1) {
        users[idx] = { ...users[idx], ...data };
        localStorage.setItem('users', JSON.stringify(users));
      }
      return users;
    }
    const users = this.getAll();
    const idx = users.findIndex(u => u.id === id);
    if (idx !== -1) {
      users[idx] = { ...users[idx], ...data };
      this.saveAll(users);
    }
    return users;
  },

  // 封禁用户
  banUser(id, reason) {
    if (window.API_MODE) {
      apiFetch(`/api/users/${id}/ban`, { method: 'POST', body: { reason } });
    }
    return this.updateUser(id, { isBanned: true, bannedAt: new Date().toISOString(), bannedReason: reason || '' });
  },

  // 解封用户
  unbanUser(id) {
    if (window.API_MODE) {
      apiFetch(`/api/users/${id}/unban`, { method: 'POST' });
    }
    return this.updateUser(id, { isBanned: false, bannedAt: null, bannedReason: null });
  },

  // 删除用户
  deleteUser(id) {
    if (window.API_MODE) {
      apiFetch(`/api/users/${id}`, { method: 'DELETE' });
    }
    const users = this.getAll();
    this.saveAll(users.filter(u => u.id !== id));
  },

  // 登录
  login(username, password) {
    if (window.API_MODE) {
      const res = apiFetch('/api/users/login', { method: 'POST', body: { username, password } });
      if (res && res.ok) {
        SESSION.setCurrent(res.user);
        return { ok: true, user: res.user };
      }
      return res || { ok: false, msg: '网络错误，请检查后端服务是否启动' };
    }
    const user = this.findByUsername(username);
    if (!user) return { ok: false, msg: '用户名不存在' };
    if (user.isBanned) return { ok: false, msg: '该账号已被封禁，如有疑问请联系管理员' };
    if (user.password !== password) return { ok: false, msg: '密码错误' };
    return { ok: true, user };
  },

  // 初始化默认管理员账号
  initAdmin() {
    if (this.getAll().some(u => u.role === 'admin')) return;
    const users = this.getAll();
    users.push({
      id: 'admin001',
      username: 'admin',
      password: 'admin123',
      role: 'admin',
      createdAt: new Date().toISOString(),
      honorWorldId: '',
      isBanned: false,
    });
    this.saveAll(users);
  },
};

// 简化版 session 管理（基于 localStorage）
const SESSION = {
  KEY: 'current_user',

  // 获取当前登录用户
  getCurrent() {
    const data = localStorage.getItem(this.KEY);
    return data ? JSON.parse(data) : null;
  },

  // 设置当前登录用户
  setCurrent(user) {
    if (!user) {
      localStorage.removeItem(this.KEY);
    } else {
      // 只存 id 和 role，不存密码
      localStorage.setItem(this.KEY, JSON.stringify({
        id: user.id,
        username: user.username,
        role: user.role,
        isBanned: user.isBanned || false,
      }));
    }
  },

  // 是否已登录
  isLoggedIn() {
    return !!this.getCurrent();
  },

  // 是否是管理员
  isAdmin() {
    const u = this.getCurrent();
    return u && u.role === 'admin';
  },

  // 登出
  logout() {
    localStorage.removeItem(this.KEY);
  },
};

/* ================================================
   曝光记录 DB
   ================================================ */
const DB = {
  /* ---- 数据存储 ---- */

  // 所有提交记录
  getRecords() {
    if (window.API_MODE) {
      const res = apiFetch('/api/records');
      return (res && res.ok ? res.data : null) || JSON.parse(localStorage.getItem('blacklist_records') || '[]');
    }
    return JSON.parse(localStorage.getItem('blacklist_records') || '[]');
  },

  saveRecords(records) {
    localStorage.setItem('blacklist_records', JSON.stringify(records));
  },

  // 添加记录
  addRecord(data) {
    if (window.API_MODE) {
      const res = apiFetch('/api/records', {
        method: 'POST',
        body: {
          gameId: data.gameId,
          name: data.name,
          server: data.server,
          category: data.category,
          reason: data.reason,
          description: data.description,
          evidence: data.evidence || [],
          submitterId: data.submitterId || null
        }
      });
      if (res && res.ok) return res.data;
    }
    const records = JSON.parse(localStorage.getItem('blacklist_records') || '[]');
    records.push({
      id: Date.now().toString(),
      ...data,
      status: 'pending',
      rejectReason: null,
      createdAt: new Date().toISOString(),
      reviewedAt: null,
      reviewedBy: null,
      isControversy: false,
      controversyVotes: 0,
      controversyOpposes: 0,
      controversyVoters: [],
      controversyEndAt: null,
      controversyStatus: null,
    });
    this.saveRecords(records);
    return records[records.length - 1];
  },

  // 更新记录状态
  updateStatus(id, status) {
    if (window.API_MODE) {
      apiFetch(`/api/records/${id}`, { method: 'PUT', body: { status, reviewedBy: '管理员' } });
    }
    const records = JSON.parse(localStorage.getItem('blacklist_records') || '[]');
    const idx = records.findIndex(r => r.id === id);
    if (idx !== -1) {
      records[idx].status = status;
      records[idx].reviewedAt = new Date().toISOString();
      records[idx].reviewedBy = '审核员';
      this.saveRecords(records);
    }
    return records;
  },

  // 删除记录
  deleteRecord(id) {
    if (window.API_MODE) {
      apiFetch(`/api/records/${id}`, { method: 'DELETE' });
    }
    const records = JSON.parse(localStorage.getItem('blacklist_records') || '[]');
    this.saveRecords(records.filter(r => r.id !== id));
  },

  // 获取单条记录
  getRecord(id) {
    if (window.API_MODE) {
      const res = apiFetch(`/api/records/${id}`);
      return (res && res.ok ? res.data : null);
    }
    return this.getRecords().find(r => r.id === id) || null;
  },

  // 更新记录（含管理员打回理由）
  updateRecord(id, data) {
    if (window.API_MODE) {
      apiFetch(`/api/records/${id}`, { method: 'PUT', body: { ...data, reviewedBy: '管理员' } });
    }
    const records = JSON.parse(localStorage.getItem('blacklist_records') || '[]');
    const idx = records.findIndex(r => r.id === id);
    if (idx !== -1) {
      records[idx] = { ...records[idx], ...data, reviewedAt: new Date().toISOString() };
      this.saveRecords(records);
    }
    return records;
  },

  // 获取待审核
  getPending() {
    return this.getRecords().filter(r => r.status === 'pending');
  },

  // 获取已通过（公开）
  getApproved() {
    return this.getRecords().filter(r => r.status === 'approved');
  },

  // 搜索已通过记录
  searchApproved(keyword) {
    if (window.API_MODE) {
      const res = apiFetch(`/api/records/search?keyword=${encodeURIComponent(keyword || '')}`);
      return (res && res.ok ? res.data : []);
    }
    const kw = keyword.trim().toLowerCase();
    if (!kw) return this.getApproved();
    const approved = this.getApproved();
    return approved.filter(r =>
      r.gameId.toLowerCase().includes(kw) ||
      (r.name || '').toLowerCase().includes(kw) ||
      (r.server || '').toLowerCase().includes(kw)
    );
  },

  // 获取已拒绝
  getRejected() {
    return this.getRecords().filter(r => r.status === 'rejected');
  },

  // 统计数据
  getStats() {
    if (window.API_MODE) {
      const res = apiFetch('/api/stats');
      if (res && res.ok) return res.data;
    }
    const records = this.getRecords();
    return {
      total:     records.length,
      pending:   records.filter(r => r.status === 'pending').length,
      approved:  records.filter(r => r.status === 'approved').length,
      rejected:  records.filter(r => r.status === 'rejected').length,
    };
  },

  /* ---- 公告 / 更新日志 ---- */

  getAnnouncements() {
    if (window.API_MODE) {
      const res = apiFetch('/api/announcements');
      return (res && res.ok ? res.data : null) || JSON.parse(localStorage.getItem('announcements') || '[]');
    }
    return JSON.parse(localStorage.getItem('announcements') || '[]');
  },

  saveAnnouncements(items) {
    localStorage.setItem('announcements', JSON.stringify(items));
  },

  addAnnouncement(data) {
    if (window.API_MODE) {
      const res = apiFetch('/api/announcements', { method: 'POST', body: data });
      if (res && res.ok) return res.data;
    }
    const items = this.getAnnouncements();
    items.unshift({
      id: Date.now().toString(),
      ...data,
      createdAt: new Date().toISOString(),
      author: localStorage.getItem('admin_user') || '管理员',
    });
    this.saveAnnouncements(items);
    return items[0];
  },

  deleteAnnouncement(id) {
    if (window.API_MODE) {
      apiFetch(`/api/announcements/${id}`, { method: 'DELETE' });
    }
    const items = this.getAnnouncements();
    this.saveAnnouncements(items.filter(i => i.id !== id));
  },

  updateAnnouncement(id, data) {
    if (window.API_MODE) {
      const res = apiFetch(`/api/announcements/${id}`, { method: 'PUT', body: data });
      if (res && res.ok) return res.data;
    }
    const items = this.getAnnouncements();
    const idx = items.findIndex(i => i.id === id);
    if (idx !== -1) {
      items[idx] = { ...items[idx], ...data, updatedAt: new Date().toISOString() };
      this.saveAnnouncements(items);
    }
    return items;
  },

  // 获取所有黑ID列表（已通过+拒绝的全部记录）
  getAllBlacklist() {
    if (window.API_MODE) {
      const res = apiFetch('/api/records?tab=blacklist');
      return (res && res.ok ? res.data : []);
    }
    return this.getRecords().filter(r => r.status === 'approved' || r.status === 'rejected');
  },

  /* ---- 草稿箱 ---- */

  getDraft() {
    return JSON.parse(localStorage.getItem('exposure_draft') || 'null');
  },

  saveDraft(data) {
    localStorage.setItem('exposure_draft', JSON.stringify({
      ...data,
      savedAt: new Date().toISOString(),
    }));
  },

  clearDraft() {
    localStorage.removeItem('exposure_draft');
  },

  /* ---- 私信系统 ---- */

  getMessages() {
    if (window.API_MODE) {
      const user = SESSION.getCurrent();
      const res = apiFetch(`/api/messages${user ? '?userId=' + user.id : ''}`);
      return (res && res.ok ? res.data : null) || JSON.parse(localStorage.getItem('user_messages') || '[]');
    }
    return JSON.parse(localStorage.getItem('user_messages') || '[]');
  },

  saveMessages(msgs) {
    localStorage.setItem('user_messages', JSON.stringify(msgs));
  },

  addMessage(data) {
    if (window.API_MODE) {
      const res = apiFetch('/api/messages', { method: 'POST', body: data });
      if (res && res.ok) return res.data;
    }
    const msgs = this.getMessages();
    msgs.unshift({
      id: Date.now().toString(),
      ...data,
      isRead: false,
      createdAt: new Date().toISOString(),
    });
    this.saveMessages(msgs);
    return msgs[0];
  },

  markMessageRead(id) {
    if (window.API_MODE) {
      apiFetch('/api/messages/mark-read', { method: 'POST', body: { id } });
    }
    const msgs = this.getMessages();
    const idx = msgs.findIndex(m => m.id === id);
    if (idx !== -1) {
      msgs[idx].isRead = true;
      this.saveMessages(msgs);
    }
  },

  markAllMessagesRead() {
    if (window.API_MODE) {
      const user = SESSION.getCurrent();
      apiFetch('/api/messages/mark-all-read', { method: 'POST', body: { userId: user ? user.id : null } });
    }
    const msgs = this.getMessages();
    msgs.forEach(m => m.isRead = true);
    this.saveMessages(msgs);
  },

  getUnreadCount() {
    const msgs = this.getMessages();
    return msgs.filter(m => !m.isRead).length;
  },

  deleteMessage(id) {
    if (window.API_MODE) {
      apiFetch(`/api/messages/${id}`, { method: 'DELETE' });
    }
    const msgs = this.getMessages();
    this.saveMessages(msgs.filter(m => m.id !== id));
  },

  /* ---- 争议公投 ---- */
  controversyVote(id, action, userId) {
    if (window.API_MODE) {
      const res = apiFetch(`/api/records/${id}/controversy`, { method: 'POST', body: { action, userId } });
      return res && res.ok ? res.data : null;
    }
    return null;
  },

  /* ---- 统计 ---- */
  getBlacklistStats() {
    const records = this.getAllBlacklist();
    return {
      total: records.length,
      byCategory: records.reduce((acc, r) => {
        const cat = r.category || '其他';
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
      }, {}),
      byServer: records.reduce((acc, r) => {
        const sv = r.server || '未知';
        acc[sv] = (acc[sv] || 0) + 1;
        return acc;
      }, {}),
    };
  },

  initSample() {
    // API模式由后端初始化示例数据
    if (window.API_MODE) return;
    if (this.getRecords().length > 0) return;
    const samples = [
      {
        id: '1001', gameId: '小甜超乖', server: '王者荣耀世界',
        category: '正常交易被蹲', reason: '蹲人后拉黑消失',
        description: '在王者荣耀世界蹲人后加了好友，约好一起玩，结果第二天直接拉黑消失，态度极其恶劣。',
        evidence: [], status: 'approved',
        createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
        reviewedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
        reviewedBy: '管理员', rejectReason: null,
      },
      {
        id: '1002', gameId: '乔妹不哭啦', server: '王者荣耀世界',
        category: '卖家是骗子', reason: '以处CP名义骗钱',
        description: '以处CP名义交往，后以各种理由借款，金额超过3000元后拉黑失联。',
        evidence: [], status: 'approved',
        createdAt: new Date(Date.now() - 86400000 * 12).toISOString(),
        reviewedAt: new Date(Date.now() - 86400000 * 10).toISOString(),
        reviewedBy: '管理员', rejectReason: null,
      },
      {
        id: '1003', gameId: '陪玩小甜心', server: '王者荣耀世界',
        category: '恶意陪玩', reason: '收钱后辱骂并挂机',
        description: '下单陪玩后，中途挂机20分钟，重连后态度恶劣并辱骂雇主，严重影响心情。',
        evidence: [], status: 'approved',
        createdAt: new Date(Date.now() - 86400000 * 20).toISOString(),
        reviewedAt: new Date(Date.now() - 86400000 * 18).toISOString(),
        reviewedBy: '管理员', rejectReason: null,
      },
      {
        id: '1004', gameId: '靠谱代练王', server: '王者荣耀世界',
        category: '骗钱骗物', reason: '代练收钱后不服务',
        description: '说好代打段位，付款后以各种理由拖延，三天后直接消失，账号密码全部拉黑。',
        evidence: [], status: 'pending',
        createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
        reviewedAt: null, reviewedBy: null, rejectReason: null,
      },
      {
        id: '1005', gameId: '王者小哥哥9', server: '王者荣耀世界',
        category: '恶意放鸽子', reason: '约好陪玩后无故消失',
        description: '约好晚上陪打排位，提前说好价格，临到时间点突然消失不回消息，浪费了宝贵时间。',
        evidence: [], status: 'pending',
        createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
        reviewedAt: null, reviewedBy: null, rejectReason: null,
      },
      {
        id: '1006', gameId: '测试路人甲', server: '王者荣耀世界',
        category: '情感诈骗', reason: '假装恋爱骗钱',
        description: '在游戏里假装处CP，交往一段时间后以各种理由借款2000元后拉黑。',
        evidence: [], status: 'rejected',
        createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
        reviewedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        reviewedBy: '管理员', rejectReason: '证据不足，无法核实具体情况',
      },
    ];
    this.saveRecords(samples);

    if (this.getAnnouncements().length === 0) {
      const defaultAnnouncements = [
        {
          id: 'a001',
          type: 'announcement',
          title: '欢迎来到王者曝光台 🫶',
          content: '欢迎大家使用王者曝光台！本平台旨在为王者荣耀世界玩家提供曝光骗子、蹲人等违规行为的互助平台。我们倡导真实曝光、善意互助，共同维护良好的游戏社交环境。希望大家都能在这里找到帮助，也请各位在提交曝光时确保内容真实、证据充分哦～',
          isPinned: true,
          createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
          author: '管理员',
        },
        {
          id: 'a002',
          type: 'announcement',
          title: '关于平台立场的重要说明',
          content: `【关于ID交易的说明】\n\n近期有很多小伙伴问我们，为什么要做这个曝光平台，是不是官方支持的？\n\n这里统一说明一下：这是玩家自发搭建的互助平台，官方是不参与、不管理ID交易纠纷的。正因为如此，我们在平台上曝光的行为，也和官方完全无关 —— 我们只是玩家与玩家之间互相提醒的小工具～\n\n【我们的态度】\n我们只记录客观事实，不站队、不偏袒。证据充分的曝光会审核通过，虚假信息一律不收录。我们相信，真实的曝光本身就是最有力量的声音，而不是靠我们站出来"替谁说话"。\n\n最后，欢迎大家正常使用，善意互助。如有疑问，欢迎私信联系管理员`,
          createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
          author: '管理员',
        },
        {
          id: 'a003',
          type: 'update',
          title: 'v1.1.0 更新：举报功能优化',
          content: '1. 新增公告与更新日志模块\n2. 优化了搜索算法，结果更精准\n3. 修复了若干已知问题\n4. 提升了移动端显示效果',
          createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
          author: '管理员',
        },
        {
          id: 'a004',
          type: 'announcement',
          title: '关于规范曝光内容的公告',
          content: '近期收到部分用户反馈，平台将加强对曝光内容的审核力度。请各位在提交曝光时确保内容真实有效，附上充分的证据截图。我们将对虚假曝光行为严肃处理。',
          createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
          author: '管理员',
        },
      ];
      this.saveAnnouncements(defaultAnnouncements);
    }
  },
};

/* ---- Toast 提示 ---- */
function showToast(message, type = 'info', duration = 2500) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

/* ---- 格式化时间 ---- */
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1)   return '刚刚';
  if (mins < 60)  return `${mins} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  return `${days} 天前`;
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

/* ---- 分类标签颜色映射 ---- */
const CATEGORY_TAG = {
  '蹲人曝光':   { label: '蹲人曝光',   cls: 'tag-red'    },
  '骗子曝光':   { label: '骗子曝光',   cls: 'tag-red'    },
  '情感诈骗':   { label: '情感诈骗',   cls: 'tag-red'    },
  '骗钱骗物':   { label: '骗钱骗物',   cls: 'tag-red'    },
  '恶意放鸽子': { label: '恶意放鸽子', cls: 'tag-orange' },
  '恶意陪玩':   { label: '恶意陪玩',   cls: 'tag-orange' },
  '争议举报':   { label: '争议举报',   cls: 'tag-blue'   },
  '其他':       { label: '其他',       cls: 'tag-yellow' },
  // 表单提交时的分类名称（与筛选器匹配）
  '正常交易被蹲': { label: '蹲人曝光', cls: 'tag-red'    },
  '卖家是骗子':   { label: '骗子曝光', cls: 'tag-red'    },
};

/* ---- 渲染违规卡片 ---- */
function renderResultCard(record) {
  const cat = CATEGORY_TAG[record.category] || CATEGORY_TAG['其他'];
  const evidenceHTML = (record.evidence || []).map((e, i) => {
    const src = typeof e === 'string' ? e : e.src;
    return `<img src="${src}" alt="证据截图" loading="lazy" onclick="window.showResultImg && window.showResultImg('${src}')" style="cursor:pointer;">`;
  }).join('');

  return `
    <div class="result-card glass-card" data-id="${record.id}">
      <div class="result-card-header">
        <div>
          <div class="result-card-id">${escapeHtml(record.gameId)}</div>
          <div class="result-card-name">${escapeHtml(record.server || '未知服务器')} · ${escapeHtml(record.name || '')}</div>
        </div>
        <span class="result-card-tag ${cat.cls}">${cat.label}</span>
      </div>
      <div class="result-card-desc">${escapeHtml(record.description)}</div>
      <div class="result-card-footer">
        <span class="result-card-meta">${timeAgo(record.createdAt)}</span>
        ${evidenceHTML ? `<div class="review-card-evidence" style="margin:0;display:flex;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none;gap:6px;padding-bottom:2px;">${evidenceHTML}</div>` : ''}
      </div>
    </div>
  `;
}

/* ---- 渲染公告/更新日志卡片 ---- */
function renderAnnouncementCard(item) {
  const tag = ANNOUNCEMENT_TAG[item.type] || ANNOUNCEMENT_TAG['announcement'];
  const pinnedClass = item.isPinned ? ' pinned-card' : '';
  return `
    <div class="announcement-card${pinnedClass} glass-card" data-id="${item.id}" onclick="openAnnModal('${item.id}')">
      <div class="announcement-card-header">
        <span class="announcement-tag ${tag.cls}">
          ${tag.icon}
          ${tag.label}
        </span>
        <span class="announcement-time">${timeAgo(item.createdAt)}</span>
      </div>
      <div class="announcement-title">${item.isPinned ? '<span style="color:#E88AAA;font-weight:700;">📌 </span>' : ''}${escapeHtml(item.title)}</div>
    </div>
  `;
}

/* ---- 公告详情弹窗 ---- */
function openAnnModal(id) {
  const item = DB.getAnnouncements().find(i => i.id === id);
  if (!item) return;
  const tag = ANNOUNCEMENT_TAG[item.type] || ANNOUNCEMENT_TAG['announcement'];
  const overlay = document.getElementById('annModalOverlay');
  const content = document.getElementById('annModalContent');
  content.innerHTML = `
    <div class="ann-modal-header">
      <span class="announcement-tag ${tag.cls}">
        ${tag.icon}
        ${tag.label}
      </span>
      <span class="announcement-time">${timeAgo(item.createdAt)}</span>
    </div>
    <div class="ann-modal-title">${escapeHtml(item.title)}</div>
    <div class="ann-modal-body">${escapeHtml(item.content).replace(/\n/g, '<br>')}</div>
  `;
  overlay.classList.add('show');
}

function closeAnnModal() {
  document.getElementById('annModalOverlay').classList.remove('show');
}

window.openAnnModal = openAnnModal;
window.closeAnnModal = closeAnnModal;
window.renderAnnouncementCard = renderAnnouncementCard;

/* ---- HTML转义 ---- */
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ---- 生成UUID ---- */
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/* ---- 导航滚动效果 ---- */
function initNav() {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  });
}

/* ---- 设置当前导航高亮 ---- */
function setActiveNav(page) {
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    const isActive = href === page || (page === 'index.html' && href === 'index.html');
    a.classList.toggle('active', isActive);
  });
}

/* ---- 导出供其他页面使用 ---- */
window.DB = DB;
window.DB_USERS = DB_USERS;
window.SESSION = SESSION;
window.showToast = showToast;
window.timeAgo = timeAgo;
window.formatDate = formatDate;
window.escapeHtml = escapeHtml;
window.renderResultCard = renderResultCard;
window.initNav = initNav;
window.setActiveNav = setActiveNav;
window.ANNOUNCEMENT_TAG = ANNOUNCEMENT_TAG;
window.CATEGORY_TAG = CATEGORY_TAG;
window.stripEmoji = stripEmoji;
window.hasEmoji = hasEmoji;
window.EMOJI_PATTERN = EMOJI_PATTERN;
window.apiFetch = apiFetch;
window.uploadImagesAsync = uploadImagesAsync;
window.switchTab = function(tab, btn) {
  window.currentTab = tab;
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');

  // 切换面板显示
  const listContainer = document.getElementById('listContainer');
  const batchActions = document.getElementById('batchActions');
  const annPanel = document.getElementById('announcementPanel');
  const msgPanel = document.getElementById('messagesPanel');
  const controversyPanel = document.getElementById('controversyPanel');
  const usersPanel = document.getElementById('usersPanel');

  if (listContainer) listContainer.style.display = 'none';
  if (batchActions) batchActions.style.display = 'none';
  if (annPanel) annPanel.style.display = 'none';
  if (msgPanel) msgPanel.style.display = 'none';
  if (controversyPanel) controversyPanel.style.display = 'none';
  if (usersPanel) usersPanel.style.display = 'none';

  if (tab === 'announcement') {
    if (annPanel) { annPanel.style.display = 'block'; if (typeof renderAnnList === 'function') renderAnnList(); }
  } else if (tab === 'blacklist') {
    if (listContainer) { listContainer.style.display = 'block'; if (typeof renderList === 'function') renderList(); }
  } else if (tab === 'messages') {
    if (msgPanel) { msgPanel.style.display = 'block'; if (typeof renderAdminMsgList === 'function') renderAdminMsgList(); }
  } else if (tab === 'controversy') {
    if (controversyPanel) { controversyPanel.style.display = 'block'; if (typeof renderControversyList === 'function') renderControversyList(); }
  } else if (tab === 'users') {
    if (usersPanel) { usersPanel.style.display = 'block'; if (typeof renderUserList === 'function') renderUserList(); }
  } else {
    if (listContainer) listContainer.style.display = 'block';
    if (batchActions) batchActions.style.display = tab === 'pending' ? 'flex' : 'none';
    if (typeof renderList === 'function') renderList();
  }

  window.selectedIds.clear();
  const selectAllEl = document.getElementById('selectAll');
  if (selectAllEl) selectAllEl.checked = false;
};
window.currentTab = 'pending';
window.selectedIds = new Set();

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  DB.initSample();
  DB_USERS.initAdmin(); // 初始化默认管理员
  initNav();
});
