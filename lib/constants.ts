import type { StyleTemplate } from './types';

// ---------- 画布尺寸 ----------
export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 1000;

// 导出分辨率倍率（300dpi 印刷）
export const EXPORT_SCALE = 3;

// ---------- 风格模板 ----------
export const STYLE_TEMPLATES: StyleTemplate[] = [
  {
    id: 'chinese-red',
    name: '中式红',
    nameEn: 'Chinese Red',
    description: '喜庆热烈，传统中式氛围，适合节日促销',
    primaryColor: '#C0392B',
    accentColor: '#F39C12',
    bgPrompt: 'chinese restaurant ambiance, red lanterns, warm golden light, bokeh, festive',
    fontStyle: 'serif',
    mood: 'festive, traditional, warm',
  },
  {
    id: 'modern-dark',
    name: '暗黑摩登',
    nameEn: 'Modern Dark',
    description: '高级感十足，深色背景突显食材质感',
    primaryColor: '#1A1A2E',
    accentColor: '#E94560',
    bgPrompt: 'dark moody restaurant background, dramatic lighting, elegant, luxury dining',
    fontStyle: 'sans',
    mood: 'luxury, dramatic, sophisticated',
  },
  {
    id: 'fresh-green',
    name: '清新绿',
    nameEn: 'Fresh Green',
    description: '自然清新，强调食材健康有机',
    primaryColor: '#27AE60',
    accentColor: '#F1C40F',
    bgPrompt: 'fresh herbs, natural wood, green plants, bright natural light, organic',
    fontStyle: 'sans',
    mood: 'fresh, natural, healthy',
  },
  {
    id: 'warm-orange',
    name: '温暖橙',
    nameEn: 'Warm Orange',
    description: '温馨亲切，适合家常菜系',
    primaryColor: '#E67E22',
    accentColor: '#ECF0F1',
    bgPrompt: 'warm kitchen atmosphere, wooden table, cozy restaurant, golden hour light',
    fontStyle: 'sans',
    mood: 'cozy, homey, welcoming',
  },
  {
    id: 'elegant-black',
    name: '典雅黑',
    nameEn: 'Elegant Black',
    description: '极简高端，适合高档餐厅',
    primaryColor: '#2C3E50',
    accentColor: '#BDC3C7',
    bgPrompt: 'minimalist fine dining, black marble surface, elegant restaurant, soft spotlight',
    fontStyle: 'serif',
    mood: 'minimalist, upscale, refined',
  },
  {
    id: 'festive-gold',
    name: '节日金',
    nameEn: 'Festive Gold',
    description: '金碧辉煌，适合春节、中秋等节日特供',
    primaryColor: '#D4AC0D',
    accentColor: '#922B21',
    bgPrompt: 'golden chinese new year decoration, red and gold, festive bokeh, luxury',
    fontStyle: 'serif',
    mood: 'opulent, celebratory, auspicious',
  },
  {
    id: 'minimalist-white',
    name: '简约白',
    nameEn: 'Minimalist White',
    description: '极简清爽，适合轻食/甜品类',
    primaryColor: '#FAFAFA',
    accentColor: '#2C3E50',
    bgPrompt: 'clean white minimal background, subtle texture, soft shadows, modern cafe',
    fontStyle: 'sans',
    mood: 'clean, modern, airy',
  },
  {
    id: 'street-food',
    name: '街头风',
    nameEn: 'Street Food',
    description: '活力十足，适合小吃、快餐',
    primaryColor: '#8E44AD',
    accentColor: '#F39C12',
    bgPrompt: 'vibrant street food market, colorful lights, urban energy, food stall atmosphere',
    fontStyle: 'display',
    mood: 'energetic, casual, fun',
  },
];

// ---------- 文案风格 ----------
export const COPY_STYLES = [
  { id: 'professional', name: '专业正式', nameEn: 'Professional' },
  { id: 'casual',       name: '轻松亲切', nameEn: 'Casual' },
  { id: 'poetic',       name: '诗意文艺', nameEn: 'Poetic' },
] as const;

// ---------- 海报尺寸预设 ----------
export const POSTER_SIZES = {
  standard: { width: 800,  height: 1000, label: '标准竖版 (4:5)' },
  square:   { width: 1000, height: 1000, label: '正方形 (1:1)'   },
  wide:     { width: 1200, height: 800,  label: '横版 (3:2)'     },
} as const;

// ---------- 支持的上传格式 ----------
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
export const MAX_IMAGE_SIZE_MB = 10;

// ---------- Mock 模式 ----------
export const IS_MOCK_MODE = process.env.NEXT_PUBLIC_MOCK_MODE === 'true';
