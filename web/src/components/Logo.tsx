export const PLANE_PATH =
  'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.2.4c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.4-.2c.4-.3.6-.7.5-1.2z';

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6aa8ff" />
          <stop offset="0.5" stopColor="#2f6bff" />
          <stop offset="1" stopColor="#1a3fb8" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill="url(#logo-g)" />
      <g transform="translate(24 24) rotate(45) translate(-12 -12) scale(1)" fill="#ffffff">
        <path d={PLANE_PATH} />
      </g>
    </svg>
  );
}
