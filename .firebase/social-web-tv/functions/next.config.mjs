// next.config.mjs
var nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" }
    ]
  },
  serverExternalPackages: ["sharp"],
  poweredByHeader: false,
  compress: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self' https: data: blob:",
              "img-src 'self' https: data: blob:",
              "media-src 'self' https: blob:",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
              "style-src 'self' 'unsafe-inline' https:",
              "connect-src 'self' https: wss: ws:",
              "frame-src 'self' https:",
              "frame-ancestors 'self'"
            ].join("; ")
          }
        ]
      }
    ];
  }
};
var next_config_default = nextConfig;
export {
  next_config_default as default
};
