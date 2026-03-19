import { cn } from '../../lib/utils';

interface DKBotAvatarProps {
  size?: number;
  className?: string;
}

export default function DKBotAvatar({ size = 64, className }: DKBotAvatarProps) {
  return (
    <div
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-full border border-white/18 bg-[linear-gradient(160deg,#1b8f86_0%,#0f766e_56%,#0b3d64_100%)] shadow-[0_28px_60px_-30px_rgba(11,61,100,0.92)]',
        className
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <div
        className="absolute rounded-full bg-white/78 shadow-[0_10px_20px_-12px_rgba(255,255,255,0.95)]"
        style={{ top: size * -0.18, width: size * 0.12, height: size * 0.12 }}
      />
      <div
        className="absolute rounded-full bg-white/65"
        style={{ top: size * -0.12, width: size * 0.045, height: size * 0.18 }}
      />
      <div
        className="absolute rounded-full bg-white/80"
        style={{ left: size * 0.2, top: size * 0.32, width: size * 0.14, height: size * 0.14 }}
      />
      <div
        className="absolute rounded-full bg-white/80"
        style={{ right: size * 0.2, top: size * 0.32, width: size * 0.14, height: size * 0.14 }}
      />
      <div
        className="absolute border-b-[3px] border-white/75"
        style={{
          left: '50%',
          top: size * 0.49,
          width: size * 0.24,
          height: size * 0.12,
          borderRadius: size,
          transform: 'translateX(-50%)',
        }}
      />
      <div
        className="absolute flex items-center justify-center rounded-full border border-white/22 bg-white/12 font-black uppercase tracking-[-0.04em] text-white/92"
        style={{
          left: '50%',
          bottom: size * 0.13,
          width: size * 0.42,
          height: size * 0.24,
          transform: 'translateX(-50%)',
          fontSize: size * 0.18,
        }}
      >
        dk
      </div>
    </div>
  );
}
