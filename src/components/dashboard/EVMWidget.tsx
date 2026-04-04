import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import { TrendingUp, TrendingDown, Activity, Target, AlertTriangle, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { Task } from '../../types';
import {
  calculateEVM,
  generateTimeSeries,
  interpretSPI,
  interpretCPI,
  estimateCompletionDate,
} from '../../lib/evmCalculator';

interface EVMWidgetProps {
  tasks: Task[];
  projectStartDate: string;
  projectEndDate: string;
  baseDate?: string;
}

export default function EVMWidget({ tasks, projectStartDate, projectEndDate, baseDate }: EVMWidgetProps) {
  const metrics = useMemo(
    () => calculateEVM(tasks, projectStartDate, projectEndDate, baseDate),
    [tasks, projectStartDate, projectEndDate, baseDate],
  );

  const timeSeries = useMemo(
    () => generateTimeSeries(tasks, projectStartDate, projectEndDate),
    [tasks, projectStartDate, projectEndDate],
  );

  const spiInterpret = useMemo(() => interpretSPI(metrics.spi), [metrics.spi]);
  const cpiInterpret = useMemo(() => interpretCPI(metrics.cpi), [metrics.cpi]);

  const estimatedEnd = useMemo(
    () => estimateCompletionDate(projectStartDate, projectEndDate, metrics.spi),
    [projectStartDate, projectEndDate, metrics.spi],
  );

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // 데이터가 없는 경우
  if (metrics.bac === 0) {
    return (
      <div className="app-panel p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-[18px] bg-[rgba(15,118,110,0.08)] text-[color:var(--accent-primary)]">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">EVM 분석 (획득가치관리)</h2>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <AlertTriangle className="h-10 w-10 text-[color:var(--text-muted)] mb-3" />
          <p className="text-sm text-[color:var(--text-secondary)]">
            작업 데이터가 없어 EVM 분석을 수행할 수 없습니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 섹션 헤더 */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-[20px] border border-[rgba(15,118,110,0.14)] bg-[rgba(15,118,110,0.08)] text-[color:var(--accent-primary)] shadow-[0_18px_36px_-26px_rgba(15,118,110,0.18)]">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">
            EVM 분석 (획득가치관리)
          </h2>
          <p className="text-xs text-[color:var(--text-secondary)]">
            Earned Value Management — 프로젝트 일정/비용 성과 분석
          </p>
        </div>
      </div>

      {/* KPI 카드 4개 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="SPI (일정성과지수)"
          value={metrics.spi}
          format="index"
          threshold={1}
          icon={metrics.spi >= 1 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
          subtitle={spiInterpret.text}
          subtitleColor={spiInterpret.color}
        />
        <KPICard
          label="CPI (비용성과지수)"
          value={metrics.cpi}
          format="index"
          threshold={1}
          icon={metrics.cpi >= 1 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
          subtitle={cpiInterpret.text}
          subtitleColor={cpiInterpret.color}
        />
        <KPICard
          label="EAC (예상 완료 비용)"
          value={metrics.eac}
          format="value"
          comparisonValue={metrics.bac}
          comparisonLabel="BAC"
          icon={<Target className="h-5 w-5" />}
          subtitle={`BAC 대비 ${metrics.bac > 0 ? Math.round((metrics.eac / metrics.bac) * 100) : 0}%`}
          subtitleColor={metrics.eac <= metrics.bac ? '#22c55e' : '#cb4b5f'}
        />
        <KPICard
          label="VAC (완료 시 편차)"
          value={metrics.vac}
          format="variance"
          icon={<Activity className="h-5 w-5" />}
          subtitle={metrics.vac >= 0 ? '예산 내 완료 예상' : '예산 초과 예상'}
          subtitleColor={metrics.vac >= 0 ? '#22c55e' : '#cb4b5f'}
        />
      </div>

      {/* S-커브 차트 & 성과 분석 */}
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        {/* S-커브 차트 */}
        <div className="app-panel p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text-primary)]">S-커브 (누적 가치 %)</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeSeries} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border-color)"
                  opacity={0.5}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                  tickFormatter={(v: string) => {
                    const d = new Date(v);
                    return format(d, 'M/d', { locale: ko });
                  }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                  tickFormatter={(v: number) => `${v}%`}
                  domain={[0, 'auto']}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-secondary-solid)',
                    borderColor: 'var(--border-color)',
                    borderRadius: '14px',
                    boxShadow: '0 24px 56px -28px rgba(17, 24, 39, 0.28)',
                    color: 'var(--text-primary)',
                    fontSize: 12,
                  }}
                  labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
                  itemStyle={{ color: 'var(--text-secondary)' }}
                  labelFormatter={(v: any) => {
                    const d = new Date(v);
                    return format(d, 'yyyy년 M월 d일', { locale: ko });
                  }}
                  formatter={(value: any, name: any) => {
                    const label = name === 'pv' ? 'PV' : name === 'ev' ? 'EV' : 'AC';
                    return [`${value}%`, label];
                  }}
                />
                <Legend
                  formatter={(value: string) => {
                    const labels: Record<string, string> = { pv: 'PV (계획가치)', ev: 'EV (획득가치)', ac: 'AC (실제비용)' };
                    return labels[value] || value;
                  }}
                  wrapperStyle={{ fontSize: 12 }}
                />
                {/* 오늘 마커 */}
                <ReferenceLine
                  x={todayStr}
                  stroke="var(--text-muted)"
                  strokeDasharray="4 4"
                  label={{ value: '오늘', position: 'top', fill: 'var(--text-secondary)', fontSize: 11 }}
                />
                <Line
                  type="monotone"
                  dataKey="pv"
                  stroke="#6B7280"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="ev"
                  stroke="#2BAAA0"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="ac"
                  stroke="#CB4B5F"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 성과 분석 요약 */}
        <div className="app-panel p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text-primary)]">성과 분석 요약</h3>
          <div className="space-y-4">
            {/* 일정 성과 */}
            <AnalysisRow
              label="일정 성과"
              index={metrics.spi}
              interpret={spiInterpret}
            />
            {/* 비용 성과 */}
            <AnalysisRow
              label="비용 성과"
              index={metrics.cpi}
              interpret={cpiInterpret}
            />

            {/* 구분선 */}
            <div className="border-t border-[var(--border-color)]" />

            {/* 핵심 지표 테이블 */}
            <div className="space-y-2.5">
              <MetricRow label="BAC (총 계획 가치)" value={metrics.bac.toFixed(1)} />
              <MetricRow label="PV (계획 가치)" value={metrics.pv.toFixed(1)} />
              <MetricRow label="EV (획득 가치)" value={metrics.ev.toFixed(1)} />
              <MetricRow label="AC (실제 비용)" value={metrics.ac.toFixed(1)} />
              <MetricRow
                label="SV (일정 편차)"
                value={metrics.sv.toFixed(1)}
                color={metrics.sv >= 0 ? '#22c55e' : '#cb4b5f'}
              />
              <MetricRow
                label="CV (비용 편차)"
                value={metrics.cv.toFixed(1)}
                color={metrics.cv >= 0 ? '#22c55e' : '#cb4b5f'}
              />
              <MetricRow label="ETC (잔여 예상 비용)" value={metrics.etc.toFixed(1)} />
              <MetricRow label="TCPI (목표 성과지수)" value={metrics.tcpi.toFixed(2)} />
            </div>

            {/* 구분선 */}
            <div className="border-t border-[var(--border-color)]" />

            {/* 예상 완료일 */}
            <div className="rounded-[14px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-3.5">
              <p className="text-xs text-[color:var(--text-secondary)] mb-1">현재 추세 예상 완료일</p>
              <p className="text-base font-semibold text-[color:var(--text-primary)]">
                {estimatedEnd
                  ? format(estimatedEnd, 'yyyy년 M월 d일', { locale: ko })
                  : '산출 불가'}
              </p>
              {estimatedEnd && (
                <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                  계획 종료일: {format(new Date(projectEndDate), 'yyyy년 M월 d일', { locale: ko })}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 서브 컴포넌트 ──────────────────────────────────────────

interface KPICardProps {
  label: string;
  value: number;
  format: 'index' | 'value' | 'variance';
  threshold?: number;
  comparisonValue?: number;
  comparisonLabel?: string;
  icon: React.ReactNode;
  subtitle: string;
  subtitleColor: string;
}

function KPICard({ label, value, format: fmt, threshold, icon, subtitle, subtitleColor }: KPICardProps) {
  const isGood = threshold != null ? value >= threshold : value >= 0;

  const displayValue = (() => {
    switch (fmt) {
      case 'index':
        return value.toFixed(2);
      case 'value':
        return value.toFixed(1);
      case 'variance':
        return `${value >= 0 ? '+' : ''}${value.toFixed(1)}`;
    }
  })();

  return (
    <div className="metric-card p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-[color:var(--text-secondary)] leading-snug">{label}</p>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-[14px]"
          style={{
            backgroundColor: isGood ? 'rgba(34, 197, 94, 0.1)' : 'rgba(203, 75, 95, 0.1)',
            color: isGood ? '#22c55e' : '#cb4b5f',
          }}
        >
          {icon}
        </div>
      </div>
      <p
        className="text-3xl font-semibold tracking-[-0.04em]"
        style={{ color: isGood ? '#22c55e' : '#cb4b5f' }}
      >
        {displayValue}
      </p>
      <p className="mt-2 text-xs font-medium" style={{ color: subtitleColor }}>
        {subtitle}
      </p>
    </div>
  );
}

function AnalysisRow({
  label,
  index,
  interpret,
}: {
  label: string;
  index: number;
  interpret: { text: string; color: string };
}) {
  const pct = Math.min(200, Math.max(0, index * 100));
  const barWidth = Math.min(100, pct);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-[color:var(--text-secondary)]">{label}</span>
        <span className="text-xs font-semibold" style={{ color: interpret.color }}>
          {index.toFixed(2)} — {interpret.text}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${barWidth}%`,
            backgroundColor: interpret.color,
          }}
        />
      </div>
    </div>
  );
}

function MetricRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[color:var(--text-secondary)]">{label}</span>
      <span
        className="text-sm font-semibold"
        style={{ color: color || 'var(--text-primary)' }}
      >
        {value}
      </span>
    </div>
  );
}
