// AI 模块 — DeepSeek API 纯对话集成
const AI = {
  _chatContext: [],

  // 自然对话 System Prompt
  SYSTEM_PROMPT: `你是「小叶子」🌿，温暖、有洞察力的生活助手。

核心：深入倾听，帮用户看清问题本质，给出有启发的分析和具体可行的建议。

风格：像有智慧的朋友聊天，自然温柔，适当使用 emoji。先理解再回应，不确定时追问。

格式禁令（严格遵守）：
禁止使用任何 Markdown 符号：##、**、-、*、>、\`、\`\`\` 等
不要用列表符号分点，用自然换行叙述
像平时发微信一样说话，不是写文档`,

  // 获取配置
  _getConfig() {
    const s = DB.getSettings();
    return {
      url: s.aiApiUrl || 'https://api.deepseek.com/v1/chat/completions',
      key: s.aiApiKey || ''
    };
  },

  // 通用 API 调用
  async _callAPI(messages, systemPrompt) {
    const config = this._getConfig();
    if (!config.key) return null;

    try {
      const resp = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.key}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt || this.SYSTEM_PROMPT },
            ...messages
          ],
          temperature: 0.7,
          max_tokens: 2048
        })
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        console.error('AI API error:', resp.status, errText);
        if (resp.status === 401) throw new Error('API Key 无效，请检查设置');
        if (resp.status === 403) throw new Error('API 访问被拒绝，请检查 Key 权限');
        throw new Error(`API 请求失败 (${resp.status})`);
      }

      const data = await resp.json();
      return data.choices?.[0]?.message?.content || null;
    } catch (e) {
      console.error('AI API exception:', e);
      return null;
    }
  },

  // ===== 纯对话接口（非流式，保留兼容） =====
  async chat(userMessage) {
    const config = this._getConfig();
    if (!config.key) return null;

    this._chatContext.push({ role: 'user', content: userMessage });

    const result = await this._callAPI(this._chatContext);

    if (result) {
      this._chatContext.push({ role: 'assistant', content: result });
      if (this._chatContext.length > 20) {
        this._chatContext = this._chatContext.slice(-20);
      }
      return result;
    }
    return null;
  },

  // ===== 流式对话接口（边生成边显示） =====
  async chatStream(userMessage, { onChunk, onDone, onError } = {}) {
    const config = this._getConfig();
    if (!config.key) {
      if (onError) onError(new Error('请先配置 API Key'));
      return;
    }

    this._chatContext.push({ role: 'user', content: userMessage });
    if (this._chatContext.length > 20) {
      this._chatContext = this._chatContext.slice(-20);
    }

    let fullText = '';

    try {
      const resp = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.key}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: this.SYSTEM_PROMPT },
            ...this._chatContext
          ],
          temperature: 0.7,
          max_tokens: 2048,
          stream: true
        })
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        const err = new Error(resp.status === 401 ? 'API Key 无效' : resp.status === 403 ? '访问被拒绝' : `请求失败 (${resp.status})`);
        if (onError) onError(err);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') continue;

          try {
            const data = JSON.parse(dataStr);
            const delta = data.choices?.[0]?.delta?.content;
            if (delta) {
              fullText += delta;
              if (onChunk) onChunk(delta, fullText);
            }
          } catch (e) { /* skip malformed JSON */ }
        }
      }

      if (fullText) {
        this._chatContext.push({ role: 'assistant', content: fullText });
      }
      if (onDone) onDone(fullText);

    } catch (e) {
      console.error('Stream error:', e);
      if (onError) onError(e);
    }
  },

  clearChat() { this._chatContext = []; },

  // ===== 摘录总结 =====
  async summarizeExcerpts(excerpts) {
    const text = excerpts.map(e => e.text).join('\n---\n');
    const result = await this._callAPI([
      { role: 'user', content: `请对以下摘录文本进行通顺精简的总结，语言温柔文艺，适合做成日记内容。只返回总结正文：\n\n${text}` }
    ], '你是文艺温柔的文字助手，帮助用户总结摘录。');
    return result || excerpts.map(e => e.text).join('；');
  },

  // ===== 目标 AI 总结建议 =====
  async summarizeGoals(goals) {
    const goalText = goals.map(g => {
      const cat = Utils.getCategory(g.category);
      return `【${cat.name}】${g.title}\n${(g.branches || []).map(b => `  - ${b.title}: ${b.content || ''}`).join('\n')}`;
    }).join('\n\n');

    const result = await this._callAPI([
      { role: 'user', content: `请对以下人生目标与执行计划进行总结，输出阶段性优化行动建议（200字以内，语言温暖有力量）：\n\n${goalText}` }
    ], '你是人生规划助手，请用温暖、鼓励的语气给出建议。只返回建议正文。');

    return result || '目标清晰，执行有力，继续保持！';
  },

  // ===== 目标计划建议 =====
  _planTemplates: {
    1: [
      { title: '背单词', desc: '每天背50个单词，复习前日内容', icon: '📖' },
      { title: '做真题', desc: '限时完成一套真题并批改分析', icon: '📝' },
      { title: '上网课', desc: '观看课程视频，做好笔记', icon: '💻' },
      { title: '整理笔记', desc: '归纳知识体系，建立思维导图', icon: '🗂️' },
      { title: '晨读训练', desc: '每天30分钟朗读/听力练习', icon: '🎧' },
      { title: '专项突破', desc: '针对薄弱环节集中练习', icon: '🎯' }
    ],
    2: [
      { title: '投递简历', desc: '每天投递5-10份匹配岗位', icon: '📮' },
      { title: '面试准备', desc: '准备常见面试问题和自我介绍', icon: '💼' },
      { title: '技能提升', desc: '学习行业相关技能或考证', icon: '🔧' },
      { title: '人脉拓展', desc: '参加行业活动，更新 LinkedIn', icon: '🤝' },
      { title: '工作总结', desc: '每周复盘工作得失和改进方向', icon: '📋' },
      { title: '项目推进', desc: '制定项目计划并推进关键节点', icon: '📊' }
    ],
    3: [
      { title: '记账', desc: '记录每日收支，月底分析', icon: '💰' },
      { title: '储蓄计划', desc: '每月固定储蓄，设定目标金额', icon: '🏦' },
      { title: '学习理财', desc: '阅读理财书籍，了解基金/股票', icon: '📈' },
      { title: '断舍离', desc: '每周清理不需要的物品', icon: '🧹' },
      { title: '采购清单', desc: '列出需要购买的物品，比价购买', icon: '🛒' },
      { title: '开源节流', desc: '探索副业收入，优化固定支出', icon: '💡' }
    ],
    4: [
      { title: '晨跑', desc: '早起跑步30分钟，保持心率140+', icon: '🏃' },
      { title: '早睡打卡', desc: '23:00前入睡，记录睡眠质量', icon: '😴' },
      { title: '健身训练', desc: '力量训练1小时，按计划训练', icon: '🏋️' },
      { title: '冥想放松', desc: '每天冥想15分钟，减压放松', icon: '🧘' },
      { title: '健康饮食', desc: '少油少盐，多蔬菜蛋白质', icon: '🥗' },
      { title: '定期体检', desc: '预约体检，关注身体指标', icon: '🏥' }
    ],
    5: [
      { title: '周末出游', desc: '探索周边城市/景点', icon: '🚗' },
      { title: '看电影', desc: '每周看一部电影写短评', icon: '🎬' },
      { title: '读书计划', desc: '每月读一本书，写读书笔记', icon: '📚' },
      { title: '学习兴趣', desc: '培养一个兴趣爱好（乐器/绘画/摄影）', icon: '🎨' },
      { title: '旅行规划', desc: '规划下次旅行路线和预算', icon: '✈️' },
      { title: '美食打卡', desc: '探店新餐厅，记录美食体验', icon: '🍜' }
    ],
    6: [
      { title: '打电话给父母', desc: '每周和父母视频/电话聊天', icon: '📞' },
      { title: '朋友聚会', desc: '约朋友吃饭/聊天/活动', icon: '🎉' },
      { title: '陪伴伴侣', desc: '和伴侣共度 quality time', icon: '💑' },
      { title: '生日备忘', desc: '记录亲友生日，准备礼物', icon: '🎂' },
      { title: '社交活动', desc: '参加社群活动，认识新朋友', icon: '👥' },
      { title: '感恩日记', desc: '每天写下一件感恩的事', icon: '🙏' }
    ]
  },

  suggestPlans(title) {
    if (!title || !title.trim()) return [];
    const q = title.trim().toLowerCase();
    const keywordMap = {
      '四级': 1, '六级': 1, '英语': 1, '雅思': 1, '托福': 1, '考研': 1,
      '日语': 1, '韩语': 1, '法语': 1, '考试': 1, '考证': 1, '学习': 1,
      '编程': 1, '代码': 1, '网课': 1, '读书': 1, '阅读': 1,
      '面试': 2, '求职': 2, '工作': 2, '跳槽': 2, '实习': 2, '简历': 2,
      '职业': 2, '升职': 2, '国企': 2, '互联网': 2, '事业': 2,
      '存钱': 3, '理财': 3, '省钱': 3, '买房': 3, '买车': 3, '攒钱': 3,
      '购物': 3, '预算': 3, '记账': 3, '资产': 3, '财务': 3,
      '减肥': 4, '健身': 4, '跑步': 4, '瑜伽': 4, '早睡': 4, '运动': 4,
      '健康': 4, '减脂': 4, '作息': 4, '冥想': 4,
      '旅行': 5, '旅游': 5, '电影': 5, '美食': 5, '娱乐': 5, '心愿': 5,
      '演唱会': 5, '游玩': 5, '兴趣': 5, '打卡': 5,
      '朋友': 6, '家人': 6, '父母': 6, '伴侣': 6, '恋爱': 6, '人际': 6,
      '社交': 6, '约会': 6, '闺蜜': 6, '兄弟': 6, '关系': 6, '情感': 6
    };
    let bestCat = null;
    for (const [kw, cat] of Object.entries(keywordMap)) {
      if (q.includes(kw)) { bestCat = cat; break; }
    }
    if (!bestCat) return [];
    const templates = this._planTemplates[bestCat] || [];
    return templates.map((t, i) => ({ id: `plan-${bestCat}-${i}`, ...t, selected: false }));
  },

  getGeneralPlans(catId) {
    const templates = this._planTemplates[catId] || [];
    return templates.map((t, i) => ({ id: `plan-${catId}-${i}`, ...t, selected: false }));
  },

  // ===== 日程提示词库 =====
  schedulePrompts: [
    { title: '背单词', desc: '背50个单词，复习昨日词汇', icon: '📖' },
    { title: '做真题', desc: '限时完成1套真题，批改分析', icon: '📝' },
    { title: '上网课', desc: '观看课程视频，做好笔记', icon: '💻' },
    { title: '面试准备', desc: '准备面试常见问题', icon: '💼' },
    { title: '跑步', desc: '跑步30分钟，保持心率140+', icon: '🏃' },
    { title: '健身', desc: '力量训练1小时', icon: '🏋️' },
    { title: '记账', desc: '记录今日所有收支', icon: '💰' },
    { title: '打电话给父母', desc: '和父母视频聊天', icon: '📞' },
    { title: '看电影', desc: '看一部电影写短评', icon: '🎬' },
    { title: '早睡', desc: '23:00前上床睡觉', icon: '😴' },
    { title: '冥想', desc: '冥想15分钟放松心情', icon: '🧘' },
    { title: '约会', desc: '和伴侣共度愉快时光', icon: '💑' }
  ],

  suggestSchedulePrompts(query) {
    if (!query || !query.trim()) return this.schedulePrompts.slice(0, 8);
    const q = query.trim().toLowerCase();
    const scored = this.schedulePrompts.map(p => {
      let s = 0;
      if (p.title.includes(q)) s += 10;
      if (p.desc.includes(q)) s += 5;
      for (const c of q) { if (p.title.includes(c)) s += 1; }
      return { ...p, score: s };
    });
    return scored.filter(p => p.score > 0).sort((a, b) => b.score - a.score).slice(0, 8);
  },

  // 匹配目标
  async matchGoal(category, goals) {
    if (!goals || !goals.length) return null;
    const catGoals = goals.filter(g => g.category === category);
    if (!catGoals.length) return null;
    return catGoals[0].id;
  }
};
