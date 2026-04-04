interface DKFlowLogoProps {
  size?: number;
  className?: string;
}

export default function DKFlowLogo({ size = 44, className }: DKFlowLogoProps) {
  // 원본 이미지에 연한 배경 여백이 있으므로 살짝 확대하여 크롭
  const scale = 1.18;
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <img
        src="/logo.png"
        alt="DK Flow"
        width={size * scale}
        height={size * scale}
        style={{
          display: 'block',
          marginTop: -(size * (scale - 1)) / 2,
          marginLeft: -(size * (scale - 1)) / 2,
        }}
      />
    </div>
  );
}
