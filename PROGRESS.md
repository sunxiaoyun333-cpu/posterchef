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

## Phase 3: 智能抠图 + 图片增强
- [ ] 浏览器端抠图（@imgly/background-removal）
- [ ] 服务端抠图降级 API
- [ ] Sharp 图片增强 API
- [ ] 处理结果展示 UI
- [ ] 运行验证

## Phase 4: 风格模板 + AI 背景生成
- [ ] 8种风格模板数据（styleTemplates.ts）
- [ ] 风格选择 UI（StepStyle.tsx）
- [ ] Imagen 3 背景生成 API
- [ ] Gemini Flash 图像生成降级方案
- [ ] 动态 Prompt 构建引擎
- [ ] 4方案选择 UI（StepBackground.tsx）
- [ ] 背景调节控制（明暗/虚化/色温）
- [ ] 自定义背景上传
- [ ] Mock 数据
- [ ] 运行验证

## Phase 5: AI 文案生成 + 编辑面板
- [ ] Gemini 2.5 Flash 文案生成 API
- [ ] 3套文案风格
- [ ] 文案编辑面板 UI（StepCopy.tsx）
- [ ] 显示/隐藏开关
- [ ] 语言模式切换
- [ ] Mock 数据
- [ ] 运行验证

## Phase 6: Canvas 海报编辑器
- [ ] Step 6A: Fabric.js 画布初始化 + 图层加载
- [ ] Step 6B: 文字元素加载 + 自动排版引擎
- [ ] Step 6C: 拖拽 + 选中 + 智能对齐辅助线
- [ ] Step 6D: 右侧属性面板
- [ ] Step 6E: 左侧图层面板 + 装饰素材库
- [ ] Step 6F: 顶部工具栏 + 撤销/重做
- [ ] Step 6G: 双击编辑文字
- [ ] 整体测试
- [ ] 运行验证

## Phase 7: 合成 + 导出
- [ ] 菜品+背景合成引擎（阴影/融合）
- [ ] PNG 导出
- [ ] JPG 导出
- [ ] PDF 印刷级导出（300dpi）
- [ ] 导出设置 UI（StepExport.tsx）
- [ ] 运行验证

## Phase 8: 优化 + 部署
- [ ] 性能优化
- [ ] 错误处理完善
- [ ] Mock 模式完善
- [ ] 移动端适配
- [ ] 环境变量配置
- [ ] README.md
- [ ] Vercel 部署准备
- [ ] 最终全流程测试
- [ ] 运行验证
