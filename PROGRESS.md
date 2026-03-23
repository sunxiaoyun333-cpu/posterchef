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

## Phase 8: 优化 + 部署
- [ ] 性能优化
- [ ] 错误处理完善
- [ ] Mock 模式完善
- [ ] 移动端适配
- [ ] 环境变量配置
- [ ] README.md
- [ ] Vercel 部署准备
- [ ] 最终全流程测试
