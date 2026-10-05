const PATHS: Record<string, string> = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
  users:
    '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 14.2c2.6.4 4.5 2.3 4.5 5.8"/>',
  team: '<circle cx="8.5" cy="8.5" r="3"/><circle cx="16.5" cy="9.5" r="2.4"/><path d="M2.8 20c0-3.4 2.5-6 5.7-6s5.7 2.6 5.7 6"/><path d="M14.8 14.8c2.6.3 4.4 2.4 4.4 5.2"/>',
  shield: '<path d="M12 3l7 3v5.5c0 4.5-3 7.7-7 9.5-4-1.8-7-5-7-9.5V6l7-3Z"/>',
  layers: '<path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="M3 12l9 5 9-5"/><path d="M3 16l9 5 9-5"/>',
  book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V4.5Z"/><path d="M4 17.5A1.5 1.5 0 0 1 5.5 16H20"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2.2"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.64 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06A2 2 0 1 1 7.07 4.24l.06.06A1.7 1.7 0 0 0 9 4.64a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.36 9c.14.36.5 1.55 1.55 1.55H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  chevronRight: '<path d="m9 6 6 6-6 6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  play: '<path d="M7 5.5v13l11-6.5-11-6.5Z"/>',
  check: '<path d="M5 12.5 10 17l9-10"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  trash:
    '<path d="M4 7h16"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="1.6"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/>',
  edit: '<path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/>',
  arrowLeft: '<path d="m11 5-7 7 7 7M4.5 12H20"/>',
  flame:
    '<path d="M12 2.5c1 3-3.2 4-3.2 8a3.2 3.2 0 0 0 6.4 0c0-1-.4-1.7-.9-2.4.9.3 2.7 1.7 2.7 4.9a5 5 0 0 1-10 0c0-5.5 5-6 5-10.5Z"/>',
  bell: '<path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  grip: '<circle cx="8" cy="6" r="1.2"/><circle cx="8" cy="12" r="1.2"/><circle cx="8" cy="18" r="1.2"/><circle cx="14" cy="6" r="1.2"/><circle cx="14" cy="12" r="1.2"/><circle cx="14" cy="18" r="1.2"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  up: '<path d="m5 15 7-7 7 7"/>',
  down: '<path d="m5 9 7 7 7-7"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
  logout: '<path d="M15 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h9"/><path d="M10 12h11M17 8l4 4-4 4"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  alert: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4"/><path d="M12 17.5v.1"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 19h16"/>',
  share: '<path d="M12 3v11"/><path d="m8 7 4-4 4 4"/><path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/>',
};

export function Icon({
  name,
  size = 17,
  className,
}: {
  name: keyof typeof PATHS | string;
  size?: number;
  className?: string;
}) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      dangerouslySetInnerHTML={{ __html: d }}
    />
  );
}
