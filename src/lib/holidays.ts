/**
 * 한국 공휴일 데이터 (2024~2027)
 * 고정 공휴일 + 음력 기반 공휴일(설날, 추석, 부처님 오신 날) 하드코딩
 * 대체 공휴일 포함
 */

interface HolidayEntry {
  date: string; // 'MM-DD' for fixed, 'YYYY-MM-DD' for lunar-based
  name: string;
}

// 매년 반복되는 고정 공휴일
const FIXED_HOLIDAYS: HolidayEntry[] = [
  { date: '01-01', name: '신정' },
  { date: '03-01', name: '삼일절' },
  { date: '05-05', name: '어린이날' },
  { date: '06-06', name: '현충일' },
  { date: '08-15', name: '광복절' },
  { date: '10-03', name: '개천절' },
  { date: '10-09', name: '한글날' },
  { date: '12-25', name: '크리스마스' },
];

// 음력 기반 공휴일 (연도별 하드코딩)
const LUNAR_HOLIDAYS: Record<number, HolidayEntry[]> = {
  2024: [
    { date: '2024-02-09', name: '설날 연휴' },
    { date: '2024-02-10', name: '설날' },
    { date: '2024-02-11', name: '설날 연휴' },
    { date: '2024-02-12', name: '대체공휴일(설날)' },
    { date: '2024-05-15', name: '부처님 오신 날' },
    { date: '2024-09-16', name: '추석 연휴' },
    { date: '2024-09-17', name: '추석' },
    { date: '2024-09-18', name: '추석 연휴' },
  ],
  2025: [
    { date: '2025-01-28', name: '설날 연휴' },
    { date: '2025-01-29', name: '설날' },
    { date: '2025-01-30', name: '설날 연휴' },
    { date: '2025-05-05', name: '부처님 오신 날' },
    { date: '2025-10-05', name: '추석 연휴' },
    { date: '2025-10-06', name: '추석' },
    { date: '2025-10-07', name: '추석 연휴' },
    { date: '2025-10-08', name: '대체공휴일(추석)' },
  ],
  2026: [
    { date: '2026-02-16', name: '설날 연휴' },
    { date: '2026-02-17', name: '설날' },
    { date: '2026-02-18', name: '설날 연휴' },
    { date: '2026-05-24', name: '부처님 오신 날' },
    { date: '2026-09-24', name: '추석 연휴' },
    { date: '2026-09-25', name: '추석' },
    { date: '2026-09-26', name: '추석 연휴' },
  ],
  2027: [
    { date: '2027-02-06', name: '설날 연휴' },
    { date: '2027-02-07', name: '설날' },
    { date: '2027-02-08', name: '설날 연휴' },
    { date: '2027-02-09', name: '대체공휴일(설날)' },
    { date: '2027-05-13', name: '부처님 오신 날' },
    { date: '2027-10-14', name: '추석 연휴' },
    { date: '2027-10-15', name: '추석' },
    { date: '2027-10-16', name: '추석 연휴' },
  ],
};

// 빠른 조회를 위한 캐시 (YYYY-MM-DD → 공휴일 이름)
const holidayCache = new Map<string, string>();

function buildCache() {
  if (holidayCache.size > 0) return;

  // 고정 공휴일: 지원 연도 범위에 대해 생성
  for (let year = 2024; year <= 2027; year++) {
    for (const h of FIXED_HOLIDAYS) {
      holidayCache.set(`${year}-${h.date}`, h.name);
    }
  }

  // 음력 기반 공휴일
  for (const [, entries] of Object.entries(LUNAR_HOLIDAYS)) {
    for (const h of entries) {
      holidayCache.set(h.date, h.name);
    }
  }
}

function toKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isKoreanHoliday(date: Date): boolean {
  buildCache();
  return holidayCache.has(toKey(date));
}

export function getHolidayName(date: Date): string | null {
  buildCache();
  return holidayCache.get(toKey(date)) ?? null;
}
