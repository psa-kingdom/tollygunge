const paths: Record<string, string> = {
  home: "M3 10 12 3l9 7v11h-6v-7H9v7H3Z",
  people: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M20 21v-2a4 4 0 0 0-3-3.87M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M17 3a4 4 0 0 1 0 8",
  message: "M21 15a3 3 0 0 1-3 3H8l-5 4V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3ZM7 8h10M7 12h7",
  mail: "M3 4h18v16H3ZM3 5l9 8 9-8",
  calendar: "M3 5h18v16H3ZM7 2v6M17 2v6M3 10h18",
  image: "M3 3h18v18H3ZM3 17l6-6 4 4 3-3 5 5M16 7h.01",
  upload: "M12 16V3M7 8l5-5 5 5M3 16v5h18v-5",
  file: "M14 2H4v20h16V8ZM14 2v6h6M8 13h8M8 17h8",
  wallet: "M3 5h18v15H3ZM16 10h5v5h-5ZM3 5V3h15",
  chart: "M3 3v18h18M7 17v-5M12 17V7M17 17v-9",
  shield: "M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6ZM8 12l3 3 5-6",
  profile: "M20 21v-2a7 7 0 0 0-14 0v2M13 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
  search: "M21 21l-5-5M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15",
  arrow: "M5 12h14M13 6l6 6-6 6",
  external: "M14 3h7v7M21 3l-9 9M10 3H3v18h18v-7",
  chevron: "m9 5 7 7-7 7",
  menu: "M4 6h16M4 12h16M4 18h16",
  panel: "M3 3h18v18H3ZM9 3v18M15 9l-3 3 3 3",
  close: "m6 6 12 12M6 18 18 6",
};

/** One stroke, grid and size for navigation and portal utility icons. */
export function PortalIcon({ name, className }: { name: string; className?: string }) {
  return (
    <svg className={className ? `portal-icon ${className}` : "portal-icon"} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={paths[name] ?? paths.file} />
    </svg>
  );
}
