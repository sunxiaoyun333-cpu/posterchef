# PROGRESS.md — 开发进度追踪

## Phase 1: 项目初始化 + Landing Page ✅
- [x] Next.js 项目创建
- [x] 依赖安装（@google/generative-ai 等）
- [x] shadcn/ui 初始化（修复 v4→v3 兼容性）
- [x] 目录结构创建
- [x] 类型定义（lib/types.ts）
- [x] 常量定义（lib/constants.ts）
- [x] Gemini 客户端初始化（lib/ai/geminiClient.ts）
- [x] Landing Page 开发
- [x] 创建页面基础框架（/create 占位）
- [x] .env.example 创建
- [x] 运行验证（npm run build 通过）

## Phase 2: 上传 + AI 菜品识别 ✅
- [x] 图片上传组件（components/create/StepUpload.tsx）
- [x] Zustand 状态管理 + persist（lib/store/posterStore.ts）
- [x] Gemini 2.5 Flash 菜品识别 API（app/api/recognize/route.ts）
- [x] 菜品识别封装 + 重试逻辑（lib/ai/recognizeDish.ts）
- [x] 识别结果确认 UI（components/create/StepRecognize.tsx）
- [x] Mock 数据（lib/mock/mockDishInfo.ts）
- [x] 运行验证（npm run build 通过）

## Phase 3: 智能抠图 + 图片增强 ✅
- [x] 浏览器端抠图（@imgly/background-removal）
- [x] Sharp 图片增强 API（app/api/enhance/route.ts）
- [x] 处理结果展示 UI（StepGenerate.tsx）

## Phase 4: 风格模板 + AI 背景生成 ✅
- [x] 8 种风格模板（lib/constants.ts STYLE_TEMPLATES）
- [x] 风格选择 + 背景生成 UI（StepGenerate.tsx）
- [x] 背景生成 API（app/api/generate-background/route.ts）
- [x] Mock 数据支持

## Phase 5: AI 文案生成 + 编辑面板 ✅
- [x] Gemini 2.5 Flash 文案生成 API（app/api/generate-copy/route.ts）
- [x] 3 套文案风格（professional / casual / poetic）
- [x] 文案选择与编辑 UI（StepGenerate.tsx）
- [x] Mock 数据

## Phase 6: Canvas 海报编辑器 ✅
- [x] 6A: Fabric.js 画布初始化 + 三栏布局（StepEditor.tsx + PosterCanvas.tsx）
- [x] 6B: 排版引擎 + 文字层自动排版（lib/templates/layoutEngine.ts）
- [x] 6C: 拖拽 + 智能对齐辅助线 + 键盘操作（方向键 / Delete / ESC）
- [x] 6D: 右侧属性面板（PropertyPanel.tsx：文字/图片/画布属性）
- [x] 6E: 左侧图层面板 + 装饰素材库（LayerPanel.tsx）
- [x] 6F: 背景调节滑块（亮度 / 模糊 / 暖色调）
- [x] 6G: 导出入口 → 快照后跳转 Step 7

## Phase 7: 图像合成 + 高清导出 ✅
- [x] 服务端 Sharp 合成引擎（lib/image/compositeEngine.ts）
  - 背景 resize → 菜品居中 → 方向性投影阴影（multiply blend）
- [x] 合成 API（app/api/composite/route.ts）
- [x] 高清导出 API（app/api/export/route.ts）
  - PNG / JPG（mozjpeg）/ PDF（jsPDF）
  - 支持 1× / 2× / 3×（约 300 dpi 印刷级）
- [x] StepExport.tsx — 独立导出步骤页
  - 左 60%：海报全尺寸预览 + 点击放大（Lightbox）
  - 右 40%：格式卡片 + 72/150/300 dpi 单选 + 预估文件大小
  - 下载进度条 + 成功/失败反馈
  - 返回编辑 / 制作新海报
