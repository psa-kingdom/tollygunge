/** @type {import('next').NextConfig} */
const config = {
  output: "standalone",
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
