// 本地存储模块 — 基于 LocalStorage
const DB = {
  _prefix: 'lm_',

  _key(name) { return this._prefix + name; },

  _read(name) {
    try {
      const raw = localStorage.getItem(this._key(name));
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  _write(name, data) {
    localStorage.setItem(this._key(name), JSON.stringify(data));
  },

  // ===== 初始化 =====
  init() {
    const defaults = {
      goals: [],
      records: [],
      schedules: [],
      reviews: [],
      diaryCards: [],
      excerpts: [],
      settings: {
        aiApiUrl: '',
        aiApiKey: '',
        theme: 'light'
      }
    };
    for (const [k, v] of Object.entries(defaults)) {
      if (this._read(k) === null) this._write(k, v);
    }
    return Promise.resolve();
  },

  // ===== 通用 CRUD =====
  getAll(store) {
    return Promise.resolve(this._read(store) || []);
  },

  getById(store, id) {
    const list = this._read(store) || [];
    return Promise.resolve(list.find(item => item.id === id) || null);
  },

  async add(store, item) {
    const list = this._read(store) || [];
    const newItem = { ...item, id: Date.now(), createdAt: item.createdAt || new Date().toISOString() };
    list.push(newItem);
    this._write(store, list);
    return newItem.id;
  },

  async put(store, item) {
    const list = this._read(store) || [];
    const idx = list.findIndex(x => x.id === item.id);
    if (idx >= 0) {
      list[idx] = { ...item, updatedAt: new Date().toISOString() };
    } else {
      list.push({ ...item, updatedAt: new Date().toISOString() });
    }
    this._write(store, list);
    return item.id;
  },

  async delete(store, id) {
    const list = this._read(store) || [];
    this._write(store, list.filter(x => x.id !== id));
  },

  // ===== 过滤查询 =====
  async getByFilter(store, fn) {
    const list = this._read(store) || [];
    return list.filter(fn);
  },

  // ===== 别名（兼容旧 API） =====
  async get(store, id) {
    return this.getById(store, id);
  },

  // ===== 专项查询 =====
  async getGoalsByCategory(cat) {
    return this.getByFilter('goals', g => g.category === cat);
  },

  async getSchedulesByDate(date) {
    return this.getByFilter('schedules', s => s.date === date);
  },

  async getSchedulesByDateRange(start, end) {
    return this.getByFilter('schedules', s => s.date >= start && s.date <= end);
  },

  async getDiaryCardsByDate(date) {
    return this.getByFilter('diaryCards', d => d.date === date);
  },

  // ===== 聊天历史 =====
  saveChatMessages(messages) {
    this._write('chatMessages', messages);
  },
  loadChatMessages() {
    return this._read('chatMessages') || [];
  },

  // ===== 设置 =====
  getSettings() {
    return this._read('settings') || { aiApiUrl: '', aiApiKey: '' };
  },

  saveSettings(s) {
    this._write('settings', { ...this.getSettings(), ...s });
  },

  // ===== 数据导出导入 =====
  exportAll() {
    const data = {};
    for (const k of ['goals','records','schedules','reviews','diaryCards','excerpts','chatMessages','settings']) {
      data[k] = this._read(k);
    }
    data._version = 2;
    data._exportedAt = new Date().toISOString();
    return data;
  },

  async importAll(data) {
    if (!data || data._version !== 2) throw new Error('数据格式不兼容');
    for (const k of ['goals','records','schedules','reviews','diaryCards','excerpts','chatMessages','settings']) {
      if (data[k] !== undefined) this._write(k, data[k]);
    }
    return true;
  }
};
