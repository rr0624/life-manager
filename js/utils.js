// 工具函数模块

const Utils = {
  // 格式化日期 YYYY-MM-DD
  formatDate(d) {
    const date = d ? new Date(d) : new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  // 格式化时间 HH:mm
  formatTime(d) {
    const date = d ? new Date(d) : new Date();
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  },

  // 格式化 ISO 时间戳为友好显示
  formatFriendly(iso) {
    const d = new Date(iso);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
    return this.formatDate(d) + ' ' + this.formatTime(d);
  },

  // 获取当前月份 YYYY-MM
  currentMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  },

  // 获取某月天数
  daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  },

  // 获取某月第一天是周几 (0=周日)
  firstDayOfMonth(year, month) {
    return new Date(year, month - 1, 1).getDay();
  },

  // 获取本周一日期
  mondayOfWeek(date) {
    const d = new Date(date || new Date());
    const day = d.getDay() || 7;
    d.setDate(d.getDate() - day + 1);
    return this.formatDate(d);
  },

  // 获取本周日日期
  sundayOfWeek(date) {
    const d = new Date(date || new Date());
    const day = d.getDay() || 7;
    d.setDate(d.getDate() - day + 7);
    return this.formatDate(d);
  },

  // 获取一周所有日期
  weekDates(date) {
    const monday = this.mondayOfWeek(date);
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      dates.push(this.formatDate(d));
    }
    return dates;
  },

  // 周几名称
  weekDayNames: ['日', '一', '二', '三', '四', '五', '六'],

  // 六大分类配置
  categories: [
    { id: 1, name: '学习', icon: '📚', color: 'var(--cat-learning)', key: 'learning' },
    { id: 2, name: '事业', icon: '💼', color: 'var(--cat-career)', key: 'career' },
    { id: 3, name: '物质资产', icon: '💰', color: 'var(--cat-material)', key: 'material' },
    { id: 4, name: '健康', icon: '💚', color: 'var(--cat-health)', key: 'health' },
    { id: 5, name: '娱乐心愿', icon: '🎉', color: 'var(--cat-entertainment)', key: 'entertainment' },
    { id: 6, name: '情感人际', icon: '💝', color: 'var(--cat-relationship)', key: 'relationship' }
  ],

  // 根据 category id 获取配置
  getCategory(id) {
    return this.categories.find(c => c.id === id) || this.categories[0];
  },

  // HTML 转义
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  // 截断文本
  truncate(str, len = 40) {
    if (!str) return '';
    return str.length > len ? str.slice(0, len) + '...' : str;
  },

  // 防抖
  debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  // 生成唯一 ID (fallback)
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  },

  // ===== 周/月同步时间计算（Bug修复：统一日期工具） =====

  // 获取本周完整起止日期
  getWeekRange(date) {
    const d = date ? new Date(date) : new Date();
    const monday = this.mondayOfWeek(d);
    const sunday = this.sundayOfWeek(d);
    return { start: monday, end: sunday };
  },

  // 获取下周完整起止日期
  getNextWeekRange(date) {
    const d = date ? new Date(date) : new Date();
    const monday = new Date(this.mondayOfWeek(d));
    monday.setDate(monday.getDate() + 7);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    return { start: this.formatDate(monday), end: this.formatDate(sunday) };
  },

  // 获取当月完整起止日期
  getMonthRange(date) {
    const d = date ? new Date(date) : new Date();
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end = `${year}-${String(month).padStart(2, '0')}-${this.daysInMonth(year, month)}`;
    return { start, end };
  },

  // 获取下月完整起止日期
  getNextMonthRange(date) {
    const d = date ? new Date(date) : new Date();
    let year = d.getFullYear();
    let month = d.getMonth() + 2; // 下个月
    if (month > 12) { month = 1; year++; }
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end = `${year}-${String(month).padStart(2, '0')}-${this.daysInMonth(year, month)}`;
    return { start, end };
  },

  // 格式化日期范围显示
  formatDateRange(start, end) {
    return `${start} → ${end}`;
  },

  // 自定义确认弹窗 — 替代原生 confirm()
  showConfirm(title, message, { confirmText = '确定', cancelText = '取消', danger = false } = {}) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.innerHTML = `
        <div class="confirm-dialog">
          <div class="confirm-dialog-title">${title}</div>
          <div class="confirm-dialog-message">${message}</div>
          <div class="confirm-dialog-actions">
            <button class="btn btn-ghost btn-sm btn-confirm-cancel">${cancelText}</button>
            <button class="btn btn-sm ${danger ? 'btn-danger' : 'btn-primary'} btn-confirm-ok">${confirmText}</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const cleanup = (result) => {
        overlay.remove();
        resolve(result);
      };
      overlay.querySelector('.btn-confirm-cancel').addEventListener('click', () => cleanup(false));
      overlay.querySelector('.btn-confirm-ok').addEventListener('click', () => cleanup(true));
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cleanup(false);
      });
    });
  }
};
