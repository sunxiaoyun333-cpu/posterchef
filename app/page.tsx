'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChefHat, Sparkles, ImageIcon, Type, Download, ArrowRight, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const features = [
  {
    icon: ImageIcon,
    title: 'AI菜品识别',
    titleEn: 'AI Dish Recognition',
    desc: '上传一张手机照片，Gemini AI 自动识别菜品名称、描述，中英双语同步生成',
  },
  {
    icon: Sparkles,
    title: '智能抠图',
    titleEn: 'Smart Background Removal',
    desc: '浏览器端 AI 实时去除背景，保留完美的菜品轮廓，无需 PS 技能',
  },
  {
    icon: ChefHat,
    title: 'AI背景生成',
    titleEn: 'AI Background Generation',
    desc: '8种精选风格模板，Imagen 3 为每道菜定制专属氛围背景，4种方案任选',
  },
  {
    icon: Type,
    title: '双语营销文案',
    titleEn: 'Bilingual Marketing Copy',
    desc: 'Gemini 生成中英双语标题、副标题、Slogan，专业、轻松、诗意三种风格',
  },
  {
    icon: ImageIcon,
    title: '可视化拖拽编辑',
    titleEn: 'Visual Drag & Drop Editor',
    desc: 'Fabric.js 驱动的专业画布编辑器，调整位置、字体、颜色、装饰元素',
  },
  {
    icon: Download,
    title: '印刷级导出',
    titleEn: 'Print-Ready Export',
    desc: '导出 PNG / JPG / PDF，300dpi 印刷品质，直接发给印刷店或社媒投放',
  },
];

const steps = [
  { num: '01', label: '上传菜品照片' },
  { num: '02', label: 'AI识别 + 智能抠图' },
  { num: '03', label: '选择海报风格' },
  { num: '04', label: 'AI生成背景图' },
  { num: '05', label: '生成双语文案' },
  { num: '06', label: '拖拽编辑微调' },
  { num: '07', label: '导出商业海报' },
];

// 滚动时淡入的 wrapper
function FadeIn({ children, delay = 0, className = '' }: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* ── Navbar ── */}
      <nav className="border-b border-white/10 px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChefHat className="w-6 h-6 sm:w-7 sm:h-7 text-orange-400" />
            <span className="text-lg sm:text-xl font-bold tracking-tight">PosterChef</span>
          </div>
          <Link href="/create">
            <Button className="bg-orange-500 hover:bg-orange-600 text-white text-sm sm:text-base">
              开始创作
            </Button>
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-16 sm:pb-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 rounded-full px-4 py-1.5 text-xs sm:text-sm text-orange-400 mb-6 sm:mb-8">
            <Sparkles className="w-3.5 h-3.5" />
            Powered by Google Gemini &amp; Imagen 3
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold leading-tight mb-4 sm:mb-6">
            一张照片
            <br />
            <span className="text-orange-400">3分钟</span>生成
            <br />
            专业餐厅海报
          </h1>

          <p className="text-base sm:text-xl text-neutral-400 max-w-2xl mx-auto mb-8 sm:mb-10 px-2">
            专为美国华人餐厅老板打造。上传菜品照片，AI 自动识别、抠图、生成背景、撰写中英双语文案，自动排版成商业级印刷海报。
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4 sm:px-0">
            <Link href="/create">
              <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-white px-6 sm:px-8 py-4 sm:py-6 text-base sm:text-lg w-full sm:w-auto">
                免费开始创作
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 mt-8 sm:mt-10 text-xs sm:text-sm text-neutral-500">
            {['无需设计经验', '中英双语文案', '印刷级画质', '3分钟完成'].map((t) => (
              <div key={t} className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500" />
                {t}
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── 流程步骤 ── */}
      <section className="bg-neutral-900 py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <FadeIn>
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12">7步生成专业海报</h2>
          </FadeIn>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4">
            {steps.map((s, i) => (
              <FadeIn key={s.num} delay={i * 0.05}>
                <div className="flex flex-col items-center text-center gap-2">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400 font-bold text-xs sm:text-sm">
                    {s.num}
                  </div>
                  <p className="text-[11px] sm:text-xs text-neutral-400 leading-tight">{s.label}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── 功能特性 ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <FadeIn>
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3 sm:mb-4">所有 AI 功能，一个平台</h2>
          <p className="text-center text-neutral-500 mb-8 sm:mb-12 text-sm sm:text-base">从拍照到印刷，全流程 AI 驱动</p>
        </FadeIn>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {features.map((f, i) => (
            <FadeIn key={f.title} delay={i * 0.07}>
              <div className="bg-neutral-900 border border-white/10 rounded-xl p-5 sm:p-6 hover:border-orange-500/30 transition-colors h-full">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-orange-500/10 flex items-center justify-center mb-3 sm:mb-4">
                  <f.icon className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400" />
                </div>
                <h3 className="font-semibold mb-1 text-sm sm:text-base">{f.title}</h3>
                <p className="text-xs text-orange-400/70 mb-2 sm:mb-3">{f.titleEn}</p>
                <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">{f.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-gradient-to-b from-orange-950/30 to-neutral-950 py-16 sm:py-20 text-center px-4">
        <FadeIn>
          <h2 className="text-3xl sm:text-4xl font-bold mb-3 sm:mb-4">现在就开始，免费体验</h2>
          <p className="text-neutral-400 mb-6 sm:mb-8 text-sm sm:text-base">Your next great poster is one photo away.</p>
          <Link href="/create">
            <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-white px-8 sm:px-10 py-4 sm:py-6 text-base sm:text-lg">
              立即创作海报
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
            </Button>
          </Link>
        </FadeIn>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/10 py-6 sm:py-8 text-center text-neutral-600 text-xs sm:text-sm px-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <ChefHat className="w-4 h-4 text-orange-400/60" />
          <span className="font-medium text-neutral-500">PosterChef</span>
        </div>
        <p>AI-Powered Poster Generator for Asian Restaurants in the US</p>
      </footer>
    </div>
  );
}
