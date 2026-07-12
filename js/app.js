// 应用初始化入口

const App = {
  _drawerOpen: false,

  async init() {
    // 1. 初始化主题
    this._initTheme();

    // 2. 初始化数据库
    try {
      await DB.init();
      console.log('LocalStorage 初始化完成');
    } catch (err) {
      console.error('数据库初始化失败:', err);
      alert('应用初始化失败，请刷新页面重试。');
      return;
    }

    // 3. 渲染页面骨架
    this._renderShell();

    // 4. 渲染导航
    Nav.render();

    // 5. 渲染各页面
    try { await SchedulePage.render(); } catch (e) { console.warn('日程页渲染失败:', e); }
    try { await GoalsPage.render(); } catch (e) { console.warn('目标页渲染失败:', e); }
    try { await RecordsPage.render(); } catch (e) { console.warn('记录页渲染失败:', e); }

    // 6. 初始化 FAB
    Nav.updateFab(Nav.currentTab);

    // 7. 注册 Service Worker
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('./sw.js');
        console.log('Service Worker 注册成功');
      } catch (err) {
        console.warn('Service Worker 注册失败:', err);
      }
    }

    // 8. 键盘弹出时隐藏导航
    if (window.visualViewport) {
      const vv = window.visualViewport;
      const h = window.innerHeight;
      vv.addEventListener('resize', () => {
        const nav = document.getElementById('bottom-nav');
        const fab = document.getElementById('fab-btn');
        if (!nav) return;
        if (h - vv.height > 60) {
          nav.style.display = 'none';
          if (fab) fab.style.display = 'none';
        } else {
          nav.style.display = '';
          if (fab) fab.style.display = '';
        }
      });
    }

    // 9. 处理 PWA 安装提示
    this._handleInstallPrompt();

    console.log('应用初始化完成 ✓');
  },

  // ===== 主题初始化 =====
  _initTheme() {
    const settings = DB.getSettings();
    const theme = settings.theme || 'auto';

    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    // 'auto' → 不设置属性，让 CSS media query 自动决定
  },

  _setTheme(mode) {
    const root = document.documentElement;
    if (mode === 'auto') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', mode);
    }
    DB.saveSettings({ theme: mode });
  },

  // ===== 渲染 Shell =====
  _renderShell() {
    const app = document.getElementById('app');
    if (!app) return;

    app.innerHTML = `
      <!-- 头部 -->
      <header class="app-header">
        <button class="header-btn header-btn-left" id="btn-install-app" aria-label="安装应用" title="安装到桌面">📲</button>
        <h1>生活管理</h1>
        <div class="subtitle">日 程 · 目 标 · 记 录</div>
        <div class="header-actions">
          <button class="header-btn" id="btn-theme-toggle" aria-label="主题切换" title="主题切换">🌓</button>
          <button class="header-btn" id="btn-settings" aria-label="设置" title="设置">⚙</button>
        </div>
      </header>

      <!-- 页面容器 -->
      <div class="page-container" id="page-container">
        <div id="page-schedule" class="page ${Nav.currentTab === 'schedule' ? 'active' : ''}"></div>
        <div id="page-goals" class="page ${Nav.currentTab === 'goals' ? 'active' : ''}"></div>
        <div id="page-records" class="page ${Nav.currentTab === 'records' ? 'active' : ''}"></div>
      </div>

      <!-- 底部导航 -->
      <nav class="bottom-nav" id="bottom-nav"></nav>

      <!-- 浮动操作按钮 -->
      <button class="fab" id="fab-btn" aria-label="新建">
        <span class="fab-icon">+</span>
      </button>

      <!-- Toast 容器 -->
      <div class="toast" id="toast"></div>
    `;

    // 安装按钮 → 显示安装引导
    document.getElementById('btn-install-app').addEventListener('click', () => {
      this._showInstallGuide();
    });

    // 设置按钮 → 打开抽屉
    document.getElementById('btn-settings').addEventListener('click', () => {
      this._openDrawer();
    });

    // 主题切换按钮
    document.getElementById('btn-theme-toggle').addEventListener('click', () => {
      this._cycleTheme();
    });
  },

  // ===== 主题循环切换 =====
  _cycleTheme() {
    const current = DB.getSettings().theme || 'auto';
    const order = ['auto', 'light', 'dark'];
    const next = order[(order.indexOf(current) + 1) % order.length];
    this._setTheme(next);

    const labels = { auto: '🌓 自动', light: '☀️ 浅色', dark: '🌙 深色' };
    this._showToast(`主题：${labels[next]}`);
  },

  // ===== Drawer 抽屉（Bug修复：替代原页面切换） =====
  _openDrawer() {
    if (this._drawerOpen) return;
    this._drawerOpen = true;

    // 移除旧抽屉（如有）
    const existing = document.querySelector('.drawer-overlay');
    if (existing) existing.remove();

    const settings = DB.getSettings();
    const currentTheme = settings.theme || 'auto';

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.innerHTML = `
      <div class="drawer" id="settings-drawer">
        <div class="drawer-header">
          <div class="drawer-title">⚙ 设置</div>
          <button class="modal-close" id="btn-drawer-close">✕</button>
        </div>
        <div class="drawer-body">
          <!-- 主题切换 -->
          <div class="settings-section">
            <div class="settings-section-title">🎨 主题</div>
            <div class="theme-toggle" id="drawer-theme-toggle">
              <button class="theme-toggle-btn ${currentTheme === 'auto' ? 'active' : ''}" data-theme="auto" title="跟随系统">🌓</button>
              <button class="theme-toggle-btn ${currentTheme === 'light' ? 'active' : ''}" data-theme="light" title="浅色">☀️</button>
              <button class="theme-toggle-btn ${currentTheme === 'dark' ? 'active' : ''}" data-theme="dark" title="深色">🌙</button>
            </div>
            <div class="settings-hint">浅色/深色/跟随系统自动切换</div>
          </div>

          <!-- AI 配置 -->
          <div class="settings-section">
            <div class="settings-section-title">🤖 AI 配置</div>
            <div class="glass-card" style="padding:16px;">
              <div class="form-group">
                <label class="form-label">API 密钥</label>
                <input id="setting-api-key" class="input" type="text"
                       value="${Utils.escapeHtml(settings.aiApiKey || '')}"
                       placeholder="sk-..." autocomplete="off" spellcheck="false" autocorrect="off" autocapitalize="off">
                <div class="settings-hint">密钥仅保存在本地浏览器</div>
              </div>
              <div class="form-group">
                <label class="form-label">API 接口地址</label>
                <input id="setting-api-url" class="input"
                       value="${Utils.escapeHtml(settings.aiApiUrl || '')}"
                       placeholder="https://api.deepseek.com/v1/chat/completions">
                <div class="settings-hint">留空使用默认 DeepSeek 接口</div>
              </div>
              <button class="btn btn-primary btn-block" id="btn-save-settings">💾 保存配置</button>
              <button class="btn btn-sm btn-ghost btn-block" id="btn-reset-api" style="margin-top:6px;">🔄 恢复默认接口</button>
            </div>
          </div>

          <!-- 数据管理 -->
          <div class="settings-section">
            <div class="settings-section-title">📦 数据管理</div>
            <div class="glass-card" style="padding:16px;">
              <button class="btn btn-outline btn-block" id="btn-export-data">📥 导出数据 (JSON)</button>
              <button class="btn btn-outline btn-block" id="btn-import-data" style="margin-top:8px;">📤 导入数据 (JSON)</button>
              <input type="file" id="import-file-input" accept=".json" style="display:none;">
              <div class="settings-hint" style="margin-top:10px;">导出备份；导入将覆盖当前数据</div>
            </div>
          </div>

          <!-- 关于 -->
          <div class="settings-section">
            <div class="settings-section-title">ℹ️ 关于</div>
            <div class="glass-card" style="padding:16px;text-align:center;">
              <p style="font-weight:var(--fw-semibold);margin-bottom:4px;">生活管理 · Life Manager</p>
              <p style="font-size:var(--fs-caption);color:var(--text-secondary);">纯前端 PWA · 本地存储 · DeepSeek AI</p>
              <p style="font-size:11px;color:var(--text-tertiary);margin-top:6px;">数据完全存储在您的浏览器中</p>
            </div>
          </div>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    // 绑定事件
    this._bindDrawerEvents(overlay);

    // 关闭：点击遮罩
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this._closeDrawer();
    });
  },

  _closeDrawer() {
    const overlay = document.querySelector('.drawer-overlay');
    if (overlay) {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 150ms ease';
      setTimeout(() => overlay.remove(), 150);
    }
    this._drawerOpen = false;
  },

  _bindDrawerEvents(overlay) {
    // 关闭按钮
    overlay.querySelector('#btn-drawer-close').addEventListener('click', () => this._closeDrawer());

    // 主题切换
    overlay.querySelectorAll('.theme-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.theme;
        this._setTheme(mode);
        // 更新高亮
        overlay.querySelectorAll('.theme-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // 保存设置（Bug修复：先Toast后关闭，异步后置）
    overlay.querySelector('#btn-save-settings').addEventListener('click', () => {
      const apiKey = overlay.querySelector('#setting-api-key').value.trim();
      const apiUrl = overlay.querySelector('#setting-api-url').value.trim();
      DB.saveSettings({ aiApiKey: apiKey, aiApiUrl: apiUrl });
      if (typeof AI !== 'undefined') AI.clearChat();
      this._showToast('设置已保存 ✓');
      // 延迟关闭，让用户看到 Toast
      setTimeout(() => this._closeDrawer(), 600);
    });

    // 恢复默认接口
    overlay.querySelector('#btn-reset-api').addEventListener('click', () => {
      overlay.querySelector('#setting-api-url').value = '';
      DB.saveSettings({ aiApiUrl: '' });
      this._showToast('已恢复默认接口 ✓');
    });

    // 导出数据
    overlay.querySelector('#btn-export-data').addEventListener('click', () => {
      const data = DB.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `life-manager-backup-${Utils.formatDate()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this._showToast('数据已导出 ✓');
    });

    // 导入数据
    const fileInput = overlay.querySelector('#import-file-input');
    overlay.querySelector('#btn-import-data').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!confirm('导入数据将覆盖当前所有数据，确定继续吗？')) return;
        await DB.importAll(data);
        this._showToast('数据已导入 ✓ 页面即将刷新...');
        setTimeout(() => location.reload(), 1500);
      } catch (err) {
        alert('导入失败：' + err.message);
      }
      fileInput.value = '';
    });
  },

  // ===== 安装引导 — 轻提示不遮盖UI =====
  _showInstallGuide() {
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const tip = document.createElement('div');
    tip.style.cssText = `
      position:fixed; top:60px; left:50%; transform:translateX(-50%); z-index:300;
      background:var(--glass-bg-strong); backdrop-filter:blur(12px);
      border-radius:12px; padding:14px 18px; max-width:280px; width:90%;
      box-shadow:0 4px 24px rgba(0,0,0,0.12); text-align:center;
      font-size:13px; line-height:1.7; animation:toastIn 0.2s ease-out;
    `;
    tip.innerHTML = isIOS
      ? `<b>📲 安装到桌面</b><br>点击 Safari 底部 <b style="background:#007aff;color:#fff;padding:1px 6px;border-radius:3px;">分享</b> → 添加到主屏幕<br><span style="color:var(--text-tertiary);font-size:11px;">键盘不再挤压页面</span>`
      : `<b>📲 安装到桌面</b><br>点击浏览器 <b>⋮</b> 菜单 → 添加到桌面<br><span style="color:var(--text-tertiary);font-size:11px;">键盘不再挤压页面</span>`;
    document.body.appendChild(tip);
    tip.addEventListener('click', () => tip.remove());
    setTimeout(() => { if (tip.parentNode) tip.remove(); }, 5000);
  },

  // ===== PWA 安装提示 =====
  _handleInstallPrompt() {
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      const banner = document.createElement('div');
      banner.style.cssText = `
        position:fixed; top:0; left:50%; transform:translateX(-50%); z-index:300;
        max-width:480px; width:100%;
        padding:14px 20px;
        background:var(--glass-bg-strong);
        backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
        display:flex; align-items:center; justify-content:space-between;
        gap:12px; font-size:14px;
        box-shadow:var(--depth-3); border-bottom:var(--glass-border);
      `;
      banner.innerHTML = `
        <span style="font-size:13px;">📱 安装到桌面，随时使用</span>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-sm btn-primary" id="btn-install">安装</button>
          <button class="btn btn-sm btn-ghost" id="btn-dismiss-install">忽略</button>
        </div>
      `;
      document.body.appendChild(banner);
      banner.querySelector('#btn-install').addEventListener('click', async () => {
        deferredPrompt.prompt();
        const result = await deferredPrompt.userChoice;
        console.log('安装结果:', result.outcome);
        deferredPrompt = null;
        banner.remove();
      });
      banner.querySelector('#btn-dismiss-install').addEventListener('click', () => banner.remove());
      setTimeout(() => banner.remove(), 3 * 86400000);
    });
  },


  // ===== Toast =====
  _showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2000);
  }
};

// DOM 加载完成后启动
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.init());
} else {
  App.init();
}
