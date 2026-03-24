/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.googleapis.com' },
      { protocol: 'https', hostname: '**.gstatic.com' },
    ],
  },

  experimental: {
    serverComponentsExternalPackages: ['sharp'],
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  typescript: {
    ignoreBuildErrors: true,
  },

  // @imgly/background-removal 依赖 onnxruntime-web，其 .mjs 文件包含 ESM 语法
  // （import.meta, import/export）。Next.js 默认的 SWC minifier 未正确处理 ESM 模块，
  // 导致 "import and export cannot be used outside of module code" 构建错误。
  // 关闭 swcMinify 改用 Terser（通过 module:true 正确处理 .mjs 文件）。
  swcMinify: false,

  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };

    return config;
  },
};

export default nextConfig;
