import type { Metadata } from 'next'
import { RouteProgress } from '@/components/layout/route-progress'
import './globals.css'

export const metadata: Metadata = {
  title: 'Museek · AI音乐平台',
  description: 'AI音乐教学与版权代理平台',
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* iOS 错误捕获：把 JS 运行时错误显示在页面上便于调试 */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            window.onerror=function(m,u,l,c,e){
              var d=document,b=d.body,o=d.createElement('div');
              o.style.cssText='position:fixed;top:0;left:0;right:0;z-index:99999;background:#1a0000;color:#ff6b6b;padding:20px;font-size:13px;font-family:monospace;max-height:80vh;overflow:auto;border-bottom:2px solid #ff6b6b;white-space:pre-wrap;word-break:break-all;';
              o.innerHTML='<b style="font-size:16px">⚠ JS Error on iOS</b><br>'+m+'<br><span style="color:#aaa">at '+u+':'+l+'</span>'+(e?'<br>'+e.stack:'');
              b.insertBefore(o,b.firstChild);
              return false;
            };
          })();
        ` }} />
        <RouteProgress />
        {children}
      </body>
    </html>
  )
}
