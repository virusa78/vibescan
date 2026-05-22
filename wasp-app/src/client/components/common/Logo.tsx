import { cn } from "../../utils";

export default function Logo({
  className,
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="VibeScan logo"
      className={cn("block shrink-0", className)}
    >
      <defs>
        <linearGradient id="vibescan-shield" x1="14" y1="10" x2="50" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#55d26b" />
          <stop offset="1" stopColor="#15803d" />
        </linearGradient>
      </defs>
      <path
        d="M32 6 49 12.5c2 0.8 3.4 2.7 3.4 4.9v12.9c0 13.4-8.4 20.6-20.7 28.1C19.4 50.9 11 43.7 11 30.3V17.4c0-2.2 1.4-4.1 3.4-4.9L32 6Z"
        fill="url(#vibescan-shield)"
      />
      <path
        d="M23 30.5h18"
        stroke="#ffffff"
        strokeWidth="4.4"
        strokeLinecap="round"
      />
      <path
        d="M34 22.5c0 7 4 10.5 8.5 10.5"
        stroke="#ffffff"
        strokeWidth="4.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M31.7 6.8c-0.6 0-1.1 0.2-1.6 0.4l-15 5.7c-1.9 0.7-3.1 2.5-3.1 4.5v12.9c0 12.4 7.8 19 19.2 26c11.4-7 19.2-13.6 19.2-26V17.4c0-2-1.2-3.8-3.1-4.5l-15-5.7c-0.5-0.2-1-0.4-1.6-0.4Z"
        fill="none"
        stroke="#dcfce7"
        strokeOpacity="0.55"
        strokeWidth="1.5"
      />
    </svg>
  );
}
