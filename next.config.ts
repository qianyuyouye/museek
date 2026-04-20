import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // pdfkit 依赖 afm 字体文件；让 Next 服务端直接 require，不走 webpack 打包
  serverExternalPackages: ['pdfkit'],
  // 生产 build 不因 ESLint warning/error 中断（TS 错由 tsc 保障）
  eslint: { ignoreDuringBuilds: true },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/node_modules/**',
          '**/.playwright-mcp/**',
          '**/.next/**',
          '**/e2e-*.png',
          '**/test-*.png',
        ],
      }
    }
    return config
  },
};

export default nextConfig;
