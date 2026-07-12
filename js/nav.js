// 底部导航 Tab 组件

const Nav = {
  currentTab: 'records',  // 默认展示日常记录

  // 渲染导航栏
  render() {
    const nav = document.getElementById('bottom-nav');
    if (!nav) return;

    const tabs = [
      { key: 'schedule', label: '日程', icon: '📅' },
      { key: 'goals', label: '目标', icon: '🎯' },
      { key: 'records', label: '记录', icon: '📝' }
    ];

    nav.innerHTML = `
      <div class="nav-bg"></div>
      ${tabs.map(t => `
        <button class="nav-item ${this.currentTab === t.key ? 'active' : ''}"
                data-tab="${t.key}" aria-label="${t.label}">
          <span class="nav-icon">${t.icon}</span>
          ${t.label}
        </button>
      `).join('')}
    `;

    // 绑定点击事件
    nav.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });
  },

  // 切换 Tab
  switchTab(tabKey) {
    if (this.currentTab === tabKey) return;
    this.currentTab = tabKey;

    // 更新导航高亮
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabKey);
    });

    // 切换页面（只切换三个主页，不影响抽屉）
    document.querySelectorAll('#page-schedule, #page-goals, #page-records').forEach(p => {
      p.classList.remove('active');
    });
    const page = document.getElementById(`page-${tabKey}`);
    if (page) page.classList.add('active');

    // 通知对应页面刷新（安全调用）
    if (tabKey === 'schedule' && typeof SchedulePage !== 'undefined') SchedulePage.refresh();
    if (tabKey === 'goals' && typeof GoalsPage !== 'undefined') GoalsPage.refresh();
    if (tabKey === 'records' && typeof RecordsPage !== 'undefined') RecordsPage.refresh();

    // 更新 FAB 按钮
    this.updateFab(tabKey);
  },

  // 根据当前 Tab 更新浮动操作按钮
  updateFab(tabKey) {
    const fab = document.getElementById('fab-btn');
    if (!fab) return;

    const config = {
      schedule: { icon: '+', label: '新建日程' },
      goals: { icon: '+', label: '新建目标' }
    };

    const c = config[tabKey];
    if (!c) { fab.style.display = 'none'; return; }
    fab.style.display = 'flex';

    fab.querySelector('.fab-icon').textContent = c.icon;
    fab.setAttribute('aria-label', c.label);

    // 移除旧事件（克隆节点）
    const newFab = fab.cloneNode(true);
    fab.parentNode.replaceChild(newFab, fab);

    newFab.addEventListener('click', () => {
      if (tabKey === 'schedule' && typeof SchedulePage !== 'undefined') SchedulePage.showCreateModal();
      if (tabKey === 'goals' && typeof GoalsPage !== 'undefined') GoalsPage.showCreateModal();
      if (tabKey === 'records' && typeof RecordsPage !== 'undefined') RecordsPage.focusInput();
    });
  }
};
