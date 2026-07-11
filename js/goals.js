// 人生目标模块

const GoalsPage = {
  selectedCategory: null,  // null = 全部, 1-6 = 筛选

  async render() {
    const container = document.getElementById('page-goals');
    if (!container) return;

    container.innerHTML = `
      <!-- 分类筛选 -->
      <div class="category-filter" id="category-filter">
        <button class="category-chip active" data-cat="all">🏠 全部</button>
        ${Utils.categories.map(c => `
          <button class="category-chip" data-cat="${c.id}">${c.icon} ${c.name}</button>
        `).join('')}
      </div>

      <!-- 目标列表 -->
      <div id="goals-list"></div>
      <div id="goals-empty" class="empty-state" style="display:none;">
        <div class="empty-icon">🎯</div>
        <p>还没有目标<br>点击右下角 + 创建你的第一个目标吧</p>
      </div>
    `;

    this._bindEvents();
    await this._loadGoals();
  },

  async refresh() {
    await this._loadGoals();
  },

  _bindEvents() {
    // 分类筛选
    const filter = document.getElementById('category-filter');
    if (filter) {
      filter.addEventListener('click', (e) => {
        const chip = e.target.closest('.category-chip');
        if (!chip) return;
        filter.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.selectedCategory = chip.dataset.cat === 'all' ? null : parseInt(chip.dataset.cat);
        this._loadGoals();
      });
    }
  },

  // 显示创建目标弹窗
  showCreateModal() {
    this._showGoalModal(null);
  },

  // 显示编辑目标弹窗
  _showGoalModal(goal) {
    const isEdit = !!goal;
    const categoryOptions = Utils.categories.map(c =>
      `<option value="${c.id}" ${goal && goal.category === c.id ? 'selected' : ''}>${c.icon} ${c.name}</option>`
    ).join('');

    const modal = this._createModal({
      title: isEdit ? '编辑目标' : '新建目标',
      content: `
        <div class="form-group">
          <label class="form-label">分类</label>
          <select id="goal-category" class="select" style="width:100%;">${categoryOptions}</select>
        </div>
        <div class="form-group">
          <label class="form-label">目标名称</label>
          <input id="goal-title" class="input" value="${Utils.escapeHtml(goal?.title || '')}" placeholder="如：通过四级、学会吉他、减肥、存钱...">
        </div>
        <div class="form-group">
          <label class="form-label">描述（可选）</label>
          <input id="goal-desc" class="input" value="${Utils.escapeHtml(goal?.description || '')}" placeholder="简单描述你的目标">
        </div>
        <!-- AI 计划卡片建议区域（仅新建时显示） -->
        <div id="plan-suggestions" style="display:none;">
          <label class="form-label" style="margin-top:4px;">💡 AI 建议的子计划（点击卡片选择/取消）</label>
          <div id="plan-cards" style="display:flex;flex-direction:column;gap:8px;"></div>
          <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px;">
            ✅ 勾选的计划将在创建目标后自动生成为日程
          </div>
        </div>
        ${!isEdit ? `<div id="plan-suggestions-hint" style="text-align:center;padding:16px 0 4px;color:var(--text-tertiary);font-size:13px;">
          💡 输入目标名称后 AI 将自动推荐执行计划
        </div>` : ''}
        <button class="btn btn-primary btn-block" id="btn-save-goal" style="margin-top:12px;">
          ${isEdit ? '更新目标' : '创建目标'}
        </button>
        ${isEdit ? `<button class="btn btn-block" id="btn-delete-goal" style="margin-top:8px;color:var(--danger);background:rgba(212,165,165,0.2);">删除目标</button>` : ''}
      `,
      onClose: () => this._closeModal()
    });

    // 当前计划卡片数据
    let planCards = [];
    let debounceTimer = null;

    // 监听目标名称输入 → AI 推荐计划卡片
    const titleInput = modal.querySelector('#goal-title');
    const planArea = modal.querySelector('#plan-suggestions');
    const planCardsEl = modal.querySelector('#plan-cards');
    const planHint = modal.querySelector('#plan-suggestions-hint');

    const renderPlanCards = () => {
      if (!planCards.length) {
        planArea.style.display = 'none';
        if (planHint) planHint.style.display = 'block';
        return;
      }
      planArea.style.display = 'block';
      if (planHint) planHint.style.display = 'none';
      planCardsEl.innerHTML = planCards.map(p => `
        <div class="plan-card ${p.selected ? 'selected' : ''}" data-plan-id="${p.id}" style="
          display:flex;align-items:center;gap:10px;padding:10px 14px;
          border-radius:var(--radius-sm);cursor:pointer;
          border:2px solid ${p.selected ? 'var(--cat-learning)' : 'rgba(0,0,0,0.06)'};
          background:${p.selected ? 'var(--cat-learning-bg)' : 'var(--bg-card)'};
          transition:all 0.15s;
        ">
          <div style="font-size:22px;flex-shrink:0;">${p.icon}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;font-size:14px;color:var(--text-primary);">${Utils.escapeHtml(p.title)}</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">${Utils.escapeHtml(p.desc)}</div>
          </div>
          <div style="font-size:18px;flex-shrink:0;color:${p.selected ? 'var(--cat-learning)' : 'var(--text-tertiary)'};">
            ${p.selected ? '✅' : '⬜'}
          </div>
        </div>
      `).join('');

      // 点击切换选择状态
      planCardsEl.querySelectorAll('.plan-card').forEach(card => {
        card.addEventListener('click', () => {
          const pid = card.dataset.planId;
          const plan = planCards.find(p => p.id === pid);
          if (plan) { plan.selected = !plan.selected; }
          renderPlanCards();
        });
      });
    };

    titleInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      const val = titleInput.value.trim();

      if (!val) {
        planCards = [];
        renderPlanCards();
        return;
      }

      // 防抖 400ms 后触发 AI 建议
      debounceTimer = setTimeout(() => {
        planCards = AI.suggestPlans(val);
        if (!planCards.length) {
          // 没有精准匹配，使用分类的通用建议
          const catId = parseInt(modal.querySelector('#goal-category').value);
          planCards = AI.getGeneralPlans(catId);
        }
        renderPlanCards();
      }, 400);
    });

    // 分类变化时刷新建议
    modal.querySelector('#goal-category').addEventListener('change', () => {
      const val = titleInput.value.trim();
      if (val) {
        planCards = AI.suggestPlans(val);
        if (!planCards.length) {
          const catId = parseInt(modal.querySelector('#goal-category').value);
          planCards = AI.getGeneralPlans(catId);
        }
        renderPlanCards();
      }
    });

    // 如果是编辑模式且已有名称，初始化时不触发建议
    if (!isEdit && titleInput.value.trim()) {
      titleInput.dispatchEvent(new Event('input'));
    }

    // 保存
    modal.querySelector('#btn-save-goal').addEventListener('click', async () => {
      const category = parseInt(modal.querySelector('#goal-category').value);
      const title = modal.querySelector('#goal-title').value.trim();
      const description = modal.querySelector('#goal-desc').value.trim();

      if (!title) { alert('请输入目标名称'); return; }

      let goalId;
      if (isEdit) {
        await DB.put('goals', {
          ...goal,
          category, title, description,
          updatedAt: new Date().toISOString()
        });
        goalId = goal.id;
      } else {
        goalId = await DB.add('goals', {
          category, title, description,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        });
      }

      // 创建勾选的计划卡片为日程
      if (!isEdit && planCards.length > 0) {
        const selectedPlans = planCards.filter(p => p.selected);
        const today = Utils.formatDate();
        for (const plan of selectedPlans) {
          await DB.add('schedules', {
            title: plan.title,
            description: plan.desc,
            date: today,
            time: '',
            completed: false,
            sourceRecordId: null,
            createdAt: new Date().toISOString()
          });
        }
      }

      this._closeModal();
      await this._loadGoals();
      // 如果创建了新日程，刷新日程页
      if (!isEdit && planCards.filter(p => p.selected).length > 0) {
        try { await SchedulePage.refresh(); } catch (e) { /* 日程页可能未渲染 */ }
      }
    });

    // 删除
    if (isEdit) {
      modal.querySelector('#btn-delete-goal').addEventListener('click', async () => {
        if (!confirm('确定删除该目标吗？')) return;
        await DB.delete('goals', goal.id);
        this._closeModal();
        await this._loadGoals();
      });
    }
  },

  // 加载目标列表
  async _loadGoals() {
    const listEl = document.getElementById('goals-list');
    const emptyEl = document.getElementById('goals-empty');
    if (!listEl) return;

    let goals;
    if (this.selectedCategory) {
      goals = await DB.getGoalsByCategory(this.selectedCategory);
    } else {
      goals = await DB.getAll('goals');
    }

    if (!goals || goals.length === 0) {
      listEl.innerHTML = '';
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';

    // 按分类分组
    const categoriesToShow = this.selectedCategory
      ? [this.selectedCategory]
      : [1, 2, 3, 4, 5, 6];

    listEl.innerHTML = categoriesToShow.map(catId => {
      const catGoals = goals.filter(g => g.category === catId);
      const cat = Utils.getCategory(catId);

      return `
        <div class="goal-category-section" style="margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:8px;padding:8px 4px;">
            <span style="font-size:20px;">${cat.icon}</span>
            <span style="font-weight:600;font-size:16px;color:var(--text-primary);">${cat.name}</span>
            <span style="font-size:12px;color:var(--text-tertiary);">· ${catGoals.length} 项目标</span>
          </div>
          ${catGoals.length === 0
            ? `<div class="card" style="text-align:center;padding:24px;color:var(--text-tertiary);font-size:13px;">
                 暂无目标，点击右下角 + 创建
               </div>`
            : catGoals.map(g => this._renderGoalCard(g)).join('')
          }
        </div>
      `;
    }).join('');

    // 绑定事件
    listEl.querySelectorAll('.btn-edit-goal').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const goalId = parseInt(btn.dataset.id);
        const goal = await DB.get('goals', goalId);
        this._showGoalModal(goal);
      });
    });

    // 点击卡片展开/折叠内联分支
    listEl.querySelectorAll('.goal-card-body').forEach(card => {
      card.addEventListener('click', async (e) => {
        if (e.target.closest('button')) return;
        const goalCard = card.closest('.goal-card');
        const goalId = parseInt(goalCard.dataset.id);
        const inline = document.getElementById('branch-inline-' + goalId);
        const arrow = card.querySelector('.branch-expand-arrow');

        if (inline) {
          const isOpen = inline.style.display !== 'none';
          if (isOpen) {
            inline.style.display = 'none';
            if (arrow) arrow.style.transform = 'rotate(0deg)';
          } else {
            inline.style.display = 'block';
            if (arrow) arrow.style.transform = 'rotate(90deg)';
            // 首次展开时绑定分支交互事件
            this._bindBranchInlineEvents(goalId);
          }
        }
      });
    });
  },

  // ===== 内联分支事件绑定 =====
  async _bindBranchInlineEvents(goalId) {
    const goal = await DB.get('goals', goalId);
    if (!goal) return;
    if (!goal.branches) goal.branches = [];

    const refreshInline = async () => {
      await DB.put('goals', goal);
      // 重新渲染内联分支列表
      const listEl = document.getElementById('branch-list-' + goalId);
      if (!listEl) return;
      const doneCount = goal.branches.filter(b => b.done).length;
      const total = goal.branches.length;

      // 更新分支列表
      if (total === 0) {
        listEl.innerHTML = '<div class="branch-empty" style="padding:12px;text-align:center;color:var(--text-tertiary);font-size:13px;">暂无分支计划</div>';
      } else {
        listEl.innerHTML = goal.branches.map((b, i) => `
          <div class="branch-item" data-br-idx="${i}">
            <button class="schedule-check ${b.done ? 'done' : ''}" data-br-toggle="${i}" style="width:22px;height:22px;font-size:12px;">${b.done ? '✓' : ''}</button>
            <span class="branch-title ${b.done ? 'branch-done' : ''}" id="br-title-${goalId}-${i}">${Utils.escapeHtml(b.title)}</span>
            <button class="btn-icon" data-br-edit="${i}" title="编辑" style="width:24px;height:24px;font-size:11px;">✏️</button>
            <button class="btn-icon" data-br-del="${i}" title="删除" style="width:24px;height:24px;font-size:11px;color:var(--danger);">🗑️</button>
          </div>
        `).join('');
        // 重新绑定事件（用最新 goal 引用）
        this._bindInlineActionEvents(goalId, goal, refreshInline);
      }

      // 更新 hint
      const hint = document.querySelector(`.goal-card[data-id="${goalId}"] .goal-branch-hint`);
      if (hint) {
        hint.innerHTML = `<span class="branch-expand-arrow" style="transform:rotate(90deg);display:inline-block;transition:transform 0.2s;">▶</span> ↳ ${doneCount}/${total} 个子计划 ${doneCount === total && total > 0 ? '✅' : ''}`;
        hint.style.color = total > 0 ? 'var(--primary)' : 'var(--text-tertiary)';
      }
    };

    this._bindInlineActionEvents(goalId, goal, refreshInline);
  },

  _bindInlineActionEvents(goalId, goal, refreshInline) {
    const inline = document.getElementById('branch-inline-' + goalId);
    if (!inline) return;

    // Toggle done
    inline.querySelectorAll('[data-br-toggle]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.brToggle);
        goal.branches[idx].done = !goal.branches[idx].done;
        await refreshInline();
      });
    });

    // Edit
    inline.querySelectorAll('[data-br-edit]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.brEdit);
        const span = document.getElementById('br-title-' + goalId + '-' + idx);
        if (!span) return;
        const input = document.createElement('input');
        input.className = 'input';
        input.value = goal.branches[idx].title;
        input.style.cssText = 'flex:1;font-size:13px;padding:4px 8px;min-width:0;';
        input.addEventListener('blur', async () => {
          goal.branches[idx].title = input.value.trim() || goal.branches[idx].title;
          await refreshInline();
        });
        input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') input.blur(); });
        span.replaceWith(input);
        input.focus(); input.select();
      });
    });

    // Delete
    inline.querySelectorAll('[data-br-del]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.brDel);
        goal.branches.splice(idx, 1);
        await refreshInline();
      });
    });

    // Add
    const addInput = inline.querySelector('input[id^="br-input-"]');
    const addBtn = inline.querySelector('button[id^="btn-br-add-"]');
    if (addInput && addBtn) {
      const doAdd = async () => {
        const t = addInput.value.trim();
        if (!t) return;
        goal.branches.push({ title: t, done: false, createdAt: new Date().toISOString() });
        await refreshInline();
        addInput.value = '';
        addInput.focus();
      };
      addBtn.addEventListener('click', doAdd);
      addInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAdd(); });
    }
  },

  // ===== 分支管理弹窗（保留备用） =====
  async _showBranchPopup(goalId) {
    const goal = await DB.get('goals', goalId);
    if (!goal) return;
    if (!goal.branches) goal.branches = [];

    const cat = Utils.getCategory(goal.category);

    const overlay = document.createElement('div');
    overlay.className = 'branch-popup-overlay';
    overlay.innerHTML = `
      <div class="branch-popup">
        <div class="branch-popup-title">${cat.icon} ${Utils.escapeHtml(goal.title)}</div>
        <div class="branch-popup-subtitle">分支计划 · 点击复选框标记完成</div>
        ${goal.branches.length > 0 ? `
        <div class="branch-progress">
          <div style="display:flex;align-items:center;justify-content:space-between;font-size:var(--fs-caption);">
            <span style="color:var(--text-secondary);">完成进度</span>
            <span style="color:var(--primary);font-weight:var(--fw-semibold);">${goal.branches.filter(b=>b.done).length}/${goal.branches.length}</span>
          </div>
          <div class="branch-progress-bar">
            <div class="branch-progress-fill" style="width:${Math.round(goal.branches.filter(b=>b.done).length/goal.branches.length*100)}%;"></div>
          </div>
        </div>` : ''}
        <div id="branch-list">
          ${goal.branches.length === 0
            ? '<div class="branch-empty">暂无分支计划，点击下方添加</div>'
            : goal.branches.map((b, i) => `
              <div class="branch-item">
                <button class="schedule-check ${b.done ? 'done' : ''}" data-branch-toggle="${i}" style="width:24px;height:24px;">${b.done ? '✓' : ''}</button>
                <span class="branch-title ${b.done ? 'branch-done' : ''}" id="br-title-${i}">${Utils.escapeHtml(b.title)}</span>
                <button class="btn-icon" data-branch-edit="${i}" title="编辑" style="font-size:12px;">✏️</button>
                <button class="btn-icon" data-branch-del="${i}" title="删除" style="font-size:12px;color:var(--danger);">🗑️</button>
              </div>
            `).join('')
          }
        </div>
        <div class="branch-add-row">
          <input id="br-new-input" class="input" placeholder="新分支名称..." autocomplete="off">
          <button class="btn btn-primary btn-sm" id="btn-br-add">+ 添加</button>
        </div>
        <button class="btn btn-ghost btn-block" id="btn-br-close" style="margin-top:16px;">关闭</button>
      </div>`;

    document.body.appendChild(overlay);

    const refresh = async () => {
      await DB.put('goals', goal);
      await this._loadGoals();
    };

    const reOpen = () => {
      overlay.remove();
      this._showBranchPopup(goalId);
    };

    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#btn-br-close').addEventListener('click', () => overlay.remove());

    // 切换完成
    overlay.querySelectorAll('[data-branch-toggle]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        goal.branches[parseInt(btn.dataset.branchToggle)].done = !goal.branches[parseInt(btn.dataset.branchToggle)].done;
        await refresh();
        reOpen();
      });
    });

    // 编辑
    overlay.querySelectorAll('[data-branch-edit]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const i = parseInt(btn.dataset.branchEdit);
        const span = document.getElementById(`br-title-${i}`);
        const input = document.createElement('input');
        input.className = 'input';
        input.value = goal.branches[i].title;
        input.style.cssText = 'flex:1;font-size:var(--fs-small);padding:4px 8px;';
        input.addEventListener('blur', async () => {
          goal.branches[i].title = input.value.trim() || goal.branches[i].title;
          await refresh(); reOpen();
        });
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
        span.replaceWith(input);
        input.focus(); input.select();
      });
    });

    // 删除
    overlay.querySelectorAll('[data-branch-del]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        goal.branches.splice(parseInt(btn.dataset.branchDel), 1);
        await refresh();
        reOpen();
      });
    });

    // 新增
    const addInput = overlay.querySelector('#br-new-input');
    overlay.querySelector('#btn-br-add').addEventListener('click', async () => {
      const t = addInput.value.trim();
      if (!t) return;
      goal.branches.push({ title: t, done: false, createdAt: new Date().toISOString() });
      await refresh();
      reOpen();
    });
    addInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') overlay.querySelector('#btn-br-add').click(); });
  },

  // 渲染单个目标卡片
  _renderGoalCard(goal) {
    const hasBranches = goal.branches && goal.branches.length > 0;
    const doneCount = hasBranches ? goal.branches.filter(b => b.done).length : 0;
    const totalCount = hasBranches ? goal.branches.length : 0;
    const branchLabel = hasBranches
      ? `↳ ${doneCount}/${totalCount} 个子计划 ${doneCount === totalCount && totalCount > 0 ? '✅' : ''}`
      : '点击展开分支计划';
    const expandedClass = goal._expanded ? '' : '';
    // Note: _expanded state is tracked via DOM, not persisted

    return `
      <div class="card goal-card" data-id="${goal.id}" style="cursor:pointer;overflow:visible;">
        <div class="goal-card-body" data-goal-id="${goal.id}">
          <div class="card-header">
            <div class="card-title">${Utils.escapeHtml(goal.title)}</div>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-sm btn-icon btn-edit-goal" data-id="${goal.id}" title="编辑" style="font-size:14px;">✏️</button>
            </div>
          </div>
          ${goal.description ? `<div style="font-size:13px;color:var(--text-secondary);">${Utils.escapeHtml(goal.description)}</div>` : ''}
          <div class="goal-branch-hint" style="font-size:12px;color:${hasBranches ? 'var(--primary)' : 'var(--text-tertiary)'};margin-top:6px;display:flex;align-items:center;gap:4px;">
            <span class="branch-expand-arrow" style="transition:transform 0.2s;display:inline-block;">▶</span> ${branchLabel}
          </div>
        </div>
        <!-- 内联分支展开区 -->
        <div class="goal-branch-inline" id="branch-inline-${goal.id}" style="display:none;border-top:var(--glass-border-subtle);margin-top:12px;padding-top:12px;">
          ${hasBranches ? `
          <div id="branch-list-${goal.id}">
            ${goal.branches.map((b, i) => `
              <div class="branch-item" data-br-idx="${i}">
                <button class="schedule-check ${b.done ? 'done' : ''}" data-br-toggle="${i}" style="width:22px;height:22px;font-size:12px;">${b.done ? '✓' : ''}</button>
                <span class="branch-title ${b.done ? 'branch-done' : ''}" id="br-title-${goal.id}-${i}">${Utils.escapeHtml(b.title)}</span>
                <button class="btn-icon" data-br-edit="${i}" title="编辑" style="width:24px;height:24px;font-size:11px;">✏️</button>
                <button class="btn-icon" data-br-del="${i}" title="删除" style="width:24px;height:24px;font-size:11px;color:var(--danger);">🗑️</button>
              </div>
            `).join('')}
          </div>` : `<div id="branch-list-${goal.id}" class="branch-empty" style="padding:12px;text-align:center;color:var(--text-tertiary);font-size:13px;">暂无分支计划</div>`}
          <div class="branch-add-row" style="margin-top:10px;">
            <input id="br-input-${goal.id}" class="input" placeholder="新分支名称..." autocomplete="off" style="font-size:13px;padding:8px 12px;">
            <button class="btn btn-primary btn-sm" id="btn-br-add-${goal.id}">+ 添加</button>
          </div>
        </div>
      </div>`;
  },

  // Modal 辅助
  _currentModal: null,

  _createModal({ title, content, onClose }) {
    this._closeModal();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">${title}</div>
          <button class="modal-close">✕</button>
        </div>
        <div class="modal-body">${content}</div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.modal-close').addEventListener('click', onClose);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) onClose(); });
    this._currentModal = { overlay, onClose };
    return overlay.querySelector('.modal-body');
  },

  _closeModal() {
    if (this._currentModal) {
      this._currentModal.overlay.remove();
      this._currentModal = null;
    }
  }
};
