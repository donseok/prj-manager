interface DKFlowLogoProps {
  size?: number;
  className?: string;
}

export default function DKFlowLogo({ size = 44, className }: DKFlowLogoProps) {
  return (
    <img
      src="/logo.png"
      alt="DK Flow"
      width={size}
      height={size}
      className={className}
      style={{ display: 'block', flexShrink: 0 }}
    />
  );
}
