# 🍽️ PosterChef — AI 菜品海报生成平台

> 上传一张手机拍的菜品照片，3分钟生成专业级商业印刷海报。
> Upload a phone photo of your dish — get a professional print-ready poster in 3 minutes.

专为美国华人餐厅老板打造 · Built for Chinese restaurant owners in the US

---

## 功能特点 Features

| 功能 | 说明 |
|------|------|
| 🤖 AI 菜品识别 | Gemini 2.5 Flash 多模态视觉，自动识别菜名、菜系、食材 |
| ✂️ 智能抠图 | 浏览器端实时抠图，透明背景 PNG，无需上传到服务器 |
| 🎨 AI 背景生成 | Imagen 3 生成 8 种主流美国餐厅风格背景 |
| ✍️ 双语文案 | Gemini 自动生成中英双语营销文案（3套风格可选） |
| 🖼️ 可视化编辑 | Fabric.js 拖拽编辑器，支持图层/文字/装饰素材/对齐辅助线 |
| 📄 高清导出 | PNG / JPG / PDF，支持 72/150/300 dpi，印刷级品质 |
| 📱 移动端友好 | Landing Page + 步骤 1-5 支持移动端，编辑器提供直接导出选项 |
| 🧪 Mock 模式 | 无 API Key 时可完整体验全流程（开发演示用） |

---

## 技术栈 Tech Stack

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 14 (App Router) + TypeScript |
| 样式 | Tailwind CSS + shadcn/ui |
| 状态管理 | Zustand (with persist) |
| Canvas 编辑器 | Fabric.js 6.x |
| 动画 | framer-motion |
| AI — 识别/文案 | Google Gemini 2.5 Flash (`@google/generative-ai`) |
| AI — 背景生成 | Google Imagen 3 (via Gemini API) |
| 浏览器端抠图 | `@imgly/background-removal` (ONNX Runtime WASM) |
| 服务端图像处理 | Sharp |
| PDF 导出 | jsPDF |
| 部署 | Vercel |

---

## 快速开始 Quick Start

### 1. 克隆项目

```bash
git clone https://github.com/your-username/posterchef.git
cd posterchef
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

```bash
cp .env.example .env.local
```

编辑 `.env.local`，填入你的 Gemini API Key：

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

> 在 [Google AI Studio](https://aistudio.google.com/apikey) 免费获取 API Key

### 4. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)

### 5. 无 API Key？使用 Mock 模式

```bash
# .env.local
NEXT_PUBLIC_MOCK_MODE=true
```

Mock 模式下所有 AI 功能返回预设数据，可完整体验上传→识别→抠图→背景→文案→编辑→导出全流程。

---

## 环境变量说明 Environment Variables

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `GEMINI_API_KEY` | ✅ 必填 | Google Gemini API Key，驱动所有 AI 功能 |
| `NEXT_PUBLIC_MOCK_MODE` | 可选 | `true` 启用 Mock 模式（默认 `false`） |
| `NEXT_PUBLIC_SUPABASE_URL` | 可选 | Supabase 项目 URL（如需数据库/存储） |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 可选 | Supabase 匿名 Key |

---

## 部署到 Vercel Deploy to Vercel

### 一键部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/posterchef)

### 手动部署

1. 将代码推送到 GitHub
2. 在 [Vercel](https://vercel.com) 导入项目
3. 在项目设置 → Environment Variables 中添加：
   - `GEMINI_API_KEY` = 你的 Gemini API Key
4. 点击 Deploy

### 注意事项

- AI 背景生成（Imagen 3）可能需要 30-60 秒，建议使用 **Vercel Pro**（支持 60 秒 Function 超时）
- Vercel Hobby 计划函数超时为 10 秒，AI 背景生成会降级使用 Gemini Flash 图像生成
- `sharp` 在 Vercel 上自动使用平台原生二进制，无需额外配置

---

## 项目结构 Project Structure

```
posterchef/
├── app/
│   ├── api/
│   │   ├── recognize/        # AI 菜品识别
│   │   ├── enhance/          # 图片增强
│   │   ├── remove-bg/        # 服务端抠图（降级方案）
│   │   ├── generate-copy/    # AI 文案生成
│   │   ├── composite/        # 图像合成
│   │   └── export/           # 高清导出（PNG/JPG/PDF）
│   ├── create/               # 创建流程页面（7步）
│   └── page.tsx              # Landing Page
├── components/
│   ├── create/               # 步骤组件（Upload/Recognize/Generate/Editor/Export）
│   ├── editor/               # 编辑器子组件（Canvas/Panels/Dialogs）
│   └── ui/                   # 通用 UI 组件（Toast/ErrorBoundary/Badge）
├── lib/
│   ├── ai/                   # AI 调用封装（recognizeDish/geminiClient）
│   ├── hooks/                # 自定义 Hooks（useNetworkStatus）
│   ├── image/                # 图像处理（compress/removeBackground/composite）
│   ├── mock/                 # Mock 数据
│   ├── store/                # Zustand 状态管理
│   └── templates/            # 排版引擎 + 布局模板
└── next.config.mjs           # Next.js 配置（swcMinify:false 解决 ONNX 兼容性）
```

---

## 使用流程 User Flow

```
1. 上传照片  →  2. AI 识别  →  3. 智能抠图
         ↓
4. 选择风格  →  5. 生成文案  →  6. 编辑器
         ↓
              7. 高清导出（PNG / JPG / PDF）
```

---

## 已知限制 Known Limitations

- **Imagen 3 区域限制**：部分地区可能无法使用 Imagen 3，自动降级为 Gemini Flash 图像生成
- **浏览器端抠图**：首次加载需下载 ONNX 模型（~40MB），建议在网络良好环境使用
- **移动端编辑器**：Fabric.js Canvas 编辑器在移动端体验受限，建议使用桌面端
- **Vercel Hobby 超时**：AI 背景生成在免费计划可能超时，建议升级 Pro 或使用 Mock 模式演示

---

## 后续迭代 Roadmap

- [ ] 用户账号系统（Supabase Auth）
- [ ] 海报历史记录与云端存储
- [ ] Stripe 付费订阅（高清导出 / 商业用途）
- [ ] 批量海报生成（菜单级别）
- [ ] 模板市场（用户上传/购买模板）
- [ ] 多语言支持（越南语、韩语等亚洲餐厅场景）
- [ ] 品牌套件（Logo 上传 + 品牌色一键应用）
- [ ] 小程序/微信版本

---

## License

MIT © 2024 PosterChef
