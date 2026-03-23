// ============================================================
// PosterChef — 全局类型定义
// ============================================================

// ---------- 菜品识别 ----------
export interface DishInfo {
  name: string;                // 菜品中文名
  nameEn: string;              // 菜品英文名
  cuisine: string;             // 菜系（Sichuan, Cantonese, etc.）
  description: string;         // 简短描述（中文）
  descriptionEn: string;       // 简短描述（英文）
  mainColors: string[];        // 菜品主色调（3个 hex 值）
  ingredients: string[];       // 主要食材
  lightingDirection: string;   // 光线方向（left/right/top/front/ambient）
  shootingAngle: string;       // 拍摄角度（overhead/45deg/side/front）
  servingVessel: string;       // 盛器描述
  confidence: number;          // 识别置信度（0-1）
  tags: string[];              // 菜品标签（辣、素食、招牌等）
}

// Gemini API 返回的原始 snake_case 格式
export interface RawDishApiResponse {
  name_cn: string;
  name_en: string;
  cuisine: string;
  description_cn: string;
  description_en: string;
  main_colors: string[];
  ingredients: string[];
  lighting_direction: string;
  shooting_angle: string;
  serving_vessel: string;
  confidence: number;
}

// ---------- 海报风格模板 ----------
export type StyleId =
  | 'chinese-red'
  | 'modern-dark'
  | 'fresh-green'
  | 'warm-orange'
  | 'elegant-black'
  | 'festive-gold'
  | 'minimalist-white'
  | 'street-food';

export interface StyleTemplate {
  id: StyleId;
  name: string;         // 风格名称（中文）
  nameEn: string;       // 风格名称（英文）
  description: string;  // 风格描述
  primaryColor: string; // 主色调（hex）
  accentColor: string;  // 强调色（hex）
  bgPrompt: string;     // 用于生成背景的 prompt 关键词
  fontStyle: 'serif' | 'sans' | 'display';
  mood: string;         // 氛围关键词（用于 AI 生成）
}

// ---------- AI 生成的背景图 ----------
export interface BackgroundOption {
  id: string;
  url: string;           // base64 或 blob URL
  prompt: string;        // 生成此图使用的 prompt
  style: StyleId;
}

// ---------- 营销文案 ----------
export interface CopySet {
  id: string;
  style: 'professional' | 'casual' | 'poetic';
  headline: string;        // 主标题（中文）
  headlineEn: string;      // 主标题（英文）
  subheadline: string;     // 副标题（中文）
  subheadlineEn: string;   // 副标题（英文）
  tagline: string;         // slogan（中文）
  taglineEn: string;       // slogan（英文）
  price?: string;          // 价格文本（可选）
}

// ---------- 海报画布元素 ----------
export type ElementType = 'dish' | 'background' | 'text' | 'decoration' | 'price';

export interface PosterElement {
  id: string;
  type: ElementType;
  visible: boolean;
  locked: boolean;
  // Fabric.js 对象由 canvas 管理，这里只存 metadata
  fabricId?: string;
}

// ---------- 全局流程状态 ----------
export type StepId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface PosterState {
  // 流程步骤
  currentStep: StepId;

  // Step 1: 上传
  originalImage: string | null;       // 原始图片（base64 / blob URL）
  originalImageFile: File | null;

  // Step 2: 识别结果
  dishInfo: DishInfo | null;
  isRecognizing: boolean;

  // Step 3: 抠图 + 增强
  removedBgImage: string | null;      // 透明背景 PNG（data URL）
  enhancedImage: string | null;       // 增强后的原图（data URL）
  processedImage: string | null;      // 用户最终选择的图片（传入海报合成）
  isProcessing: boolean;              // 抠图/增强进行中
  removeBgProgress: number;           // 抠图进度 0-100
  enhanceProgress: number;            // 增强进度 0-100
  useRemovedBg: boolean;              // true=用抠图, false=用原图

  // Step 4: 风格 & 背景
  selectedStyle: StyleId | null;
  generatedBackgrounds: BackgroundOption[];
  selectedBackground: BackgroundOption | null;
  isGeneratingBackground: boolean;

  // Step 5: 文案
  generatedCopySets: CopySet[];
  selectedCopy: CopySet | null;
  isGeneratingCopy: boolean;

  // Step 6: 编辑器
  posterElements: PosterElement[];
  canvasWidth: number;
  canvasHeight: number;
  posterPreviewUrl: string | null;   // Step 6 导出的预览截图，供 Step 7 展示

  // 全局
  isMockMode: boolean;
  error: string | null;
}

// ---------- API 响应类型 ----------
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface RecognizeResponse {
  dish: DishInfo;
}

export interface BackgroundResponse {
  backgrounds: BackgroundOption[];
}

export interface CopyResponse {
  copySets: CopySet[];
}
