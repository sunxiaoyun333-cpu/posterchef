# CLAUDE.md — PosterChef 项目上下文

---

## 一、项目概述

### 项目名称
PosterChef — AI 菜品海报生成平台

### 一句话描述
美国餐厅老板上传菜品照片 → AI识别菜品+智能抠图 → 根据所选海报风格AI生成匹配背景 → 菜品与背景合成 → 生成中英双语营销文案 → 自动专业排版 → 可视化拖拽编辑 → 导出商业级印刷海报

### 目标用户
在美国经营中餐/亚洲餐厅的华人老板（中英文双语环境）

### 核心价值
让不懂设计的餐厅老板，用一张手机拍的菜品照片，3分钟内生成专业级商业海报

---

## 二、技术栈（必须严格遵守）

| 类别 | 技术选型 |
|------|---------|
| 框架 | Next.js 14（App Router）+ TypeScript（严格模式） |
| 样式 | Tailwind CSS + shadcn/ui |
| Canvas编辑器 | Fabric.js 6.x |
| 状态管理 | Zustand |
| 数据库 | Supabase（PostgreSQL + Storage） |
| **AI统一使用Google Gemini** | **一个API Key搞定所有AI功能** |
| — AI菜品识别 | Gemini 2.5 Flash（多模态视觉，看图识别菜品） |
| — AI文案生成 | Gemini 2.5 Flash（生成中英双语营销文案） |
| — AI背景生成 | Imagen 3（通过Gemini API调用），降级方案为 Gemini 2.5 Flash 原生图像生成 |
| AI SDK | @google/generative-ai（Google AI JavaScript SDK） |
| AI抠图 | @imgly/background-removal（浏览器端优先） |
| 图像处理 | Sharp（服务端） |
| 字体 | Google Fonts（中英文） |
| 导出 | jsPDF + Canvas toDataURL |
| 部署 | Vercel |

### AI SDK 使用规范

```typescript
// 统一的 Gemini 客户端初始化方式
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// 文本+视觉任务使用：
const flashModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// 图像生成优先使用 Imagen 3：
const imagenModel = genAI.getGenerativeModel({ model: 'imagen-3.0-generate-002' });

// 如果 Imagen 3 不可用，降级到 Gemini Flash 原生图像生成：
// 在 generateContent 时设置 generationConfig.responseModalities = ['image', 'text']