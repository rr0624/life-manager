# 分阶段开发执行计划

## Phase 0 — 基础设施 (已完成 ✅)
- [x] 创建 docs/ 文档体系
- [x] 创建 dev-logs/ 开发日志
- [x] 创建 CLAUDE.md 项目指引
- [x] 重写 db.js → LocalStorage
- [x] 重写 ai.js → DeepSeek API + 降级

## Phase 1 — 数据层验证
- [ ] 验证 LocalStorage 读写 CRUD
- [ ] 更新 utils.js 分类常量
- [ ] 写入开发日志

## Phase 2 — UI 骨架重构 (已完成 ✅)
- [x] 重写 style.css → 微信读书文艺风格
- [x] 重写 app.js → 三栏导航 + 设置页
- [x] 重写 nav.js → 3 Tab + 设置入口
- [x] 更新 utils.js → 修复 CSS 变量引用
- [x] 修复各页面模块 API 调用兼容性
- [x] 更新 index.html 主题色 + sw.js 缓存版本

## Phase 3 — 日常记录模块
- [ ] 重写 records.js → AI 对话界面
- [ ] 实现三种类型分流逻辑
- [ ] 实现摘录功能（长按/Enter 触发）
- [ ] 实现日记卡片生成
- [ ] 实现 AI 配置面板

## Phase 4 — 人生目标模块
- [ ] 重写 goals.js → 预设目标
- [ ] 实现可折叠 Markdown 编辑器
- [ ] 实现 AI 一键总结

## Phase 5 — 日程模块
- [ ] 更新 schedule.js → 快捷日期按钮
- [ ] 日历单元格日记标识
- [ ] 日期弹窗展示日记卡片

## Phase 6 — 数据迁移与集成
- [ ] 实现数据导出（JSON 下载）
- [ ] 实现数据导入（JSON 恢复）
- [ ] 全流程集成测试
- [ ] 更新 manifest.json + sw.js

---

## 当前状态
- **当前阶段**: Phase 3（日常记录模块完善）
- **最后更新**: 2026-07-11
