import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    // API 测试串行避免 IP 限流（10 次/分）触发 + 共享 loginCache 模块单例
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
    testTimeout: 20000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
