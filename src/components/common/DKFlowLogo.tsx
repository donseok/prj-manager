import { useId } from 'react';

interface DKFlowLogoProps {
  size?: number;
  className?: string;
}

export default function DKFlowLogo({ size = 44, className }: DKFlowLogoProps) {
  const uid = useId().replace(/:/g, '');
  const bgGrad = `logo-bg-${uid}`;
  const shineGrad = `logo-shine-${uid}`;
  const flowGrad = `logo-flow-${uid}`;
  const innerShadow = `logo-inner-${uid}`;
  const glowFilter = `logo-glow-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {/* Main background gradient — deeper, richer teal */}
        <linearGradient id={bgGrad} x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#19756D" />
          <stop offset="0.5" stopColor="#0E635C" />
          <stop offset="1" stopColor="#0A4A46" />
        </linearGradient>

        {/* Top-left shine for glass/depth effect */}
        <linearGradient id={shineGrad} x1="4" y1="2" x2="28" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.22" />
          <stop offset="0.5" stopColor="white" stopOpacity="0.05" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>

        {/* Flow line gradient — white to translucent teal */}
        <linearGradient id={flowGrad} x1="8" y1="22" x2="38" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.95" />
          <stop offset="1" stopColor="#7EDED6" stopOpacity="0.6" />
        </linearGradient>

        {/* Inner shadow filter for depth */}
        <filter id={innerShadow} x="-2" y="-2" width="48" height="48" filterUnits="userSpaceOnUse">
          <feFlood floodColor="#000000" floodOpacity="0.15" result="shadow" />
          <feComposite in="shadow" in2="SourceGraphic" operator="in" result="shadow-shape" />
          <feGaussianBlur in="shadow-shape" stdDeviation="2" result="blur" />
          <feOffset dx="0" dy="1" result="offset" />
          <feComposite in="SourceGraphic" in2="offset" operator="over" />
        </filter>

        {/* Soft glow on flow lines */}
        <filter id={glowFilter} x="-4" y="-4" width="52" height="52" filterUnits="userSpaceOnUse">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background with rounded corners */}
      <rect width="44" height="44" rx="13" fill={`url(#${bgGrad})`} />

      {/* Subtle border highlight for depth */}
      <rect
        x="0.5"
        y="0.5"
        width="43"
        height="43"
        rx="12.5"
        stroke="white"
        strokeOpacity="0.12"
        fill="none"
      />

      {/* Glass shine overlay */}
      <rect width="44" height="44" rx="13" fill={`url(#${shineGrad})`} />

      {/* Subtle "D" letterform — left vertical stroke integrated with flow */}
      <path
        d="M12 12.5V31.5"
        stroke="white"
        strokeWidth="2.6"
        strokeLinecap="round"
        opacity="0.18"
      />
      <path
        d="M12 12.5C18 12.5 24 13 27 17"
        stroke="white"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.12"
      />
      <path
        d="M12 31.5C18 31.5 24 31 27 27"
        stroke="white"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.12"
      />

      {/* Primary flow line — bold, leading wave */}
      <g filter={`url(#${glowFilter})`}>
        <path
          d="M9 18.5C13 14.5 17 14.5 20 18.5C23 22.5 27 22.5 30.5 18.5C33 15.5 35.5 15.5 37 17"
          stroke={`url(#${flowGrad})`}
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </g>

      {/* Secondary flow line */}
      <path
        d="M9 23C13 19 17 19 20 23C23 27 27 27 30.5 23C33 20 35.5 20 37 21.5"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.55"
      />

      {/* Tertiary flow line — lightest */}
      <path
        d="M9 27.5C13 23.5 17 23.5 20 27.5C23 31.5 27 31.5 30.5 27.5C33 24.5 35.5 24.5 37 26"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.28"
      />

      {/* Small accent dot — adds a finishing touch */}
      <circle cx="37" cy="17" r="1.3" fill="white" opacity="0.7" />

      {/* Bottom-right subtle reflection */}
      <rect
        x="24"
        y="36"
        width="14"
        height="4"
        rx="2"
        fill="white"
        opacity="0.04"
      />
    </svg>
  );
}
