import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'AI 虚拟男友',
    template: '%s | AI 虚拟男友',
  },
  description:
    '一个基于 Next.js 构建的 AI 虚拟男友互动应用，支持开场白、聊天回复、语音、图片与视频生成。',
  keywords: [
    'AI 虚拟男友',
    'AI 聊天',
    '角色互动',
    '文字转语音',
    '语音转文字',
    'AI 图片生成',
    'AI 视频生成',
    'Next.js',
  ],
  authors: [{ name: 'Paper Boyfriend Project' }],
  generator: 'Next.js',
  // icons: {
  //   icon: '',
  // },
  openGraph: {
    title: 'AI 虚拟男友',
    description:
      '支持开场白、聊天回复、语音、图片与视频生成的 AI 虚拟男友互动应用。',
    siteName: 'AI 虚拟男友',
    locale: 'zh_CN',
    type: 'website',
    // images: [
    //   {
    //     url: '',
    //     width: 1200,
    //     height: 630,
    //     alt: '扣子编程 - 你的 AI 工程师',
    //   },
    // ],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        {isDev && <Inspector />}
        {children}
      </body>
    </html>
  );
}
