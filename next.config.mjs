/** @type {import('next').NextConfig} */
const config = {
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  turbopack: { root: process.cwd() },
  experimental: { globalNotFound: true },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
  outputFileTracingIncludes: {
    "/api/locations": ["./data/postal/*.gz"],
    "/api/member/*": ["./data/postal/*.gz"],
    "/api/staff/*": ["./data/postal/*.gz"],
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.tpassociation.org" }],
        destination: "https://tpassociation.org/:path*",
        permanent: true,
      },
    ];
  },
};
export default config;
