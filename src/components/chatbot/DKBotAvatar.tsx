import { cn } from '../../lib/utils';

interface DKBotAvatarProps {
  size?: number;
  className?: string;
}

export default function DKBotAvatar({ size = 64, className }: DKBotAvatarProps) {
  return (
    <div
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <div
        className="absolute rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.4),transparent_68%)] blur-md"
        style={{ inset: size * 0.04 }}
      />
      <div
        className="absolute rounded-full bg-[linear-gradient(180deg,#fff8d5_0%,#ffd86b_100%)] shadow-[0_8px_16px_-10px_rgba(216,139,68,0.9)]"
        style={{ left: size * 0.2, top: size * 0.03, width: size * 0.16, height: size * 0.16 }}
      />
      <div
        className="absolute rounded-full bg-[linear-gradient(180deg,#fff8d5_0%,#ffd86b_100%)] shadow-[0_8px_16px_-10px_rgba(216,139,68,0.9)]"
        style={{ right: size * 0.2, top: size * 0.03, width: size * 0.16, height: size * 0.16 }}
      />
      <div
        className="absolute rounded-[42%] border border-white/50 bg-[linear-gradient(180deg,#f2fffb_0%,#c9f3ea_38%,#8adbcf_70%,#4cb7a8_100%)] shadow-[0_24px_44px_-24px_rgba(15,118,110,0.72)]"
        style={{
          inset: size * 0.06,
          transform: 'scaleY(0.97)',
        }}
      />
      <div
        className="absolute rounded-full bg-[rgba(129,221,206,0.85)]"
        style={{
          left: size * -0.02,
          top: size * 0.48,
          width: size * 0.18,
          height: size * 0.16,
          transform: 'rotate(-26deg)',
        }}
      />
      <div
        className="absolute rounded-full bg-[rgba(129,221,206,0.85)]"
        style={{
          right: size * -0.02,
          top: size * 0.48,
          width: size * 0.18,
          height: size * 0.16,
          transform: 'rotate(26deg)',
        }}
      />
      <div
        className="absolute rounded-full bg-[linear-gradient(180deg,#fffefb_0%,#f7fffc_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]"
        style={{
          left: '50%',
          top: size * 0.18,
          width: size * 0.5,
          height: size * 0.28,
          borderRadius: size,
          transform: 'translateX(-50%)',
        }}
      />
      <div
        className="absolute rounded-full bg-[#123d64]"
        style={{
          left: size * 0.31,
          top: size * 0.27,
          width: size * 0.08,
          height: size * 0.1,
        }}
      />
      <div
        className="absolute rounded-full bg-[#123d64]"
        style={{
          right: size * 0.31,
          top: size * 0.27,
          width: size * 0.08,
          height: size * 0.1,
        }}
      />
      <div
        className="absolute rounded-full bg-white/88"
        style={{
          left: size * 0.34,
          top: size * 0.28,
          width: size * 0.03,
          height: size * 0.03,
        }}
      />
      <div
        className="absolute rounded-full bg-white/88"
        style={{
          right: size * 0.34,
          top: size * 0.28,
          width: size * 0.03,
          height: size * 0.03,
        }}
      />
      <div
        className="absolute rounded-full bg-[rgba(255,184,193,0.9)]"
        style={{
          left: size * 0.2,
          top: size * 0.35,
          width: size * 0.09,
          height: size * 0.05,
        }}
      />
      <div
        className="absolute rounded-full bg-[rgba(255,184,193,0.9)]"
        style={{
          right: size * 0.2,
          top: size * 0.35,
          width: size * 0.09,
          height: size * 0.05,
        }}
      />
      <div
        className="absolute border-b-[2px] border-[#123d64]"
        style={{
          left: '50%',
          top: size * 0.36,
          width: size * 0.14,
          height: size * 0.07,
          borderRadius: size,
          transform: 'translateX(-50%)',
        }}
      />
      <div
        className="absolute rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.42),rgba(255,255,255,0.14))]"
        style={{
          left: '50%',
          bottom: size * 0.12,
          width: size * 0.5,
          height: size * 0.24,
          transform: 'translateX(-50%)',
        }}
      />
      <div
        className="absolute flex items-center justify-center rounded-full border border-white/70 bg-white/86 font-black uppercase tracking-[-0.04em] text-[#0f766e] shadow-[0_10px_20px_-14px_rgba(15,118,110,0.5)]"
        style={{
          left: '50%',
          bottom: size * 0.16,
          width: size * 0.3,
          height: size * 0.14,
          transform: 'translateX(-50%)',
          fontSize: size * 0.13,
        }}
      >
        dk
      </div>
      <div
        className="absolute rounded-full bg-[rgba(106,197,183,0.72)]"
        style={{
          left: size * 0.22,
          bottom: size * 0.04,
          width: size * 0.16,
          height: size * 0.1,
        }}
      />
      <div
        className="absolute rounded-full bg-[rgba(106,197,183,0.72)]"
        style={{
          right: size * 0.22,
          bottom: size * 0.04,
          width: size * 0.16,
          height: size * 0.1,
        }}
      />
    </div>
  );
}
