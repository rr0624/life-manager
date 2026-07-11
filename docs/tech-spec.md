# 技术架构规格

## 技术栈
| 层级 | 选型 |
|------|------|
| 框架 | 无框架，原生 HTML/CSS/JS |
| 存储 | LocalStorage（Key 前缀 `lm_`） |
| AI | DeepSeek Chat API（可自定义 endpoint） |
| 离线 | Service Worker（Cache First） |
| 部署 | 静态文件服务器 |

## 数据模型

### LocalStorage Keys
```
lm_goals       → Goal[]
lm_records     → Record[]  
lm_schedules   → Schedule[]
lm_reviews     → Review[]
lm_diaryCards  → DiaryCard[]
lm_excerpts    → Excerpt[] (临时)
lm_settings    → Settings
```

### Goal
```json
{
  "id": 1700000000000,
  "category": 1,
  "title": "英语六级",
  "description": "",
  "branches": [
    { "id": "b1", "title": "背单词", "content": "每天50个", "done": false }
  ],
  "createdAt": "ISO",
  "updatedAt": "ISO"
}
```

### Record
```json
{
  "id": 1700000000000,
  "content": "今天学了2小时英语",
  "type": "schedule",
  "category": 1,
  "mood": "happy",
  "aiReply": "加油！",
  "bookQuote": "",
  "createdAt": "ISO"
}
```

### Schedule
```json
{
  "id": 1700000000000,
  "title": "背单词",
  "description": "",
  "date": "2026-07-11",
  "time": "09:00",
  "completed": false,
  "goalId": null,
  "createdAt": "ISO"
}
```

### DiaryCard
```json
{
  "id": 1700000000000,
  "date": "2026-07-11",
  "excerpts": ["原文1", "原文2"],
  "aiSummary": "AI总结内容",
  "createdAt": "ISO"
}
```

### Settings
```json
{
  "aiApiUrl": "",
  "aiApiKey": "",
  "theme": "light"
}
```

## API 调用规范

### DeepSeek Request
```
POST https://api.deepseek.com/v1/chat/completions
Authorization: Bearer {apiKey}
Content-Type: application/json

{
  "model": "deepseek-chat",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "temperature": 0.7,
  "max_tokens": 1024
}
```

### AI Response JSON
```json
{
  "type": "schedule|chat|note",
  "category": "学习",
  "targetName": "英语六级",
  "todoItems": ["背单词", "做真题"],
  "aiReply": "加油！保持这个节奏。",
  "bookQuote": ""
}
```

## 降级策略
当 API 未配置、网络失败、JSON 解析失败时，自动降级到本地关键词匹配分析。
