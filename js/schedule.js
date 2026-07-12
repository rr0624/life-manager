// 日程模块 — 时间线优先 + 周/月同步

const SchedulePage = {
  currentView: 'calendar',
  currentDate: new Date(),
  calendarMonth: new Date(),
  listFilter: 'today',       // 列表默认显示今天

  // ===== 渲染页面 =====
  async render() {
    const container = document.getElementById('page-schedule');
    if (!container) return;

    const today = Utils.formatDate();
    const yesterday = Utils.formatDate(new Date(Date.now() - 86400000));
    const tomorrow = Utils.formatDate(new Date(Date.now() + 86400000));

    container.innerHTML = `
      <!-- 视图切换 — 三栏平行 -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div class="view-toggle" id="view-toggle" style="flex:1;">
          <button data-view="calendar" class="active">📅 日历</button>
          <button data-view="timeline">🕐 时间线</button>
          <button data-view="list">📋 列表</button>
        </div>
        <button class="btn btn-sm btn-primary" id="btn-sync-open" title="同步日程" style="margin-left:10px;">🔄</button>
        <button class="btn btn-sm btn-primary" id="btn-new-schedule" title="新建日程" style="margin-left:6px;">+ 新建</button>
      </div>

      <!-- 时间线视图 — 默认显示 -->
      <div id="timeline-view"></div>

      <!-- 列表视图 -->
      <div id="list-view" style="display:none;"></div>

      <!-- 日历视图 -->
      <div id="calendar-view" style="display:none;"></div>

      <!-- 空状态 -->
      <div id="schedules-empty" class="empty-state" style="display:none;">
        <div class="empty-icon">📅</div>
        <p>暂无日程安排<br>点击右下角 + 或时间线空槽快速创建</p>
      </div>
    `;

    this._bindEvents();
    this._switchView();  // 确保默认视图可见
    await this.refresh();
  },

  async refresh() {
    if (this.currentView === 'calendar') await this._renderCalendar();
    else if (this.currentView === 'timeline') await this._renderTimeline();
    else if (this.currentView === 'list') await this._loadSchedules();
  },

  // ===== 事件绑定 =====
  _bindEvents() {
    // 视图切换
    const viewToggle = document.getElementById('view-toggle');
    if (viewToggle) {
      viewToggle.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        viewToggle.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentView = btn.dataset.view;
        this._switchView();
      });
    }

    // 同步按钮
    const syncBtn = document.getElementById('btn-sync-open');
    if (syncBtn) {
      syncBtn.addEventListener('click', () => this._showSyncModal());
    }
    const newBtn = document.getElementById('btn-new-schedule');
    if (newBtn) {
      newBtn.addEventListener('click', () => this.showCreateModal());
    }
  },

  _switchView() {
    const timelineView = document.getElementById('timeline-view');
    const listView = document.getElementById('list-view');
    const calendarView = document.getElementById('calendar-view');

    if (timelineView) timelineView.style.display = this.currentView === 'timeline' ? 'block' : 'none';
    if (listView) listView.style.display = this.currentView === 'list' ? 'block' : 'none';
    if (calendarView) calendarView.style.display = this.currentView === 'calendar' ? 'block' : 'none';

    this.refresh();
  },

  // ================================================================
  //  时间线视图（默认优先）
  // ================================================================
  async _renderTimeline() {
    const container = document.getElementById('timeline-view');
    if (!container) return;

    const today = Utils.formatDate(this.currentDate);
    const yesterday = Utils.formatDate(new Date(this.currentDate.getTime() - 86400000));
    const tomorrow = Utils.formatDate(new Date(this.currentDate.getTime() + 86400000));
    const weekday = Utils.weekDayNames[this.currentDate.getDay()];

    const schedules = await DB.getSchedulesByDate(today);

    // 映射到小时
    const hourMap = {};
    for (let h = 5; h <= 23; h++) hourMap[h] = [];
    schedules.forEach(s => {
      const hour = s.time ? parseInt(s.time.split(':')[0]) : null;
      if (hour && hourMap[hour]) hourMap[hour].push(s);
    });

    const allDaySchedules = schedules.filter(s => !s.time);
    const currentHour = new Date().getHours();
    const isToday = today === Utils.formatDate();

    container.innerHTML = `
      <!-- 日期导航 -->
      <div class="flex-middle flex-gap-8 mb-16">
        <button class="btn btn-sm btn-ghost" id="btn-prev-day" title="前一天">◀ 前一天</button>
        <div class="timeline-date-nav-center">
          <div class="timeline-date-label">
            ${isToday ? '📌 今天' : today}
          </div>
          <div class="timeline-weekday-label">${weekday}</div>
        </div>
        <button class="btn btn-sm btn-ghost" id="btn-next-day" title="后一天">后一天 ▶</button>
      </div>

      <!-- 快捷跳转 -->
      <div class="flex flex-wrap flex-gap-6 mb-12">
        <button class="btn btn-sm btn-ghost quick-jump" data-jump="today" style="${isToday ? 'background:var(--primary-light);color:var(--primary);font-weight:var(--fw-semibold);' : ''}">今天</button>
        <button class="btn btn-sm btn-ghost quick-jump" data-jump="tomorrow">明天</button>
      </div>

      <!-- 时间线 -->
      <div class="timeline-card">
        <div class="timeline-header timeline-section">
          <div class="timeline-header-title">🕐 时间线</div>
        </div>
        <!-- 全天日程并入时间线顶部 -->
        ${allDaySchedules.length > 0 ? `
          <div class="timeline-all-day">
            <div class="section-title">全天</div>
            ${allDaySchedules.map(s => this._renderScheduleItem(s)).join('')}
          </div>
        ` : ''}
        <div class="time-slots">
          ${Object.entries(hourMap).map(([hour, items]) => {
            const isCurrentHour = parseInt(hour) === currentHour && isToday;
            return `
            <div class="time-slot ${items.length > 0 ? 'has-event' : ''} ${isCurrentHour ? 'active-hour' : ''}"
                 data-hour="${hour}" data-date="${today}">
              <span class="time-label">${String(hour).padStart(2, '0')}:00</span>
              <div class="flex-1">
                ${items.length === 0
                  ? `<span class="text-xs text-tertiary-color">—</span>`
                  : items.map(s => `
                    <div class="schedule-item timeline-schedule-item" data-id="${s.id}">
                      <button class="schedule-check ${s.completed ? 'done' : ''}" data-toggle="${s.id}">
                        ${s.completed ? '✓' : ''}
                      </button>
                      <div class="flex-1">
                        <div class="timeline-schedule-title${s.completed ? ' completed' : ''}">${Utils.escapeHtml(s.title)}</div>
                      </div>
                      <span class="timeline-schedule-time">${s.time ? (s.timeEnd ? s.time + '-' + s.timeEnd : s.time) : ''}</span>
                      <button class="btn-icon btn-delete-schedule" data-delete="${s.id}" aria-label="删除日程" title="删除" style="font-size:13px;">🗑️</button>
                    </div>
                  `).join('')
                }
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    `;

    this._bindScheduleItemEvents(container);

    // 日期导航事件
    container.querySelector('#btn-prev-day')?.addEventListener('click', () => {
      this.currentDate = new Date(this.currentDate.getTime() - 86400000);
      this._renderTimeline();
    });
    container.querySelector('#btn-next-day')?.addEventListener('click', () => {
      this.currentDate = new Date(this.currentDate.getTime() + 86400000);
      this._renderTimeline();
    });

    // 快捷跳转
    container.querySelectorAll('.quick-jump').forEach(btn => {
      btn.addEventListener('click', () => {
        const today = new Date();
        if (btn.dataset.jump === 'today') this.currentDate = today;
        else if (btn.dataset.jump === 'tomorrow') this.currentDate = new Date(today.getTime() + 86400000);
        this._renderTimeline();
      });
    });

    // 点击空时间槽创建日程
    container.querySelectorAll('.time-slot').forEach(slot => {
      slot.addEventListener('click', (e) => {
        if (e.target.closest('.schedule-item') || e.target.closest('.schedule-check')) return;
        this.showCreateModal({
          date: slot.dataset.date,
          time: `${String(slot.dataset.hour).padStart(2, '0')}:00`
        });
      });
    });
  },

  // ================================================================
  //  列表视图
  // ================================================================
  async _loadSchedules() {
    const container = document.getElementById('list-view');
    if (!container) return;

    const today = Utils.formatDate();
    const filter = this.listFilter || 'today';

    // 日期筛选栏
    const filterBar = `
      <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;align-items:center;">
        <button class="btn btn-sm ${filter==='today'?'btn-primary':'btn-ghost'}" data-list-filter="today">今天</button>
        <button class="btn btn-sm ${filter==='week'?'btn-primary':'btn-ghost'}" data-list-filter="week">本周</button>
        <button class="btn btn-sm ${filter==='all'?'btn-primary':'btn-ghost'}" data-list-filter="all">全部</button>
        <input id="list-custom-date" class="input" type="date" value="${this.currentDate.toISOString().slice(0,10)}" style="width:130px;padding:6px 8px;font-size:12px;display:${filter==='custom'?'block':'none'};">
        <button class="btn btn-sm btn-ghost" data-list-filter="custom" style="font-size:11px;">📅 自选</button>
      </div>`;

    // 根据筛选条件获取日程
    let schedules;
    if (filter === 'today') {
      schedules = await DB.getSchedulesByDate(Utils.formatDate(this.currentDate));
    } else if (filter === 'week') {
      const week = Utils.getWeekRange(this.currentDate);
      schedules = await DB.getSchedulesByDateRange(week.start, week.end);
    } else if (filter === 'custom') {
      schedules = await DB.getSchedulesByDate(Utils.formatDate(this.currentDate));
    } else {
      // all
      schedules = await DB.getAll('schedules');
    }

    schedules.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));

    // 渲染
    if (schedules.length === 0) {
      container.innerHTML = filterBar + '<div class="empty-state"><div class="empty-icon">📋</div><p>暂无日程</p></div>';
    } else if (filter === 'today') {
      container.innerHTML = filterBar + `
        <div class="section-title">${Utils.formatDate(this.currentDate) === today ? '📌 今天' : Utils.formatDate(this.currentDate)}</div>
        ${schedules.map(s => this._renderScheduleItem(s)).join('')}`;
    } else {
      const grouped = {};
      schedules.forEach(s => { if (!grouped[s.date]) grouped[s.date] = []; grouped[s.date].push(s); });
      container.innerHTML = filterBar + Object.keys(grouped).sort().map(date => `
        <div class="section-title">${date === today ? '📌 今天' : date === Utils.formatDate(new Date(Date.now()+86400000)) ? '📅 明天' : date}</div>
        ${grouped[date].map(s => this._renderScheduleItem(s)).join('')}
      `).join('');
    }

    this._bindScheduleItemEvents(container);

    // 筛选按钮事件
    container.querySelectorAll('[data-list-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.listFilter = btn.dataset.listFilter;
        if (this.listFilter === 'custom') {
          const dateInput = container.querySelector('#list-custom-date');
          dateInput.style.display = 'block';
          dateInput.focus();
        }
        this._loadSchedules();
      });
    });
    const customDateInput = container.querySelector('#list-custom-date');
    if (customDateInput) {
      customDateInput.addEventListener('change', () => {
        this.currentDate = new Date(customDateInput.value + 'T00:00:00');
        this._loadSchedules();
      });
    }
  },

  // ================================================================
  //  日历视图
  // ================================================================
  async _renderCalendar() {
    const container = document.getElementById('calendar-view');
    if (!container) return;

    const year = this.calendarMonth.getFullYear();
    const month = this.calendarMonth.getMonth() + 1;
    const today = Utils.formatDate();
    const selectedDate = Utils.formatDate(this.currentDate);

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${Utils.daysInMonth(year, month)}`;
    const schedules = await DB.getSchedulesByDateRange(startDate, endDate);

    const schedulesByDate = {};
    schedules.forEach(s => {
      if (!schedulesByDate[s.date]) schedulesByDate[s.date] = [];
      schedulesByDate[s.date].push(s);
    });

    const daysInMonth = Utils.daysInMonth(year, month);
    const firstDay = Utils.firstDayOfMonth(year, month);

    let daysHtml = '';
    for (let i = 0; i < firstDay; i++) {
      daysHtml += '<div class="calendar-day other-month"></div>';
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = dateStr === today;
      const isSelected = dateStr === selectedDate;
      const hasSchedule = schedulesByDate[dateStr] && schedulesByDate[dateStr].length > 0;
      daysHtml += `
        <button class="calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${hasSchedule ? 'has-schedule' : ''}"
                data-date="${dateStr}">${d}</button>`;
    }

    container.innerHTML = `
      <div class="calendar-nav">
        <button id="btn-prev-month" class="btn btn-sm btn-ghost">◀</button>
        <span class="month-label">${year}年 ${month}月</span>
        <button id="btn-next-month" class="btn btn-sm btn-ghost">▶</button>
      </div>
      <div class="calendar-weekdays">
        ${Utils.weekDayNames.map(d => `<span>${d}</span>`).join('')}
      </div>
      <div class="calendar-days">${daysHtml}</div>
      <div class="section-title">📌 ${selectedDate} 日程</div>
      <div id="selected-date-schedules"></div>
    `;

    // 月份切换
    container.querySelector('#btn-prev-month').addEventListener('click', () => {
      this.calendarMonth.setMonth(this.calendarMonth.getMonth() - 1);
      this._renderCalendar();
    });
    container.querySelector('#btn-next-month').addEventListener('click', () => {
      this.calendarMonth.setMonth(this.calendarMonth.getMonth() + 1);
      this._renderCalendar();
    });

    // 日期点击
    container.querySelectorAll('.calendar-day').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentDate = new Date(btn.dataset.date + 'T00:00:00');
        this._renderCalendar();
      });
    });

    await this._renderDateSchedules(selectedDate, schedulesByDate[selectedDate] || []);
  },

  async _renderDateSchedules(date, schedules) {
    const container = document.getElementById('selected-date-schedules');
    if (!container) return;
    if (schedules.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-tertiary);font-size:var(--fs-caption);">当天暂无日程</div>';
      return;
    }
    schedules.sort((a, b) => (a.time || '23:59').localeCompare(b.time || '23:59'));
    container.innerHTML = schedules.map(s => this._renderScheduleItem(s)).join('');
    this._bindScheduleItemEvents(container);
  },

  // ================================================================
  //  日程项渲染（含分支标记点）
  // ================================================================
  _renderScheduleItem(schedule) {
    return `
      <div class="schedule-item ${schedule.completed ? 'completed' : ''}">
        <button class="schedule-check ${schedule.completed ? 'done' : ''}" data-toggle="${schedule.id}" aria-label="标记完成">
          ${schedule.completed ? '✓' : ''}
        </button>
        <div class="schedule-info">
          <div class="schedule-title">${Utils.escapeHtml(schedule.title)}</div>
          ${schedule.description ? `<div class="schedule-desc">${Utils.escapeHtml(Utils.truncate(schedule.description, 60))}</div>` : ''}
          ${schedule.sourceRecordId ? '<span style="font-size:10px;color:var(--text-tertiary);display:inline-block;">📝 来源于记录</span>' : ''}
        </div>
        <div class="schedule-meta">
          <span>${schedule.time ? (schedule.timeEnd ? schedule.time + ' - ' + schedule.timeEnd : schedule.time) : ''}</span>
        </div>
        <button class="btn-icon btn-delete-schedule" data-delete="${schedule.id}" aria-label="删除日程" title="删除">🗑️</button>
      </div>`;
  },

  // 绑定日程项事件
  _bindScheduleItemEvents(container) {
    // 标记完成
    container.querySelectorAll('.schedule-check').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.toggle);
        await this._toggleComplete(id);
      });
    });
    // 删除按钮
    container.querySelectorAll('.btn-delete-schedule').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.delete);
        const ok = await Utils.showConfirm('删除日程', '确定删除这条日程吗？此操作不可撤销。', { danger: true });
        if (!ok) return;
        await DB.delete('schedules', id);
        await this.refresh();
        if (typeof App !== 'undefined') App._showToast('日程已删除', { type: 'success' });
      });
    });
  },

  async _toggleComplete(id) {
    const schedule = await DB.getById('schedules', id);
    if (!schedule) return;
    schedule.completed = !schedule.completed;
    await DB.put('schedules', schedule);
    await this.refresh();
  },

  _hourOpts(timeStr) {
    const h = timeStr ? timeStr.split(':')[0] : '';
    let o = '<option value="">时</option>';
    for (let i = 0; i <= 23; i++) { const v = String(i).padStart(2, '0'); o += `<option value="${v}" ${v===h?'selected':''}>${v}</option>`; }
    return o;
  },
  _minOpts(timeStr) {
    const m = timeStr ? timeStr.split(':')[1] : '';
    let o = '<option value="">分</option>';
    for (let i = 0; i < 60; i += 5) { const v = String(i).padStart(2, '0'); o += `<option value="${v}" ${v===m?'selected':''}>${v}</option>`; }
    return o;
  },

  // ================================================================
  //  同步弹窗 — 自选日期范围 + 周/月快捷键
  // ================================================================
  _showSyncModal() {
    const thisWeek = Utils.getWeekRange();
    const nextWeek = Utils.getNextWeekRange();
    const thisMonth = Utils.getMonthRange();
    const nextMonth = Utils.getNextMonthRange();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-height:90vh;">
        <div class="modal-header">
          <div class="modal-title">🔄 同步日程</div>
          <button class="modal-close">✕</button>
        </div>
        <div class="modal-body" style="padding-bottom:16px;">
          <div style="display:flex;gap:8px;align-items:flex-end;margin-bottom:10px;">
            <div style="flex:1;">
              <label style="font-size:11px;color:var(--text-tertiary);">复制源 从</label>
              <input id="sync-from" class="input" type="date" value="${thisWeek.start}" style="padding:8px 10px;font-size:13px;">
            </div>
            <span style="padding-bottom:8px;color:var(--text-tertiary);">→</span>
            <div style="flex:1;">
              <label style="font-size:11px;color:var(--text-tertiary);">到</label>
              <input id="sync-to" class="input" type="date" value="${thisWeek.end}" style="padding:8px 10px;font-size:13px;">
            </div>
          </div>
          <div style="margin-bottom:10px;">
            <label style="font-size:11px;color:var(--text-tertiary);">复制到（起始日）</label>
            <input id="sync-target" class="input" type="date" value="${nextWeek.start}" style="padding:8px 10px;font-size:13px;">
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;">
            <button class="btn btn-sm btn-ghost sync-shortcut" data-from="${thisWeek.start}" data-to="${thisWeek.end}" data-target="${nextWeek.start}">📆 本周→下周</button>
            <button class="btn btn-sm btn-ghost sync-shortcut" data-from="${thisMonth.start}" data-to="${thisMonth.end}" data-target="${nextMonth.start}">📅 本月→下月</button>
          </div>
          <div style="display:flex;gap:8px;margin-bottom:6px;align-items:center;">
            <button class="btn btn-sm btn-ghost" id="btn-select-all">☑ 全选</button>
            <button class="btn btn-sm btn-ghost" id="btn-select-none">☐ 取消</button>
            <span style="flex:1;text-align:right;font-size:12px;color:var(--text-tertiary);" id="sync-count"></span>
          </div>
          <div id="sync-schedule-list" style="max-height:180px;overflow-y:auto;margin-bottom:12px;"></div>
          <button class="btn btn-primary btn-block" id="btn-sync-execute">🚀 同步选中日程</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    let sourceSchedules = [];
    const checkedState = {};

    const closeModal = () => overlay.remove();
    overlay.querySelector('.modal-close').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

    const fromEl = overlay.querySelector('#sync-from');
    const toEl = overlay.querySelector('#sync-to');
    const targetEl = overlay.querySelector('#sync-target');

    const loadList = async () => {
      const from = fromEl.value, to = toEl.value;
      sourceSchedules = await DB.getSchedulesByDateRange(from, to);
      sourceSchedules.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
      sourceSchedules.forEach(s => { if (!(s.id in checkedState)) checkedState[s.id] = true; });

      const listEl = overlay.querySelector('#sync-schedule-list');
      const countEl = overlay.querySelector('#sync-count');

      const updateCount = () => {
        const checked = sourceSchedules.filter(s => checkedState[s.id]).length;
        countEl.textContent = sourceSchedules.length ? `已选 ${checked}/${sourceSchedules.length}` : '';
      };

      if (sourceSchedules.length === 0) {
        listEl.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-tertiary);font-size:13px;">该区间暂无日程</div>';
        countEl.textContent = '';
        return;
      }

      updateCount();
      listEl.innerHTML = sourceSchedules.map(s => `
        <label class="sync-item" style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:8px;cursor:pointer;">
          <input type="checkbox" data-sid="${s.id}" ${checkedState[s.id] ? 'checked' : ''} style="flex-shrink:0;">
          <span style="flex:1;min-width:0;font-size:13px;">
            <span style="color:var(--text-primary);">${Utils.escapeHtml(s.title)}</span>
            <span style="color:var(--text-tertiary);font-size:11px;margin-left:4px;">${s.date} ${s.time || ''}</span>
          </span>
        </label>
      `).join('');

      listEl.querySelectorAll('input[type=checkbox]').forEach(cb => {
        cb.addEventListener('change', () => {
          checkedState[parseInt(cb.dataset.sid)] = cb.checked;
          updateCount();
        });
      });
    };

    loadList();

    overlay.querySelectorAll('.sync-shortcut').forEach(btn => {
      btn.addEventListener('click', () => {
        fromEl.value = btn.dataset.from;
        toEl.value = btn.dataset.to;
        targetEl.value = btn.dataset.target;
        for (const k in checkedState) delete checkedState[k];
        loadList();
      });
    });

    fromEl.addEventListener('change', () => { for (const k in checkedState) delete checkedState[k]; loadList(); });
    toEl.addEventListener('change', () => { for (const k in checkedState) delete checkedState[k]; loadList(); });

    overlay.querySelector('#btn-select-all').addEventListener('click', () => {
      sourceSchedules.forEach(s => checkedState[s.id] = true);
      loadList();
    });
    overlay.querySelector('#btn-select-none').addEventListener('click', () => {
      sourceSchedules.forEach(s => checkedState[s.id] = false);
      loadList();
    });

    overlay.querySelector('#btn-sync-execute').addEventListener('click', async () => {
      const selected = sourceSchedules.filter(s => checkedState[s.id]);
      if (selected.length === 0) { App._showToast('请至少选择一条日程'); return; }

      const from = new Date(fromEl.value + 'T00:00:00');
      const target = new Date(targetEl.value + 'T00:00:00');
      const offsetDays = Math.round((target.getTime() - from.getTime()) / 86400000);

      const existingEnd = new Date(target);
      existingEnd.setDate(existingEnd.getDate() + Math.round((new Date(toEl.value + 'T00:00:00').getTime() - from.getTime()) / 86400000));
      const existing = await DB.getSchedulesByDateRange(targetEl.value, Utils.formatDate(existingEnd));

      let copied = 0;
      for (const s of selected) {
        const sDate = new Date(s.date + 'T00:00:00');
        sDate.setDate(sDate.getDate() + offsetDays);
        const newDate = Utils.formatDate(sDate);
        if (existing.find(e => e.title === s.title && e.date === newDate)) continue;
        await DB.add('schedules', {
          ...s, id: undefined, date: newDate, completed: false,
          syncedWeekDays: [], createdAt: new Date().toISOString()
        });
        copied++;
      }

      closeModal();
      App._showToast(`同步完成 ✓ 已复制 ${copied} 项`);
      this.refresh();
    });
  },

  // ================================================================
  //  创建/编辑日程弹窗
  // ================================================================
  async showCreateModal(preset = {}) {
    const isEdit = !!preset.id;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">${isEdit ? '编辑日程' : '新建日程'}</div>
          <button class="modal-close">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">标题</label>
            <input id="sched-title" class="input" value="${Utils.escapeHtml(preset.title || '')}" placeholder="日程标题...">
          </div>
          <!-- AI 快捷提示词 -->
          <div id="sched-prompts" style="margin-bottom:12px;"></div>
          <div class="form-group">
            <label class="form-label">描述（可选）</label>
            <textarea id="sched-desc" class="textarea" rows="2" placeholder="补充说明">${Utils.escapeHtml(preset.description || '')}</textarea>
          </div>
          <div style="display:flex;gap:12px;">
            <div class="form-group" style="flex:1;">
              <label class="form-label">日期</label>
              <div style="display:flex;gap:6px;align-items:center;">
                <input id="sched-date" class="input" type="date" value="${preset.date || Utils.formatDate(this.currentDate)}" style="flex:1;">
                <button class="btn btn-sm btn-ghost quick-date-btn" data-date="${Utils.formatDate()}">今天</button>
                <button class="btn btn-sm btn-ghost quick-date-btn" data-date="${Utils.formatDate(new Date(Date.now()+86400000))}">明天</button>
              </div>
            </div>
          </div>
          <div style="margin-bottom:12px;">
            <label class="form-label">开始时间 <span style="font-weight:var(--fw-normal);color:var(--text-tertiary);font-size:11px;">（可选）</span></label>
            <div style="display:flex;gap:4px;">
              <select id="sched-time-h" class="input" style="flex:1;">${this._hourOpts(preset.time)}</select>
              <span style="line-height:42px;color:var(--text-tertiary);flex-shrink:0;">:</span>
              <select id="sched-time-m" class="input" style="flex:1;">${this._minOpts(preset.time)}</select>
            </div>
          </div>
          <div style="margin-bottom:12px;">
            <label class="form-label">结束时间 <span style="font-weight:var(--fw-normal);color:var(--text-tertiary);font-size:11px;">（可选）</span></label>
            <div style="display:flex;gap:4px;">
              <select id="sched-time-end-h" class="input" style="flex:1;">${this._hourOpts(preset.timeEnd)}</select>
              <span style="line-height:42px;color:var(--text-tertiary);flex-shrink:0;">:</span>
              <select id="sched-time-end-m" class="input" style="flex:1;">${this._minOpts(preset.timeEnd)}</select>
            </div>
          </div>
          <button class="btn btn-primary btn-block" id="btn-save-schedule">
            ${isEdit ? '更新日程' : '保存日程'}
          </button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    // 快速日期按钮
    overlay.querySelectorAll('.quick-date-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelector('#sched-date').value = btn.dataset.date;
      });
    });


    const closeModal = () => overlay.remove();
    overlay.querySelector('.modal-close').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

    // 【核心】保存按钮 — 必须最先绑定，确保保存功能始终可用
    overlay.querySelector('#btn-save-schedule').addEventListener('click', async () => {
      try {
        const titleEl = overlay.querySelector('#sched-title');
        const descEl = overlay.querySelector('#sched-desc');
        const dateEl = overlay.querySelector('#sched-date');
        const timeH = overlay.querySelector('#sched-time-h');
        const timeM = overlay.querySelector('#sched-time-m');
        const timeEndH = overlay.querySelector('#sched-time-end-h');
        const timeEndM = overlay.querySelector('#sched-time-end-m');

        if (!titleEl || !dateEl) {
          console.error('保存失败：找不到表单元素');
          if (typeof App !== 'undefined') App._showToast('保存失败，请刷新页面重试');
          return;
        }

        const title = titleEl.value.trim();
        const description = descEl ? descEl.value.trim() : '';
        const date = dateEl.value;
        const time = (timeH && timeM && timeH.value && timeM.value) ? timeH.value + ':' + timeM.value : '';
        const timeEnd = (timeEndH && timeEndM && timeEndH.value && timeEndM.value) ? timeEndH.value + ':' + timeEndM.value : '';

        if (!title) { alert('请输入日程标题'); return; }
        if (!date) { alert('请选择日期'); return; }

        const scheduleData = {
          title, description, date, time, timeEnd,
          completed: preset.completed || false,
          sourceRecordId: preset.sourceRecordId || null,
          branches: preset.branches || [],
          createdAt: preset.createdAt || new Date().toISOString()
        };

        if (isEdit) {
          scheduleData.id = preset.id;
          await DB.put('schedules', scheduleData);
        } else {
          await DB.add('schedules', scheduleData);
        }

        closeModal();
        await this.refresh();

        if (typeof App !== 'undefined') App._showToast(isEdit ? '日程已更新 ✓' : '日程已创建 ✓');
      } catch (err) {
        console.error('保存日程失败:', err);
        if (typeof App !== 'undefined') App._showToast('保存失败: ' + err.message);
      }
    });

    // AI 提示词（非关键功能，失败不影响保存）
    try {
      const promptsEl = overlay.querySelector('#sched-prompts');
      const titleInput = overlay.querySelector('#sched-title');
      const descInput = overlay.querySelector('#sched-desc');
      let debounceTimer = null;
      let selectedPromptTitle = '';

      if (promptsEl && titleInput && descInput) {
        const renderPrompts = (query) => {
          try {
            const prompts = AI.suggestSchedulePrompts(query);
            if (!prompts.length) { promptsEl.innerHTML = ''; return; }
            promptsEl.innerHTML = `
              <label class="form-label">💡 快捷填充</label>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                ${prompts.map(p => {
                  const isActive = selectedPromptTitle === p.title;
                  return `
                  <button class="chip-prompt${isActive ? ' chip-active' : ''}"
                          data-title="${Utils.escapeHtml(p.title)}"
                          data-desc="${Utils.escapeHtml(p.desc)}">
                    <span>${p.icon}</span> ${p.title}
                  </button>`;
                }).join('')}
              </div>`;
            promptsEl.querySelectorAll('.chip-prompt').forEach(chip => {
              chip.addEventListener('click', () => {
                titleInput.value = chip.dataset.title;
                descInput.value = chip.dataset.desc;
                selectedPromptTitle = chip.dataset.title;
                renderPrompts(titleInput.value.trim());
              });
            });
          } catch (e) { console.warn('AI提示词渲染失败:', e); }
        };

        renderPrompts('');

        titleInput.addEventListener('input', () => {
          clearTimeout(debounceTimer);
          if (titleInput.value !== selectedPromptTitle) selectedPromptTitle = '';
          debounceTimer = setTimeout(() => renderPrompts(titleInput.value.trim()), 200);
        });
      }
    } catch (e) { console.warn('AI提示词初始化失败:', e); }
  }
};
