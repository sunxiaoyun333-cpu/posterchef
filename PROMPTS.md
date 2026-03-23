# PosterChef 分阶段开发 Prompt

---

## 🚀 启动 Prompt（第一条消息）

请阅读项目根目录的 CLAUDE.md 文件，完整理解本项目的需求、技术栈、约束条件和目录结构。

然后阅读 PROGRESS.md 了解当前开发进度。

关键要点：
1. 本项目所有 AI 功能统一使用 Google Gemini API（一个 GEMINI_API_KEY 搞定全部）
2. 菜品识别和文案生成使用 Gemini 2.5 Flash
3. 背景图像生成优先使用 Imagen 3，不可用时降级到 Gemini 2.5 Flash 原生图像生成
4. SDK 使用 @google/generative-ai
5. 不要引入 openai 或 @anthropic-ai/sdk

确认你已完整理解后，告诉我你的理解，然后我们开始 Phase 1。

---

## 🟢 Phase 1: 项目初始化 + Landing Page

请执行以下操作：

1. 在当前目录初始化 Next.js 14 项目：
   - 使用 App Router
   - 使用 TypeScript（严格模式）
   - 使用 Tailwind CSS
   - 项目名：posterchef

2. 安装所有依赖：
   ```bash
   npm install @google/generative-ai fabric zustand @supabase/supabase-js sharp lucide-react framer-motion jspdf file-saver uuid
   npm install -D @types/fabric @types/file-saver @types/uuid