// 日常记录模块 — 纯 DeepSeek 对话 + 日记查看

const RecordsPage = {
  _messages: [],       // 当前对话消息
  _viewMode: 'chat',   // 'chat' | 'diary'

  async render() {
    const container = document.getElementById('page-records');
    if (!container) return;

    const existingMessages = this._messages;

    container.innerHTML = `
      <!-- 顶部切换：对话 / 日记 -->
      <div style="display:flex;align-items:center;gap:8px;padding:4px 0 12px;">
        <div class="view-toggle" id="records-view-toggle" style="flex:0 0 auto;">
          <button data-view="chat" class="active">💬 对话</button>
          <button data-view="diary">📖 日记</button>
        </div>
        <div style="flex:1;"></div>
        <button class="btn btn-sm btn-ghost" id="btn-clear-chat" title="清除对话">🗑️</button>
      </div>

      <!-- 对话视图 -->
      <div id="chat-view">
        <div id="chat-messages" class="chat-messages">
          <div class="chat-welcome">
            <div class="welcome-avatar">🌿</div>
            <div class="welcome-title">你好，我是小叶子</div>
            <div class="welcome-sub">你的温暖生活助手<br>可以倾听、记录、陪伴你的每一天</div>
            <div class="welcome-suggestions" id="welcome-suggestions">
              <button class="chat-chip" data-msg="今天工作有些累，但完成了重要的项目">😮‍💨 今天工作有些累...</button>
              <button class="chat-chip" data-msg="去健身房练了1小时，感觉状态不错">🏋️ 去健身了...</button>
              <button class="chat-chip" data-msg="和朋友聚餐聊天，聊了很多有意思的事">😊 和朋友聚餐...</button>
              <button class="chat-chip" data-msg="推荐几本值得读的书给我吧">📚 推荐几本书...</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 日记视图 -->
      <div id="diary-view" style="display:none;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <span style="font-size:var(--fs-heading);font-weight:var(--fw-semibold);">📖 日记本</span>
          <button class="btn btn-sm btn-primary" id="btn-write-diary">✍️ 写日记</button>
        </div>
        <div id="diary-list"></div>
        <div id="diary-empty" class="empty-state" style="display:none;">
          <div class="empty-icon">📖</div>
          <p>还没有日记<br>在对话中保存，或点击上方「写日记」开始</p>
        </div>
      </div>

      <!-- 底部输入区（仅对话模式） -->
      <div class="chat-input-area" id="chat-input-area">
        <div class="chat-input-row">
          <input id="chat-input" class="chat-input"
                 placeholder="和小叶子聊聊..."
                 autocomplete="off">
          <button id="btn-chat-send" class="chat-send-btn" aria-label="发送">
            <span style="font-size:16px;line-height:1;">↑</span>
          </button>
        </div>
        <div class="chat-actions" id="chat-actions" style="display:none;">
          <button class="btn btn-sm" id="btn-save-diary" style="flex:1;">
            📖 保存为日记
          </button>
          <button class="btn btn-primary btn-sm" id="btn-gen-schedule" style="flex:1;">
            📅 生成日程
          </button>
          <button class="btn btn-sm" id="btn-lit-card" style="flex:0 0 auto;padding:10px 14px;" title="生成文学卡片">
            📜
          </button>
        </div>
        <div id="ai-status" style="text-align:center;margin-top:4px;min-height:18px;font-size:11px;color:var(--text-tertiary);"></div>
      </div>
    `;

    this._bindEvents();

    // 恢复消息
    if (existingMessages && existingMessages.length > 0) {
      this._messages = existingMessages;
      this._renderMessages();
      document.getElementById('chat-actions').style.display = 'flex';
    }
  },

  async refresh() {},

  focusInput() {
    if (this._viewMode !== 'chat') {
      this._switchView('chat');
    }
    const input = document.getElementById('chat-input');
    if (input) { input.focus(); }
  },

  // ===== 视图切换 =====
  _switchView(mode) {
    this._viewMode = mode;
    const chatView = document.getElementById('chat-view');
    const diaryView = document.getElementById('diary-view');
    const inputArea = document.getElementById('chat-input-area');
    const fab = document.getElementById('fab-btn');

    if (mode === 'chat') {
      chatView.style.display = 'block';
      diaryView.style.display = 'none';
      inputArea.style.display = 'block';
      if (fab) fab.style.display = 'flex';
    } else {
      chatView.style.display = 'none';
      diaryView.style.display = 'block';
      inputArea.style.display = 'none';
      if (fab) fab.style.display = 'none';
      this._loadDiaryList();
    }
  },

  // ===== 事件绑定 =====
  _bindEvents() {
    // 视图切换
    const viewToggle = document.getElementById('records-view-toggle');
    if (viewToggle) {
      viewToggle.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        viewToggle.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._switchView(btn.dataset.view);
      });
    }

    // 清除对话
    const clearBtn = document.getElementById('btn-clear-chat');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this._messages = [];
        AI.clearChat();
        this._renderMessages();
        document.getElementById('chat-actions').style.display = 'none';
        document.getElementById('ai-status').innerHTML = '';
        this._showToast('对话已清除');
      });
    }

    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('btn-chat-send');
    const saveBtn = document.getElementById('btn-save-diary');
    const genScheduleBtn = document.getElementById('btn-gen-schedule');
    const actions = document.getElementById('chat-actions');

    const sendMessage = () => {
      const content = input.value.trim();
      if (!content) return;
      this._addUserMessage(content);
      input.value = '';
      input.style.height = 'auto';
      input.focus();
      actions.style.display = 'flex';
      const welcome = document.querySelector('#page-records .chat-welcome');
      if (welcome) welcome.classList.add('hidden');
    };

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // 欢迎区快捷输入
    const suggestions = document.getElementById('welcome-suggestions');
    if (suggestions) {
      suggestions.addEventListener('click', (e) => {
        const chip = e.target.closest('.chat-chip');
        if (!chip) return;
        this._addUserMessage(chip.dataset.msg);
        actions.style.display = 'flex';
        const welcome = document.querySelector('#page-records .chat-welcome');
        if (welcome) welcome.classList.add('hidden');
      });
    }

    // 保存为日记
    if (saveBtn) saveBtn.addEventListener('click', () => this._saveAsDiary());

    // 生成日程
    if (genScheduleBtn) genScheduleBtn.addEventListener('click', () => this._generateFromLast());

    // 文学卡片
    const litBtn = document.getElementById('btn-lit-card');
    if (litBtn) litBtn.addEventListener('click', () => this._generateLitCard());

    // 手动写日记
    const writeBtn = document.getElementById('btn-write-diary');
    if (writeBtn) writeBtn.addEventListener('click', () => this._writeDiaryManually());

    // 自动调整输入框高度
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });
  },

  // ===== 添加用户消息 + AI 流式回复 =====
  async _addUserMessage(content) {
    this._messages.push({ role: 'user', content, time: new Date().toISOString() });
    this._renderMessages();

    // 创建空的 AI 回复气泡
    const container = document.getElementById('chat-messages');
    const msgContainer = container?.querySelector('#chat-msg-container');
    if (!msgContainer) return;

    const bubbleId = 'ai-streaming-' + Date.now();
    const bubbleHtml = `
      <div class="chat-bubble chat-bubble-ai" id="${bubbleId}">
        <div class="chat-ai-avatar">🌿</div>
        <div>
          <div class="chat-bubble-text" id="${bubbleId}-text"></div>
          <div class="chat-bubble-time" id="${bubbleId}-time">正在输入...</div>
        </div>
      </div>`;
    msgContainer.insertAdjacentHTML('beforeend', bubbleHtml);
    container.scrollTop = container.scrollHeight;

    const textEl = document.getElementById(bubbleId + '-text');
    const timeEl = document.getElementById(bubbleId + '-time');

    if (!textEl || !timeEl) return;

    // 流式接收 AI 回复
    await AI.chatStream(content, {
      onChunk(delta) {
        textEl.textContent += delta;
        container.scrollTop = container.scrollHeight;
      },
      onDone(fullText) {
        timeEl.textContent = Utils.formatFriendly(new Date().toISOString());
        if (!fullText) {
          textEl.textContent = '请在设置中配置 DeepSeek API Key 后使用 AI 对话。点击右上角 ⚙ 进入设置。';
        }
        // 更新消息记录
        const msg = {
          role: 'ai',
          content: fullText || textEl.textContent,
          time: new Date().toISOString()
        };
        RecordsPage._messages.push(msg);
      },
      onError(err) {
        textEl.textContent = '❌ ' + (err.message || '网络请求失败，请检查 API 配置');
        timeEl.textContent = '发送失败';
        RecordsPage._messages.push({
          role: 'ai',
          content: textEl.textContent,
          time: new Date().toISOString()
        });
      }
    });
  },

  // ===== 保存为日记（勾选模式） =====
  async _saveAsDiary() {
    if (this._messages.length === 0) {
      this._showToast('请先和小叶子聊聊天');
      return;
    }

    // 弹窗：勾选要保存的消息
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">📖 保存为日记</div>
          <button class="modal-close">✕</button>
        </div>
        <div class="modal-body">
          <div style="margin-bottom:12px;font-size:var(--fs-small);color:var(--text-secondary);">勾选要保存的内容：</div>
          <div id="save-check-list" style="max-height:50vh;overflow-y:auto;">
            ${this._messages.map((m, i) => `
              <label class="branch-item" style="cursor:pointer;align-items:flex-start;">
                <input type="checkbox" data-msg-idx="${i}" checked style="margin-top:3px;flex-shrink:0;">
                <div style="flex:1;min-width:0;">
                  <div style="font-size:11px;color:var(--text-tertiary);margin-bottom:2px;">${m.role === 'user' ? '💬 你说' : '🌿 小叶子'} · ${Utils.formatFriendly(m.time)}</div>
                  <div style="font-size:var(--fs-small);color:var(--text-primary);line-height:1.5;white-space:pre-wrap;">${Utils.escapeHtml(m.content.slice(0, 120))}${m.content.length > 120 ? '...' : ''}</div>
                </div>
              </label>
            `).join('')}
          </div>
          <div style="display:flex;gap:8px;margin-top:12px;">
            <button class="btn btn-ghost btn-sm" id="btn-check-all" style="flex:1;">全选</button>
            <button class="btn btn-ghost btn-sm" id="btn-check-none" style="flex:1;">全不选</button>
          </div>
          <button class="btn btn-primary btn-block" id="btn-confirm-save" style="margin-top:12px;">💾 保存选中内容</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('.modal-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    overlay.querySelector('#btn-check-all').addEventListener('click', () => {
      overlay.querySelectorAll('#save-check-list input').forEach(cb => cb.checked = true);
    });
    overlay.querySelector('#btn-check-none').addEventListener('click', () => {
      overlay.querySelectorAll('#save-check-list input').forEach(cb => cb.checked = false);
    });

    overlay.querySelector('#btn-confirm-save').addEventListener('click', async () => {
      const checked = overlay.querySelectorAll('#save-check-list input:checked');
      if (checked.length === 0) {
        this._showToast('请至少选择一条消息');
        return;
      }

      const indices = Array.from(checked).map(cb => parseInt(cb.dataset.msgIdx)).sort((a,b) => a-b);
      const selected = indices.map(i => this._messages[i]);

      const record = {
        messages: selected.map(m => ({ role: m.role, content: m.content, time: m.time })),
        createdAt: new Date().toISOString()
      };

      await DB.add('records', record);
      close();

      const status = document.getElementById('ai-status');
      if (status) status.innerHTML = '<span style="color:var(--success);">✅ 已保存 ' + selected.length + ' 条消息到日记本</span>';

      this._showToast('已保存为日记 📖');
    });

    // 默认全选
    overlay.querySelectorAll('#save-check-list input').forEach(cb => cb.checked = true);
  },

  // ===== 加载日记列表 =====
  async _loadDiaryList() {
    const listEl = document.getElementById('diary-list');
    const emptyEl = document.getElementById('diary-empty');
    if (!listEl) return;

    const records = await DB.getAll('records');
    records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (records.length === 0) {
      listEl.innerHTML = '';
      emptyEl.style.display = 'block';
      return;
    }

    emptyEl.style.display = 'none';
    listEl.innerHTML = records.map((r) => {
      // 兼容旧格式 (content/aiReply) 和新格式 (messages[])
      const messages = r.messages || [];
      const hasNewFormat = messages.length > 0;

      let bodyHtml = '';
      if (hasNewFormat) {
        bodyHtml = messages.map(m => `
          <div style="margin-bottom:10px;padding:10px 12px;border-radius:var(--radius-sm);${m.role === 'user' ? 'background:var(--bg-secondary);' : 'background:var(--primary-light);'}">
            <div style="font-size:10px;color:var(--text-tertiary);margin-bottom:4px;">${m.role === 'user' ? '💬 你说' : '🌿 小叶子'}</div>
            <div style="font-size:var(--fs-small);line-height:1.7;white-space:pre-wrap;color:var(--text-primary);">${Utils.escapeHtml(m.content)}</div>
          </div>
        `).join('');
      } else {
        bodyHtml = `
          ${r.content ? `<div style="font-size:var(--fs-body);line-height:1.8;white-space:pre-wrap;color:var(--text-primary);margin-bottom:10px;">${Utils.escapeHtml(r.content)}</div>` : ''}
          ${r.aiReply ? `<div style="padding:10px 12px;background:var(--primary-light);border-radius:var(--radius-sm);font-size:var(--fs-small);line-height:1.7;color:var(--text-secondary);">🌿 小叶子：${Utils.escapeHtml(r.aiReply)}</div>` : ''}
        `;
      }

      return `
      <div class="glass-card diary-entry" data-id="${r.id}" style="position:relative;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <span style="font-size:var(--fs-caption);color:var(--text-tertiary);font-weight:var(--fw-medium);">
            📅 ${Utils.formatFriendly(r.createdAt)}
          </span>
          <div style="display:flex;gap:6px;">
            <button class="btn-icon btn-edit-diary" data-id="${r.id}" title="编辑" style="font-size:12px;width:28px;height:28px;">✏️</button>
            <button class="btn-icon btn-del-diary" data-id="${r.id}" title="删除" style="font-size:12px;width:28px;height:28px;color:var(--danger);">🗑️</button>
          </div>
        </div>
        ${bodyHtml}
      </div>`;
    }).join('');

    // 绑定删除
    listEl.querySelectorAll('.btn-del-diary').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('确定删除这篇日记吗？')) return;
        await DB.delete('records', parseInt(btn.dataset.id));
        this._showToast('日记已删除');
        this._loadDiaryList();
      });
    });

    // 绑定编辑
    listEl.querySelectorAll('.btn-edit-diary').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this._editDiary(parseInt(btn.dataset.id));
      });
    });
  },

  // ===== 编辑日记 =====
  async _editDiary(recordId) {
    const record = await DB.getById('records', recordId);
    if (!record) return;

    // 转为可编辑的文本格式
    const messages = record.messages || [];
    let text = '';
    if (messages.length > 0) {
      text = messages.map(m => `[${m.role === 'user' ? '💬' : '🌿'}] ${m.content}`).join('\n\n');
    } else {
      text = (record.content || '') + (record.aiReply ? '\n\n[🌿] ' + record.aiReply : '');
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">✏️ 编辑日记</div>
          <button class="modal-close">✕</button>
        </div>
        <div class="modal-body">
          <textarea id="edit-diary-text" class="textarea" style="min-height:200px;line-height:1.8;font-size:var(--fs-small);">${Utils.escapeHtml(text)}</textarea>
          <div style="font-size:var(--fs-caption);color:var(--text-tertiary);margin-top:6px;">每行以 [💬] 或 [🌿] 开头区分你和 AI</div>
          <button class="btn btn-primary btn-block" id="btn-save-edit" style="margin-top:12px;">💾 保存修改</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('.modal-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    overlay.querySelector('#btn-save-edit').addEventListener('click', async () => {
      const newText = overlay.querySelector('#edit-diary-text').value.trim();
      if (!newText) { this._showToast('内容不能为空'); return; }

      // 解析回 messages 格式
      const lines = newText.split('\n\n').filter(l => l.trim());
      const newMessages = lines.map(line => {
        const match = line.match(/^\[(💬|🌿)\]\s*(.*)/s);
        if (match) {
          return { role: match[1] === '💬' ? 'user' : 'ai', content: match[2].trim(), time: new Date().toISOString() };
        }
        return { role: 'user', content: line.trim(), time: new Date().toISOString() };
      });

      record.messages = newMessages;
      record.content = '';  // 清理旧格式
      record.aiReply = '';
      record.updatedAt = new Date().toISOString();
      await DB.put('records', record);

      close();
      this._showToast('日记已更新 ✓');
      this._loadDiaryList();
    });
  },

  // ===== 渲染消息列表 =====
  _renderMessages() {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    const welcomeEl = container.querySelector('.chat-welcome');
    if (welcomeEl) {
      welcomeEl.classList.toggle('hidden', this._messages.length > 0);
    }

    let html = '';
    for (const msg of this._messages) {
      if (msg.role === 'user') {
        html += `
          <div class="chat-bubble chat-bubble-user">
            <div class="chat-bubble-text">${Utils.escapeHtml(msg.content)}</div>
            <div class="chat-bubble-time">${Utils.formatFriendly(msg.time)}</div>
          </div>`;
      } else {
        html += `
          <div class="chat-bubble chat-bubble-ai">
            <div class="chat-ai-avatar">🌿</div>
            <div>
              <div class="chat-bubble-text">${msg.content.replace(/\n/g, '<br>')}</div>
              <div class="chat-bubble-time">${Utils.formatFriendly(msg.time)}</div>
            </div>
          </div>`;
      }
    }

    let msgContainer = container.querySelector('#chat-msg-container');
    if (!msgContainer) {
      msgContainer = document.createElement('div');
      msgContainer.id = 'chat-msg-container';
      container.appendChild(msgContainer);
    }
    msgContainer.innerHTML = html;

    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  },

  // ===== 手动写日记 =====
  _writeDiaryManually() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">✍️ 写日记</div>
          <button class="modal-close">✕</button>
        </div>
        <div class="modal-body">
          <textarea id="manual-diary-text" class="textarea" style="min-height:200px;line-height:1.8;font-size:var(--fs-body);" placeholder="今天发生了什么..."></textarea>
          <button class="btn btn-primary btn-block" id="btn-save-manual" style="margin-top:12px;">💾 保存日记</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('.modal-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    overlay.querySelector('#btn-save-manual').addEventListener('click', async () => {
      const text = overlay.querySelector('#manual-diary-text').value.trim();
      if (!text) { this._showToast('请输入内容'); return; }
      await DB.add('records', {
        messages: [{ role: 'user', content: text, time: new Date().toISOString() }],
        createdAt: new Date().toISOString()
      });
      close();
      this._showToast('日记已保存 ✍️');
      if (this._viewMode === 'diary') this._loadDiaryList();
    });
  },

  // ===== 生成文学卡片 =====
  async _generateLitCard() {
    const msgs = [...this._messages].slice(-6);
    if (msgs.length === 0) { this._showToast('请先和小叶子聊聊天'); return; }

    const text = msgs.map(m => `[${m.role}] ${m.content}`).join('\n');
    const config = AI._getConfig();

    if (!config.key) {
      // 无 API 时使用本地经典名句库
      this._showLitCard(this._getLocalQuote());
      return;
    }

    // AI 生成匹配的书籍名句
    const status = document.getElementById('ai-status');
    if (status) status.textContent = '📜 正在为你寻找名句...';

    try {
      const result = await AI._callAPI([
        { role: 'user', content: `根据以下对话内容，推荐一句与之共鸣的名句。来源完全不限：书籍、诗歌、电影、电视剧、动漫、歌词、名人名言、哲学著作、网络金句都可以。必须注明准确出处和作者，格式如下：

「名句正文」
—— 作者《出处》

只返回这个格式，不要加号不要解释。\n\n对话：\n${text}` }
      ], '你是文学鉴赏助手，根据用户对话推荐匹配的名句。来源完全自由，不限媒介、不限时代、不限文体。');

      if (status) status.textContent = '';
      this._showLitCard(result || this._getLocalQuote());
    } catch (e) {
      if (status) status.textContent = '';
      this._showLitCard(this._getLocalQuote());
    }
  },

  _getLocalQuote() {
    const quotes = [
      // 中国文学
      { book: '《活着》', author: '余华', quote: '人是为了活着本身而活着，而不是为了活着之外的任何事物而活着。' },
      { book: '《围城》', author: '钱钟书', quote: '婚姻是一座围城，城外的人想进去，城里的人想出来。' },
      { book: '《红楼梦》', author: '曹雪芹', quote: '满纸荒唐言，一把辛酸泪。都云作者痴，谁解其中味。' },
      { book: '《西游记》', author: '吴承恩', quote: '山高自有客行路，水深自有渡船人。' },
      { book: '《三国演义》', author: '罗贯中', quote: '大丈夫生于天地之间，岂能郁郁久居人下。' },
      { book: '《水浒传》', author: '施耐庵', quote: '路见不平一声吼，该出手时就出手。' },
      { book: '《边城》', author: '沈从文', quote: '这个人也许永远不回来了，也许明天回来。' },
      { book: '《呐喊》', author: '鲁迅', quote: '其实地上本没有路，走的人多了，也便成了路。' },
      { book: '《平凡的世界》', author: '路遥', quote: '生活不能等待别人来安排，要自己去争取和奋斗。' },
      { book: '《白鹿原》', author: '陈忠实', quote: '好饭耐不得三顿吃，好衣架不住半月穿，好书却经得住一辈子读。' },
      { book: '《黄金时代》', author: '王小波', quote: '那一天我二十一岁，在我一生的黄金时代，我有好多奢望。' },
      { book: '《目送》', author: '龙应台', quote: '所谓父女母子一场，只不过意味着，你和他的缘分就是今生今世不断地在目送他的背影渐行渐远。' },
      { book: '《倾城之恋》', author: '张爱玲', quote: '你如果认识从前的我，也许你会原谅现在的我。' },
      { book: '《呼兰河传》', author: '萧红', quote: '逆来顺受，你说我的生命可惜，我自己却不在乎。' },
      { book: '《道德经》', author: '老子', quote: '上善若水，水善利万物而不争。' },
      { book: '《庄子》', author: '庄子', quote: '人生天地之间，若白驹之过隙，忽然而已。' },
      { book: '《论语》', author: '孔子', quote: '学而不思则罔，思而不学则殆。' },
      { book: '《人间词话》', author: '王国维', quote: '古今之成大事业、大学问者，必经过三种之境界。' },
      { book: '《浮生六记》', author: '沈复', quote: '芸则拔钗沽酒，不动声色，良辰美景，不放轻过。' },
      { book: '《菜根谭》', author: '洪应明', quote: '宠辱不惊，看庭前花开花落；去留无意，望天上云卷云舒。' },
      { book: '《半生缘》', author: '张爱玲', quote: '我要你知道，在这个世界上总有一个人是等着你的。' },
      { book: '《许三观卖血记》', author: '余华', quote: '事情都是被逼出来的，人只有被逼上绝路了，才会有办法。' },
      // 外国文学
      { book: '《小王子》', author: '圣-埃克苏佩里', quote: '正是你为玫瑰花费的时间，才使她变得如此重要。' },
      { book: '《百年孤独》', author: '马尔克斯', quote: '生命中真正重要的不是你遭遇了什么，而是你记住了哪些事。' },
      { book: '《老人与海》', author: '海明威', quote: '人可以被毁灭，但不可以被打败。' },
      { book: '《了不起的盖茨比》', author: '菲茨杰拉德', quote: '我们继续奋力向前，逆水行舟，被不断地向后推。' },
      { book: '《挪威的森林》', author: '村上春树', quote: '死不是生的对立面，而是作为生的一部分永存。' },
      { book: '《瓦尔登湖》', author: '梭罗', quote: '我步入丛林，因为我希望生活得有意义。' },
      { book: '《傲慢与偏见》', author: '简·奥斯汀', quote: '将感情埋藏得太深有时是件坏事。' },
      { book: '《局外人》', author: '加缪', quote: '在隆冬，我终于知道，我身上有一个不可战胜的夏天。' },
      { book: '《罪与罚》', author: '陀思妥耶夫斯基', quote: '痛苦与苦难是伟大心灵必经的洗礼。' },
      { book: '《战争与和平》', author: '托尔斯泰', quote: '每个人都在为某种目标而生活，但最终会回归到自己。' },
      { book: '《简·爱》', author: '夏洛蒂·勃朗特', quote: '我贫穷、卑微、不美丽，但当我们的灵魂穿过坟墓站在上帝面前时，我们是平等的。' },
      { book: '《呼啸山庄》', author: '艾米莉·勃朗特', quote: '他就是我，我就是他，我们的灵魂是同一个。' },
      { book: '《堂吉诃德》', author: '塞万提斯', quote: '不畏惧失败的人，终将到达彼岸。' },
      { book: '《基督山伯爵》', author: '大仲马', quote: '人类的全部智慧，都包含在两个词里：等待和希望。' },
      { book: '《飘》', author: '玛格丽特·米切尔', quote: '明天又是新的一天。' },
      { book: '《1984》', author: '乔治·奥威尔', quote: '谁控制了过去，谁就控制了未来；谁控制了现在，谁就控制了过去。' },
      { book: '《杀死一只知更鸟》', author: '哈珀·李', quote: '你永远不能真正了解一个人，除非你从他的角度去看问题。' },
      { book: '《麦田里的守望者》', author: '塞林格', quote: '一个不成熟的人的标志是他愿意为某种事业英勇地死去，一个成熟的人的标志是他愿意为某种事业卑贱地活着。' },
      { book: '《变形记》', author: '卡夫卡', quote: '也许人与人之间真正需要的不是温暖，而是一点点寒冷。' },
      { book: '《卡拉马佐夫兄弟》', author: '陀思妥耶夫斯基', quote: '爱一切，你就会发现其中的奥秘。' },
      { book: '《月亮与六便士》', author: '毛姆', quote: '追逐梦想就是追逐自己的厄运，满地都是六便士，他却抬头看见了月亮。' },
      { book: '《霍乱时期的爱情》', author: '马尔克斯', quote: '心灵的爱情在腰部以上，肉体的爱情在腰部以下。' },
      { book: '《不能承受的生命之轻》', author: '米兰·昆德拉', quote: '负担越重，我们的生命越贴近大地，它就越真切实在。' },
      { book: '《追风筝的人》', author: '卡勒德·胡赛尼', quote: '为你，千千万万遍。' },
      { book: '《情人》', author: '杜拉斯', quote: '比起你年轻时的容貌，我更爱你现在备受摧残的面容。' },
      { book: '《安妮日记》', author: '安妮·弗兰克', quote: '尽管经历了这一切，我仍然相信人心是善良的。' },
      { book: '《小妇人》', author: '路易莎·梅·奥尔科特', quote: '我太爱我的自由了，不会急于放弃它。' },
      { book: '《挪威的森林》', author: '村上春树', quote: '每一个人都有属于自己的一片森林，迷失的人迷失了，相逢的人会再相逢。' },
    ];
    return quotes[Math.floor(Math.random() * quotes.length)];
  },

  _showLitCard(quoteData) {
    // 移除已有的文学卡片（内联的）
    const existing = document.querySelector('.lit-card-inline');
    if (existing) existing.remove();

    const container = document.getElementById('chat-messages');
    if (!container) return;

    const cardEl = document.createElement('div');
    cardEl.className = 'lit-card-inline';
    cardEl.innerHTML = `
      <div class="lit-card-mini">
        <div class="lit-card-icon">📜</div>
        <div class="lit-card-quote">「${Utils.escapeHtml(quoteData.quote || quoteData)}」</div>
        <div class="lit-card-book">—— ${Utils.escapeHtml(quoteData.book || '')}</div>
        <div class="lit-card-author">${Utils.escapeHtml(quoteData.author || '')}</div>
        <div style="display:flex;gap:8px;margin-top:14px;">
          <button class="btn btn-sm btn-primary btn-lit-save" style="flex:1;">✨ 收藏到日记</button>
          <button class="btn btn-sm btn-ghost btn-lit-dismiss" style="flex:0 0 auto;">✕</button>
        </div>
      </div>`;

    // 插入到消息列表底部
    const msgContainer = container.querySelector('#chat-msg-container');
    if (msgContainer) {
      msgContainer.appendChild(cardEl);
    } else {
      container.appendChild(cardEl);
    }

    // 滚动到底部
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });

    // 收藏
    cardEl.querySelector('.btn-lit-save').addEventListener('click', async () => {
      const text = `${quoteData.quote}\n—— ${quoteData.book} · ${quoteData.author}`;
      await DB.add('records', {
        messages: [{ role: 'ai', content: '📜 ' + text, time: new Date().toISOString() }],
        createdAt: new Date().toISOString()
      });
      cardEl.remove();
      this._showToast('文学卡片已收藏到日记 📖');
    });

    // 关闭
    cardEl.querySelector('.btn-lit-dismiss').addEventListener('click', () => {
      cardEl.remove();
    });
  },

  // ===== 从对话生成日程 =====
  _generateFromLast() {
    const lastUserMsg = [...this._messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) {
      this._showToast('请先输入内容');
      return;
    }
    if (typeof SchedulePage !== 'undefined') {
      SchedulePage.showCreateModal({
        title: Utils.truncate(lastUserMsg.content, 30),
        description: lastUserMsg.content
      });
    }
  },

  _showToast(msg) {
    if (typeof App !== 'undefined' && App._showToast) {
      App._showToast(msg);
      return;
    }
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 2000);
  }
};
