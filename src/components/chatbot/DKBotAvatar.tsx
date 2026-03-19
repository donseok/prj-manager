import { cn } from '../../lib/utils';

interface DKBotAvatarProps {
  size?: number;
  className?: string;
}

export default function DKBotAvatar({ size = 64, className }: DKBotAvatarProps) {
  return (
    <div
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-full border border-white/20 bg-[linear-gradient(160deg,#effcf8_0%,#c8efe7_34%,#7bd2c5_66%,#1b8f86_100%)] shadow-[0_24px_54px_-28px_rgba(27,143,134,0.62)]',
        className
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <div
        className="absolute rounded-full bg-[rgba(255,216,107,0.95)] shadow-[0_10px_18px_-10px_rgba(216,139,68,0.82)]"
        style={{ left: '50%', top: size * -0.14, width: size * 0.14, height: size * 0.14, transform: 'translateX(-50%)' }}
      />
      <div
        className="absolute rounded-full bg-white/85"
        style={{ left: '50%', top: size * -0.06, width: size * 0.05, height: size * 0.16, transform: 'translateX(-50%)' }}
      />
      <div
        className="absolute rounded-full bg-[rgba(255,255,255,0.88)]"
        style={{ left: size * 0.06, top: size * 0.28, width: size * 0.16, height: size * 0.16 }}
      />
      <div
        className="absolute rounded-full bg-[rgba(255,255,255,0.88)]"
        style={{ right: size * 0.06, top: size * 0.28, width: size * 0.16, height: size * 0.16 }}
      />
      <div
        className="absolute rounded-[44%] border border-[rgba(133,204,192,0.72)] bg-[linear-gradient(180deg,#fffefb_0%,#f5fbf8_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]"
        style={{
          left: '50%',
          top: size * 0.15,
          width: size * 0.64,
          height: size * 0.42,
          transform: 'translateX(-50%)',
        }}
      />
      <div
        className="absolute rounded-full bg-[#123d64]"
        style={{
          left: size * 0.31,
          top: size * 0.28,
          width: size * 0.08,
          height: size * 0.08,
        }}
      />
      <div
        className="absolute rounded-full bg-[#123d64]"
        style={{
          right: size * 0.31,
          top: size * 0.28,
          width: size * 0.08,
          height: size * 0.08,
        }}
      />
      <div
        className="absolute rounded-full bg-[rgba(255,185,193,0.82)]"
        style={{
          left: size * 0.23,
          top: size * 0.34,
          width: size * 0.1,
          height: size * 0.06,
        }}
      />
      <div
        className="absolute rounded-full bg-[rgba(255,185,193,0.82)]"
        style={{
          right: size * 0.23,
          top: size * 0.34,
          width: size * 0.1,
          height: size * 0.06,
        }}
      />
      <div
        className="absolute border-b-[2px] border-[#123d64]"
        style={{
          left: '50%',
          top: size * 0.38,
          width: size * 0.16,
          height: size * 0.08,
          borderRadius: size,
          transform: 'translateX(-50%)',
        }}
      />
      <div
        className="absolute rounded-[46%] border border-[rgba(255,255,255,0.58)] bg-[linear-gradient(180deg,rgba(15,118,110,0.2),rgba(15,118,110,0.08))]"
        style={{
          left: '50%',
          bottom: size * 0.13,
          width: size * 0.56,
          height: size * 0.28,
          transform: 'translateX(-50%)',
        }}
      />
      <div
        className="absolute flex items-center justify-center rounded-full border border-[rgba(255,255,255,0.78)] bg-white/74 font-black uppercase tracking-[-0.04em] text-[#0f766e]"
        style={{
          left: '50%',
          bottom: size * 0.18,
          width: size * 0.33,
          height: size * 0.16,
          transform: 'translateX(-50%)',
          fontSize: size * 0.14,
        }}
      >
        dk
      </div>
      <div
        className="absolute rounded-full bg-white/55"
        style={{
          left: size * 0.2,
          top: size * 0.1,
          width: size * 0.18,
          height: size * 0.08,
          transform: 'rotate(-24deg)',
        }}
      />
    </div>
  );
}
