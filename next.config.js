/** @type {import('next').NextConfig} */
const landingOrigins = (process.env.LANDING_AUTH_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const isSelfHost = process.env.SELF_HOST === '1' || process.env.NEXT_PUBLIC_SELF_HOST === '1';
const selfHostDesktopFrameSrc = isSelfHost ? ' http://127.0.0.1:* http://localhost:*' : '';

const serverActionAllowedOrigins = [
  'unify.ai',
  'www.unify.ai',
  'staging.unify.ai',
  'internal.example.com',
  ...landingOrigins.map((origin) => {
    try {
      return new URL(origin).host;
    } catch {
      return origin.replace(/^https?:\/\//, '');
    }
  }),
];

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*',
      },
      {
        protocol: 'https',
        hostname: 'kgo.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'github.com',
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
      },
    ],
    unoptimized: true,
  },
  output: 'standalone',
  experimental: {
    instrumentationHook: true,
    serverMinification: false,
    serverActions: {
      allowedOrigins: Array.from(new Set(serverActionAllowedOrigins)),
      bodySizeLimit: '100mb',
    },
  },
  compiler: {
    // Enables the styled-components SWC transform
    styledComponents: true,
  },
  webpack(config) {
    // Grab the existing rule that handles SVG imports
    const fileLoaderRule = config.module.rules.find((rule) => rule.test?.test?.('.svg'));

    config.module.rules.push(
      // Reapply the existing rule, but only for svg imports ending in ?url
      {
        ...fileLoaderRule,
        test: /\.svg$/i,
        resourceQuery: /url/, // *.svg?url
      },
      // Convert all other *.svg imports to React components
      {
        test: /\.svg$/i,
        issuer: fileLoaderRule.issuer,
        resourceQuery: { not: [...fileLoaderRule.resourceQuery.not, /url/] }, // exclude if *.svg?url
        use: ['@svgr/webpack'],
      }
    );

    // Modify the file loader rule to ignore *.svg, since we have it handled now.
    fileLoaderRule.exclude = /\.svg$/i;

    // Handle audio file imports (.mp3, .wav)
    config.module.rules.push({
      test: /\.(mp3|wav|ogg)$/i,
      type: 'asset/resource',
    });

    return config;
  },
  async redirects() {
    return [
      {
        source: '/profile',
        destination: '/account',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''} https://js.stripe.com https://challenges.cloudflare.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://unpkg.com`,
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              "media-src 'self' blob: https://storage.googleapis.com",
              `connect-src 'self' https://api.unify.ai https://*.unify.ai https://js.stripe.com https://challenges.cloudflare.com wss://*.unify.ai https://*.livekit.cloud wss://*.livekit.cloud https://replicate.delivery https://*.replicate.delivery${process.env.NODE_ENV === 'development' ? ' ws://localhost:* http://localhost:* webpack://*' : ''}`,
              `frame-src 'self' blob: https://js.stripe.com https://challenges.cloudflare.com https://*.vm.unify.ai https://storage.googleapis.com${selfHostDesktopFrameSrc}`,
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
      {
        source: '/plot/view/:token*',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          { key: 'Content-Security-Policy', value: 'frame-ancestors *' },
        ],
      },
      {
        source: '/table/view/:token*',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          { key: 'Content-Security-Policy', value: 'frame-ancestors *' },
        ],
      },
      {
        source: '/tile/view/:token*',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          { key: 'Content-Security-Policy', value: 'frame-ancestors *' },
        ],
      },
      {
        source: '/dashboard/view/:token*',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          { key: 'Content-Security-Policy', value: 'frame-ancestors *' },
        ],
      },
      {
        source: '/api/plot/data/:token*',
        headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }],
      },
      {
        source: '/api/table/data/:token*',
        headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }],
      },
    ];
  },
};

module.exports = nextConfig;
