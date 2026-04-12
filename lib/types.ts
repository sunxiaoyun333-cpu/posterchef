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

// ---------- 海报风格（Phase 9 新版）----------
export type StyleId =
  | 'modern-minimalist'
  | 'rustic-farmhouse'
  | 'elegant-fine-dining'
  | 'bright-cafe'
  | 'vintage-chalkboard'
  | 'bold-pop';

// ---------- AI 生成的背景图（兼容旧字段，Phase 9 不再使用）----------
export interface BackgroundOption {
  id: string;
  url: string;
  prompt: string;
  style: StyleId;
}

/** 旧版画布 / layoutEngine 用的风格模板（与 STYLE_TEMPLATES 对应） */
export type TemplateFontStyle = 'serif' | 'sans' | 'display';

export interface StyleTemplate {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  primaryColor: string;
  accentColor: string;
  bgPrompt: string;
  fontStyle: TemplateFontStyle;
  mood: string;
}

// ---------- 内容分拣站 & AI 双场景海报文案 ----------
export type SceneMode = 'social' | 'offline' | 'clean' | 'diy';
export type LanguageMode = 'cn' | 'en' | 'both';

export interface MarketingCopy {
  cn: string;
  en: string;
}

/** social / offline 各一套；extra_text 在社交媒体侧重 Vibe，在线下侧重 Highlights */
export interface PosterScheme {
  main_title: MarketingCopy;
  sub_title: MarketingCopy;
  extra_text?: MarketingCopy;
}

/** 识图 + 生图侧与分拣站共用的结构化海报文案 */
export interface PosterData {
  name_cn: string;
  name_en: string;
  /** AI 原始生图描述（识图阶段写入，勿直接覆盖） */
  visual_prompt: string;
  /**
   * 可选：前端根据分拣站编辑计算后的「视觉摘要」全文（= visual_prompt + 用户纠偏句），
   * 仅用于展示或调试；实际生图请使用 `computeSyncedVisualPrompt()` 动态合并。
   */
  visual_summary?: string;
  schemes: {
    social: PosterScheme;
    offline: PosterScheme;
  };
}

// ---------- 营销文案 ----------
export interface CopySet {
  id: string;
  style: 'professional' | 'casual' | 'poetic';
  headline: string;
  headlineEn: string;
  subheadline: string;
  subheadlineEn: string;
  tagline: string;
  taglineEn: string;
  price?: string;
}

// ---------- 海报画布元素 ----------
export type ElementType = 'dish' | 'background' | 'text' | 'decoration' | 'price';

export interface PosterElement {
  id: string;
  type: ElementType;
  visible: boolean;
  locked: boolean;
  fabricId?: string;
}

// ---------- 全局流程状态 ----------
export type StepId = 1 | 2 | 3 | 4 | 5;

export interface PosterState {
  currentStep: StepId;

  // Step 1: 上传
  originalImage: string | null;
  originalImageFile: File | null;

  /** 编辑流水线中间态（StepEditor / StepExport） */
  processedImage: string | null;
  removedBgImage: string | null;
  enhancedImage: string | null;

  // Step 2: 识别结果
  dishInfo: DishInfo | null;
  isRecognizing: boolean;

  // Step 3: 风格选择 + AI 生图 (Phase 9)
  selectedStyle: StyleId | null;
  generatedBackgrounds: BackgroundOption[];
  selectedBackground: BackgroundOption | null;
  isGeneratingBackground: boolean;

  // Step 4: 文案 + 编辑
  generatedCopySets: CopySet[];
  selectedCopy: CopySet | null;
  isGeneratingCopy: boolean;

  // 编辑器
  posterElements: PosterElement[];
  canvasWidth: number;
  canvasHeight: number;
  posterPreviewUrl: string | null;

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

// ---------- Phase 9: 一键生成海报 API ----------
export interface GeneratePosterRequest {
  imageBase64: string;
  mimeType: string;
  styleId: StyleId;
}

/** generate-poster 成功时的 data 载荷（双场景文案 + 底图） */
export interface GeneratePosterApiData {
  posterImageBase64: string;
  posterData: PosterData;
  dishInfo: DishInfo;
  textColor?: string;
  styleLabel?: string;
  usedFallback?: boolean;
}

/** @deprecated 旧版三选一文案；新流程请使用 GeneratePosterApiData.posterData */
export interface GeneratePosterResponse {
  posterImageBase64: string;
  dishInfo: DishInfo;
  copySets: GeneratedCopyV2[];
}

export interface GeneratedCopyV2 {
  style: 'formal' | 'casual' | 'promo';
  style_label: string;
  main_title: string;
  main_title_en: string;
  sub_title: string;
  sub_title_en: string;
  description: string;
  description_en: string;
  price: string;
  promo_tag: string;
  promo_tag_en: string;
  spice_level: string;
  allergens: string;
}
