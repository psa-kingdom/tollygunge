/** @type {import('next').NextConfig} */
const config = {
  output: "standalone",
  outputFileTracingIncludes: { "/api/locations": ["./data/postal/*.gz"], "/api/member/*": ["./data/postal/*.gz"], "/api/staff/*": ["./data/postal/*.gz"] },
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
