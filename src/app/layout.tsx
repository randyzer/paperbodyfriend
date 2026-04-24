import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { Inspector } from 'react-dev-inspector';
import CrispChat from '@/components/crisp-chat';
import { Toaster } from '@/components/ui/sonner';
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
      <head>
        <Script
          async
          src="https://plausible.io/js/pa-5kVPMU-6YhIFhd8eqHco8.js"
          strategy="afterInteractive"
        />
        <Script id="plausible-init" strategy="afterInteractive">
          {`window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init();`}
        </Script>
        <Script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-Y59D1TJPZY"
          strategy="afterInteractive"
        />
        <Script id="google-gtag-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', 'G-Y59D1TJPZY');`}
        </Script>
        <Script id="microsoft-clarity-init" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window, document, "clarity", "script", "wgi6v2eyls");`}
        </Script>
      </head>
      <body
        className="flex min-h-screen flex-col antialiased"
        suppressHydrationWarning
      >
        {isDev && <Inspector />}
        <main className="flex-1">{children}</main>
        <footer className="border-t border-pink-100 bg-white/80 px-4 py-5 text-sm text-gray-500">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <p>Paper Boyfriend</p>
            <Link
              href="/contact"
              className="font-medium text-pink-500 transition-colors hover:text-pink-600"
            >
              联系我们
            </Link>
          </div>
        </footer>
        <CrispChat />
        <Toaster />
      </body>
    </html>
  );
}