- [x] StepEditor → 截图存 store → 跳转 Step 7
- [x] posterPreviewUrl 字段加入 PosterState + store

## Phase 8: 全局优化 + 部署准备 ✅

### 性能优化
- [x] 浏览器端图片压缩（lib/image/compressImage.ts）：Canvas 缩放到最大 2048px，质量 0.85
- [x] URL.createObjectURL 管理大图预览，组件卸载时 revokeObjectURL
- [x] 统一 API 客户端 + AbortController 超时（lib/apiClient.ts）

### 错误处理
- [x] Error Boundary 组件（components/ui/ErrorBoundary.tsx）包裹所有步骤
- [x] Toast 通知系统（lib/toast.ts + components/ui/ToastContainer.tsx）
- [x] 中英双语错误提示（API 限流/超时/网络断开）
- [x] Gemini rate_limit 不重试，超时有友好提示
- [x] 网络断开/恢复检测（lib/hooks/useNetworkStatus.ts）

### Mock 模式
- [x] NEXT_PUBLIC_MOCK_MODE=true 时全部 AI 接口返回 Mock 数据
- [x] 全流程可走通：上传→识别→抠图→背景→文案→编辑→导出
- [x] Mock Mode 标签显示（components/ui/MockModeBadge.tsx）

### UI/UX 优化
- [x] framer-motion 步骤切换淡入淡出动画（app/create/page.tsx）
- [x] 编辑器按 ? 显示快捷键帮助弹窗（components/editor/ShortcutHelpDialog.tsx）
- [x] Landing Page 滚动触发动画 + 完全响应式

### 移动端适配
- [x] Landing Page 完全响应式（sm: breakpoints）
- [x] 步骤 1-5 在移动端可用
- [x] Step 6 编辑器移动端显示提示卡 + 直接导出按钮

### 部署准备
- [x] .env.example 更新（GEMINI_API_KEY + NEXT_PUBLIC_MOCK_MODE）
- [x] README.md 完整文档（功能/技术栈/快速开始/部署指南）
- [x] vercel.json 配置（函数超时 maxDuration）
- [x] API 路由 maxDuration 导出（recognize: 60s, generate-copy: 60s, 其余 30s）
- [x] next.config.mjs swcMinify:false（解决 @imgly/background-removal ONNX 构建问题）
- [x] npm run build 零错误通过 ✅

---

## 🎉 项目完成状态

**所有 8 个 Phase 已全部完成。**

### 已完成功能清单
1. AI 菜品识别（Gemini 2.5 Flash 多模态）
2. 智能浏览器端抠图（@imgly/background-removal ONNX WASM）
3. 8 种美国餐厅风格背景生成（Imagen 3 / Gemini Flash 降级）
4. 中英双语营销文案生成（3 套风格：正式/亲切/促销）
5. Fabric.js 可视化拖拽编辑器（图层/文字/装饰/属性面板）
6. 服务端 Sharp 图像合成（投影阴影 multiply blend）
7. 印刷级高清导出（PNG/JPG/PDF，72/150/300 dpi）
8. 全局错误处理 + Toast 通知 + Error Boundary
9. Mock 模式完整演示流程
10. 移动端响应式适配

### 已知待优化项
- Imagen 3 在部分地区不可用，自动降级 Gemini Flash 图像生成
- 浏览器端抠图首次需下载 ~40MB ONNX 模型
- Canvas 编辑器在移动端体验受限（已有提示卡 + 直接导出）
- Vercel Hobby 计划 10s 超时限制（建议 Pro 计划）

### 后续迭代建议
- 用户账号系统（Supabase Auth）+ 海报历史记录
- Stripe 付费订阅（高清导出解锁）
- 批量生成（菜单级别，多道菜一次性生成）
- 模板市场（用户上传/购买模板）
- 多语言支持（越南语/韩语等）
- 品牌套件（Logo + 品牌色一键应用）
