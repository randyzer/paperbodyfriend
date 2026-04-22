import type { Metadata } from 'next';
import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = {
  title: '联系我们',
  description: '联系 Paper Boyfriend 团队，获取反馈与支持方式。',
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-pink-50 to-purple-50 px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.3em] text-pink-400">
            Contact
          </p>
          <h1 className="mb-3 text-4xl font-bold text-gray-800">联系我们</h1>
          <p className="text-base text-gray-600">
            如果你有建议、反馈，或者只是想和我们打个招呼，都欢迎通过下面的方式联系。
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-pink-100 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl text-gray-800">邮箱反馈</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-600">
              <p>你可以直接发邮件给我们，我们会尽快查看并回复。</p>
              <a
                href="mailto:feedback@paperboyfriend.shop"
                className="inline-flex rounded-full bg-pink-500 px-4 py-2 font-medium text-white transition-colors hover:bg-pink-600"
              >
                feedback@paperboyfriend.shop
              </a>
            </CardContent>
          </Card>

          <Card className="border-pink-100 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl text-gray-800">即时聊天</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-600">
              <p>Discord 社群入口预留中，后续会在这里开放。</p>
              <div className="rounded-2xl border border-dashed border-purple-200 bg-purple-50 px-4 py-3 text-purple-500">
                Discord 占位，敬请期待
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-10 text-center text-sm text-gray-500">
          <p>也欢迎你先回到产品里继续体验。</p>
          <Link
            href="/"
            className="mt-3 inline-flex font-medium text-pink-500 transition-colors hover:text-pink-600"
          >
            返回首页
          </Link>
        </div>
      </div>
    </main>
  );
}
