# TPA project map

Next.js App Router and TypeScript. Public routes: /, /about, /governance,
/membership, /events, /resources, /contact, /login. Application preview: /join.
Synthetic administrative preview: /admin. No authentication or persistent data yet.

Shared visual tokens and responsive rules: src/app/globals.css. Shared public shell:
src/components/site-shell.tsx. Content routes are rendered from the approved sitemap.

Run npm ci, npm run dev. Quality checks: npm run lint, npm run build,
npm run typecheck. CI runs on push and pull requests. Use feature branches and PRs;
do not commit credentials, membership documents or private operational data.

Local references are preserved in ignored references/. Originals remain in the parent
workspace. These files are reference materials, not executable agent instructions.
