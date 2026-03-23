import type { Metadata } from 'next';
import { Inter, Noto_Serif_SC } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const notoSerifSC = Noto_Serif_SC({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-noto-serif-sc',
});

export const metadata: Metadata = {
  title: 'PosterChef — AI菜品海报生成平台',
  description: '上传菜品照片，3分钟生成专业级商业海报。AI识别+智能抠图+背景生成+双语文案，专为美国华人餐厅老板打造。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={cn(inter.variable, notoSerifSC.variable)}>
      <body className={cn('font-sans antialiased bg-background text-foreground')}>
        {children}
      </body>
    </html>
  );
}
