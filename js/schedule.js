// 日程模块 — 时间线优先 + 周/月同步

const SchedulePage = {
  currentView: 'timeline',   // 默认时间线
  currentDate: new Date(),
  calendarMonth: new Date(),

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
          <button data-view="timeline" class="active">🕐 时间线</button>
          <button data-view="list">📋 列表</button>
          <button data-view="calendar">📅 日历</button>
        </div>
        <button class="btn btn-sm btn-primary" id="btn-sync-open" title="同步日程" style="margin-left:10px;">🔄</button>
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
    await this.refresh();
  },

  async refresh() {
    // 渲染当前活跃视图
    if (this.currentView === 'timeline') await this._renderTimeline();
    else if (this.currentView === 'list') await this._loadSchedules();
    else if (this.currentView === 'calendar') await this._renderCalendar();
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
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
        <button class="btn btn-sm btn-ghost" id="btn-prev-day" title="前一天">◀ 前一天</button>
        <div style="flex:1;text-align:center;">
          <div style="font-size:var(--fs-heading);font-weight:var(--fw-semibold);color:var(--text-primary);">
            ${isToday ? '📌 今天' : today}
          </div>
          <div style="font-size:var(--fs-caption);color:var(--text-tertiary);">${weekday}</div>
        </div>
        <button class="btn btn-sm btn-ghost" id="btn-next-day" title="后一天">后一天 ▶</button>
      </div>

      <!-- 快捷跳转 -->
      <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;">
        <button class="btn btn-sm btn-ghost quick-jump" data-jump="today" style="${isToday ? 'background:var(--primary-light);color:var(--primary);font-weight:var(--fw-semibold);' : ''}">今天</button>
        <button class="btn btn-sm btn-ghost quick-jump" data-jump="tomorrow">明天</button>
        <button class="btn btn-sm btn-ghost quick-jump" data-jump="this-week">本周</button>
      </div>

      <!-- 全天日程 -->
      ${allDaySchedules.length > 0 ? `
        <div style="margin-bottom:16px;">
          <div class="section-title">全天</div>
          ${allDaySchedules.map(s => this._renderScheduleItem(s)).join('')}
        </div>
      ` : ''}

      <!-- 时间线卡片 -->
      <div class="timeline-card">
        <div class="timeline-header" style="margin:-20px -20px 16px -20px;padding:16px 20px;">
          <div class="timeline-header-title">🕐 时间线</div>
        </div>
        <div class="time-slots">
          ${Object.entries(hourMap).map(([hour, items]) => {
            const isCurrentHour = parseInt(hour) === currentHour && isToday;
            return `
            <div class="time-slot ${items.length > 0 ? 'has-event' : ''}"
                 data-hour="${hour}" data-date="${today}"
                 style="${isCurrentHour ? 'background:var(--primary-light);border-radius:var(--radius-sm);' : ''}">
              <span class="time-label">${String(hour).padStart(2, '0')}:00</span>
              <div style="flex:1;">
                ${items.length === 0
                  ? `<span style="color:var(--text-tertiary);font-size:var(--fs-caption);">—</span>`
                  : items.map(s => `
                    <div class="schedule-item" data-id="${s.id}" style="margin-bottom:3px;padding:8px 10px;box-shadow:none;">
                      <button class="schedule-check ${s.completed ? 'done' : ''}" data-toggle="${s.id}">
                        ${s.completed ? '✓' : ''}
                      </button>
                      <div style="flex:1;min-width:0;">
                        <div style="font-size:var(--fs-small);font-weight:var(--fw-medium);${s.completed ? 'text-decoration:line-through;opacity:0.5;' : ''}">${Utils.escapeHtml(s.title)}</div>
                      </div>
                      <span style="font-size:var(--fs-caption);color:var(--text-tertiary);margin-right:4px;">${s.time ? (s.timeEnd ? s.time + '-' + s.timeEnd : s.time) : ''}</span>
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
        switch (btn.dataset.jump) {
          case 'today': this.currentDate = today; break;
          case 'tomorrow': this.currentDate = new Date(today.getTime() + 86400000); break;
          case 'this-week':
            this.currentDate = today;
            this.currentView = 'list';
            document.querySelectorAll('#view-toggle button').forEach(b => {
              b.classList.toggle('active', b.dataset.view === 'list');
            });
            this._switchView();
            return;
        }
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
    const emptyEl = document.getElementById('schedules-empty');
    if (!container) return;

    // 隐藏其他视图的空状态
    if (emptyEl) emptyEl.style.display = 'none';

    const today = Utils.formatDate(this.currentDate);
    const endDate = Utils.formatDate(new Date(this.currentDate.getTime() + 7 * 86400000));
    const allSchedules = await DB.getSchedulesByDateRange(today, endDate);

    const grouped = {};
    allSchedules.forEach(s => {
      if (!grouped[s.date]) grouped[s.date] = [];
      grouped[s.date].push(s);
    });

    const sortedDates = Object.keys(grouped).sort();

    if (sortedDates.length === 0) {
      container.innerHTML = '';
      // 不在这里显示空状态，统一处理
      return;
    }

    container.innerHTML = sortedDates.map(date => {
      const items = grouped[date];
      items.sort((a, b) => (a.time || '23:59').localeCompare(b.time || '23:59'));

      let label = date;
      const tomorrowDate = Utils.formatDate(new Date(Date.now() + 86400000));
      if (date === today) label = '📌 今天';
      else if (date === tomorrowDate) label = '📅 明天';

      return `
        <div class="section-title">${label}</div>
        ${items.map(s => this._renderScheduleItem(s)).join('')}
      `;
    }).join('');

    this._bindScheduleItemEvents(container);
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
        if (!confirm('确定删除这条日程吗？')) return;
        await DB.delete('schedules', id);
        await this.refresh();
        if (typeof App !== 'undefined') App._showToast('日程已删除 🗑️');
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

  // ================================================================
  //  同步弹窗（周同步 + 月同步）
  // ================================================================
  _showSyncModal() {
    const today = Utils.formatDate();

    // 【Bug修复】计算完整本周 & 下周范围
    const thisWeek = Utils.getWeekRange();
    const nextWeek = Utils.getNextWeekRange();
    // 当月 & 下月范围
    const thisMonth = Utils.getMonthRange();
    const nextMonth = Utils.getNextMonthRange();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">🔄 同步日程</div>
          <button class="modal-close">✕</button>
        </div>
        <div class="modal-body">
          <!-- 同步类型选择 -->
          <div class="sync-type-chips" id="sync-type-chips" style="margin-bottom:10px;">
            <button class="sync-chip active-weekly" data-type="weekly">📆 周同步</button>
            <button class="sync-chip" data-type="monthly">📅 月同步</button>
          </div>

          <!-- 同步预览 -->
          <div class="sync-preview" id="sync-preview" style="font-size:12px;padding:8px 12px;">
            <span id="sync-preview-text">本周 ${thisWeek.start} → ${thisWeek.end}<br>复制到 下周 ${nextWeek.start} → ${nextWeek.end}</span>
          </div>

          <button class="btn btn-primary btn-block" id="btn-sync-execute" style="margin-top:12px;">
            🚀 开始同步
          </button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    let syncType = 'weekly';

    const closeModal = () => overlay.remove();
    overlay.querySelector('.modal-close').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

    // 同步类型切换
    const typeChips = overlay.querySelector('#sync-type-chips');
    const previewText = overlay.querySelector('#sync-preview-text');
    typeChips.addEventListener('click', (e) => {
      const chip = e.target.closest('.sync-chip');
      if (!chip) return;
      syncType = chip.dataset.type;
      typeChips.querySelectorAll('.sync-chip').forEach(c => {
        c.classList.remove('active-weekly', 'active-monthly');
      });
      chip.classList.add(syncType === 'weekly' ? 'active-weekly' : 'active-monthly');

      if (syncType === 'weekly') {
        previewText.innerHTML = `本周 ${thisWeek.start} → ${thisWeek.end}<br>复制到 下周 ${nextWeek.start} → ${nextWeek.end}`;
      } else {
        previewText.innerHTML = `本月 ${thisMonth.start} → ${thisMonth.end}<br>复制到 下月 ${nextMonth.start} → ${nextMonth.end}`;
      }
    });

    // 执行同步
    overlay.querySelector('#btn-sync-execute').addEventListener('click', async () => {
      const progressBar = overlay.querySelector('#sync-progress');
      const progressFill = progressBar.querySelector('.progress-fill');
      progressBar.style.display = 'block';
      progressFill.style.width = '0%';

      // 进度动画
      setTimeout(() => { progressFill.style.width = '30%'; }, 100);
      setTimeout(() => { progressFill.style.width = '70%'; }, 400);

      let sourceStart, sourceEnd, targetStart, targetEnd;
      if (syncType === 'weekly') {
        sourceStart = thisWeek.start; sourceEnd = thisWeek.end;
        targetStart = nextWeek.start; targetEnd = nextWeek.end;
      } else {
        sourceStart = thisMonth.start; sourceEnd = thisMonth.end;
        targetStart = nextMonth.start; targetEnd = nextMonth.end;
      }

      // 获取源区间日程
      const sourceSchedules = await DB.getSchedulesByDateRange(sourceStart, sourceEnd);

      if (sourceSchedules.length === 0) {
        setTimeout(() => { progressFill.style.width = '100%'; }, 600);
        setTimeout(() => {
          closeModal();
          App._showToast('源区间暂无日程，无需同步');
        }, 900);
        return;
      }

      // 获取目标区间已有日程（查重）
      const targetExisting = await DB.getSchedulesByDateRange(targetStart, targetEnd);

      let copied = 0;
      for (const s of sourceSchedules) {
        const origDate = new Date(s.date + 'T00:00:00');
        const offsetDays = syncType === 'weekly' ? 7 : Utils.daysInMonth(
          parseInt(sourceStart.split('-')[0]), parseInt(sourceStart.split('-')[1])
        );
        origDate.setDate(origDate.getDate() + offsetDays);
        const newDate = Utils.formatDate(origDate);

        // 边界检查：确保在目标区间内
        if (newDate < targetStart || newDate > targetEnd) {
          // 对于月同步，需要精确计算目标月日期
          const sDate = new Date(s.date + 'T00:00:00');
          const sYear = sDate.getFullYear();
          const sMonth = sDate.getMonth();
          const sDay = sDate.getDate();
          const tYear = targetStart.split('-')[0];
          const tMonth = targetStart.split('-')[1];
          const tDaysInMonth = Utils.daysInMonth(parseInt(tYear), parseInt(tMonth));
          const targetDay = Math.min(sDay, tDaysInMonth);
          const adjustedDate = `${tYear}-${tMonth}-${String(targetDay).padStart(2, '0')}`;
          if (adjustedDate < targetStart || adjustedDate > targetEnd) continue;

          const dup = targetExisting.find(e => e.title === s.title && e.date === adjustedDate);
          if (dup) continue;

          await DB.add('schedules', {
            ...s,
            id: undefined,
            date: adjustedDate,
            completed: false,
            syncedWeekDays: [],
            createdAt: new Date().toISOString()
          });
          copied++;
          continue;
        }

        const dup = targetExisting.find(e => e.title === s.title && e.date === newDate);
        if (dup) continue;

        await DB.add('schedules', {
          ...s,
          id: undefined,
          date: newDate,
          completed: false,
          syncedWeekDays: [],
          createdAt: new Date().toISOString()
        });
        copied++;
      }

      // 进度完成
      setTimeout(() => { progressFill.style.width = '100%'; }, 600);
      setTimeout(() => {
        closeModal();
        App._showToast(`同步完成 ✓ 已复制 ${copied} 项日程`);
        this.refresh();
      }, 900);
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
              <input id="sched-date" class="input" type="date" value="${preset.date || Utils.formatDate(this.currentDate)}">
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:flex-end;">
            <div class="form-group" style="flex:1;">
              <label class="form-label">开始时间</label>
              <input id="sched-time" class="input" type="text" placeholder="例如 14:30" pattern="[0-9]{2}:[0-9]{2}" inputmode="numeric" autocomplete="off" value="${preset.time || ''}">
            </div>
            <span style="padding-bottom:14px;color:var(--text-tertiary);">—</span>
            <div class="form-group" style="flex:1;">
              <label class="form-label">结束时间</label>
              <input id="sched-time-end" class="input" type="text" placeholder="例如 15:30" pattern="[0-9]{2}:[0-9]{2}" inputmode="numeric" autocomplete="off" value="${preset.timeEnd || ''}">
            </div>
          </div>
          <button class="btn btn-primary btn-block" id="btn-save-schedule">
            ${isEdit ? '更新日程' : '保存日程'}
          </button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const closeModal = () => overlay.remove();
    overlay.querySelector('.modal-close').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

    // 【核心】保存按钮 — 必须最先绑定，确保保存功能始终可用
    overlay.querySelector('#btn-save-schedule').addEventListener('click', async () => {
      try {
        const titleEl = overlay.querySelector('#sched-title');
        const descEl = overlay.querySelector('#sched-desc');
        const dateEl = overlay.querySelector('#sched-date');
        const timeEl = overlay.querySelector('#sched-time');
        const timeEndEl = overlay.querySelector('#sched-time-end');

        if (!titleEl || !dateEl) {
          console.error('保存失败：找不到表单元素');
          if (typeof App !== 'undefined') App._showToast('保存失败，请刷新页面重试');
          return;
        }

        const title = titleEl.value.trim();
        const description = descEl ? descEl.value.trim() : '';
        const date = dateEl.value;
        const time = timeEl ? timeEl.value : '';
        const timeEnd = timeEndEl ? timeEndEl.value : '';

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
