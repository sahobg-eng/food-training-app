// Small inline line icons (no icon library). They draw in `currentColor`.

type IconProps = { size?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 32 32',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 2.2,
  'stroke-linecap': 'round' as const,
  'stroke-linejoin': 'round' as const,
  'aria-hidden': true,
});

export function DumbbellIcon({ size = 36 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M11 16h10" />
      <rect x="6.5" y="9" width="4.5" height="14" rx="1.5" />
      <rect x="21" y="9" width="4.5" height="14" rx="1.5" />
      <path d="M3.5 12.5v7M28.5 12.5v7" />
    </svg>
  );
}

export function ChecklistIcon({ size = 36 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="6" y="5" width="20" height="23" rx="3" />
      <path d="M12 5.5v-1.5h8v1.5" />
      <path d="M10.5 13l1.8 1.8 3-3.3M10.5 20l1.8 1.8 3-3.3M18.5 13.5h3.5M18.5 20.5h3.5" />
    </svg>
  );
}

/** A calendar page showing a day number (today's by default). */
export function CalendarIcon({ size = 36, day = new Date().getDate() }: IconProps & { day?: number }) {
  return (
    <svg {...base(size)}>
      <rect x="5" y="7" width="22" height="21" rx="3" />
      <path d="M5 13h22M11 4.5v5M21 4.5v5" />
      <text
        x="16"
        y="24.5"
        text-anchor="middle"
        fill="currentColor"
        stroke="none"
        font-size="10"
        font-weight="700"
        font-family="system-ui, sans-serif"
      >
        {day}
      </text>
    </svg>
  );
}

export function PlayIcon({ size = 40 }: IconProps) {
  return (
    <svg {...base(size)} stroke-width={0} fill="currentColor">
      <path d="M11 7.5v17a1.5 1.5 0 0 0 2.3 1.3l13-8.5a1.5 1.5 0 0 0 0-2.6l-13-8.5A1.5 1.5 0 0 0 11 7.5z" />
    </svg>
  );
}
