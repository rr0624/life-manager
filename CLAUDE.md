# 生活管理 · Life Manager — 项目开发指引

## 项目概述
纯前端 PWA 生活管理应用。日程、目标、日常记录一站式管理，集成 DeepSeek AI。

## 技术栈
- 原生 HTML/CSS/JS，无框架、无构建工具
- LocalStorage 本地存储（无后端、无数据库）
- DeepSeek API（可自定义接口地址）
- PWA（Service Worker 离线缓存）

## 文档索引

| 文件 | 说明 |
|------|------|
| [docs/requirements.md](docs/requirements.md) | 完整功能需求规格 |
| [docs/tech-spec.md](docs/tech-spec.md) | 技术架构与数据模型 |
| [docs/design-spec.md](docs/design-spec.md) | UI 设计规范（微信读书文艺风格） |
| [docs/dev-plan.md](docs/dev-plan.md) | 分阶段开发执行计划 |
| [dev-logs/](dev-logs/) | 每日开发日志 |

## 工作约定

### 开发原则
1. **增量修改** — 每次只改一个模块，保持其他模块稳定
2. **先读后写** — 修改前必须先 Read 目标文件
3. **每阶段验证** — 完成一个 Phase 后刷新浏览器确认功能正常
4. **不引入外部依赖** — 禁止 CDN、第三方 JS 库
5. **保持视觉统一** — 所有 UI 遵循 [docs/design-spec.md](docs/design-spec.md)

### 文件结构
```
/
├── index.html          # 入口
├── manifest.json       # PWA 清单
├── sw.js              # Service Worker
├── CLAUDE.md          # 本文件
├── docs/              # 开发文档
│   ├── requirements.md
│   ├── tech-spec.md
│   ├── design-spec.md
│   └── dev-plan.md
├── dev-logs/          # 开发日志 (YYYY-MM-DD.md)
├── css/
│   └── style.css      # 全局样式
└── js/
    ├── app.js         # 应用入口 + 设置页
    ├── nav.js         # 底部导航
    ├── db.js          # LocalStorage 数据层
    ├── utils.js       # 工具函数 + 分类常量
    ├── ai.js          # DeepSeek API + 降级分析
    ├── records.js     # 日常记录（AI 对话 + 摘录 + 日记）
    ├── goals.js       # 人生目标（预设 + 折叠编辑）
    ├── schedule.js    # 日程（时间线 + 日历 + 列表 + 同步 + 分支）
```

### 数据模型 (LocalStorage Keys)
- `lm_goals` — 目标列表
- `lm_records` — 日常记录
- `lm_schedules` — 日程列表
- `lm_reviews` — 月度复盘
- `lm_diaryCards` — 日记卡片
- `lm_excerpts` — 摘录缓存（临时）
- `lm_settings` — AI 配置 + 主题

### 开发流程
1. 查看 [docs/dev-plan.md](docs/dev-plan.md) 确认当前阶段
2. 阅读对应的需求规格和技术文档
3. 实现代码，遵循设计规范
4. 每次修改后刷新 `http://localhost:3000` 验证
5. 完成后写入 [dev-logs/](dev-logs/) 当日日志

### 启动开发服务器
```bash
cd "c:/Users/ranxinyue/Desktop/app"
python3 -m http.server 3000
```
访问 `http://localhost:3000`，强制刷新 `Ctrl+Shift+R`。
