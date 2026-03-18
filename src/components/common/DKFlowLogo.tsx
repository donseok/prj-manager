interface DKFlowLogoProps {
  size?: number;
  className?: string;
}

export default function DKFlowLogo({ size = 44, className }: DKFlowLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Background rounded rect */}
      <rect width="44" height="44" rx="14" fill="url(#bg-gradient)" />

      {/* Flow wave lines - 3 flowing curves representing "Flow" */}
      <path
        d="M8 17.5C11.5 14 15.5 14 18 17.5C20.5 21 24.5 21 28 17.5C31.5 14 35 14.5 36 16"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.95"
      />
      <path
        d="M8 22.5C11.5 19 15.5 19 18 22.5C20.5 26 24.5 26 28 22.5C31.5 19 35 19.5 36 21"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.65"
      />
      <path
        d="M8 27.5C11.5 24 15.5 24 18 27.5C20.5 31 24.5 31 28 27.5C31.5 24 35 24.5 36 26"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.4"
      />

      <defs>
        <linearGradient id="bg-gradient" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1A6B65" />
          <stop offset="1" stopColor="#0F524E" />
        </linearGradient>
      </defs>
    </svg>
  );
}
