import "server-only";
export function isSameOrigin(request: Request) {
  const configured = process.env.BETTER_AUTH_URL;
  return (
    !!configured && request.headers.get("origin") === new URL(configured).origin
  );
}
