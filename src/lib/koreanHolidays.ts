/**
 * koreanHolidays.ts
 * 한국 법정 공휴일 유틸리티
 */

import { format } from 'date-fns';

// ── 고정 공휴일 (MM-DD) ──────────────────────────────────────

const FIXED_HOLIDAYS: [string, string][] = [
  ['01-01', '신정'],
  ['03-01', '삼일절'],
  ['05-01', '근로자의 날'],
  ['05-05', '어린이날'],
  ['06-06', '현충일'],
  ['08-15', '광복절'],
  ['10-03', '개천절'],
  ['10-09', '한글날'],
  ['12-25', '성탄절'],
];

// ── 음력 기반 공휴일 (양력 변환값, 2024~2027) ────────────────
// 설날 전날/당일/다음날, 석가탄신일, 추석 전날/당일/다음날, 대체공휴일 포함

const LUNAR_HOLIDAYS: Record<number, [string, string][]> = {
  2024: [
    // 설날 연휴 (음력 1/1 = 2/10)
    ['02-09', '설날 연휴'],
    ['02-10', '설날'],
    ['02-11', '설날 연휴'],
    ['02-12', '대체공휴일(설날)'],
    // 석가탄신일 (음력 4/8 = 5/15)
    ['05-15', '석가탄신일'],
    // 추석 연휴 (음력 8/15 = 9/17)
    ['09-16', '추석 연휴'],
    ['09-17', '추석'],
    ['09-18', '추석 연휴'],
  ],
  2025: [
    // 설날 연휴 (음력 1/1 = 1/29)
    ['01-28', '설날 연휴'],
    ['01-29', '설날'],
    ['01-30', '설날 연휴'],
    // 석가탄신일 (음력 4/8 = 5/5) — 어린이날과 겹침
    ['05-05', '석가탄신일'],
    ['05-06', '대체공휴일(어린이날/석가탄신일)'],
    // 추석 연휴 (음력 8/15 = 10/6)
    ['10-05', '추석 연휴'],
    ['10-06', '추석'],
    ['10-07', '추석 연휴'],
    ['10-08', '대체공휴일(추석)'],
  ],
  2026: [
    // 설날 연휴 (음력 1/1 = 2/17)
    ['02-16', '설날 연휴'],
    ['02-17', '설날'],
    ['02-18', '설날 연휴'],
    // 석가탄신일 (음력 4/8 = 5/24)
    ['05-24', '석가탄신일'],
    ['05-25', '대체공휴일(석가탄신일)'],
    // 추석 연휴 (음력 8/15 = 9/25)
    ['09-24', '추석 연휴'],
    ['09-25', '추석'],
    ['09-26', '추석 연휴'],
  ],
  2027: [
    // 설날 연휴 (음력 1/1 = 2/7) — 일요일
    ['02-06', '설날 연휴'],
    ['02-07', '설날'],
    ['02-08', '설날 연휴'],
    ['02-09', '대체공휴일(설날)'],
    // 석가탄신일 (음력 4/8 = 5/13)
    ['05-13', '석가탄신일'],
    // 추석 연휴 (음력 8/15 = 9/15)
    ['09-14', '추석 연휴'],
    ['09-15', '추석'],
    ['09-16', '추석 연휴'],
  ],
};

/**
 * 특정 연도의 한국 공휴일 Set을 반환합니다.
 * @returns 'yyyy-MM-dd' 형태의 날짜 Set
 */
export function getKoreanHolidays(year: number): Set<string> {
  const holidays = new Set<string>();

  // 고정 공휴일
  for (const [mmdd] of FIXED_HOLIDAYS) {
    holidays.add(`${year}-${mmdd}`);
  }

  // 음력 기반 공휴일
  const lunar = LUNAR_HOLIDAYS[year];
  if (lunar) {
    for (const [mmdd] of lunar) {
      holidays.add(`${year}-${mmdd}`);
    }
  }

  return holidays;
}

/**
 * 특정 연도의 한국 공휴일 이름을 포함한 Map을 반환합니다.
 * @returns 'yyyy-MM-dd' → 공휴일 이름
 */
export function getKoreanHolidayNames(year: number): Map<string, string> {
  const holidays = new Map<string, string>();

  for (const [mmdd, name] of FIXED_HOLIDAYS) {
    holidays.set(`${year}-${mmdd}`, name);
  }

  const lunar = LUNAR_HOLIDAYS[year];
  if (lunar) {
    for (const [mmdd, name] of lunar) {
      holidays.set(`${year}-${mmdd}`, name);
    }
  }

  return holidays;
}

/**
 * 특정 날짜가 한국 공휴일인지 확인합니다.
 */
export function isKoreanHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const dateStr = format(date, 'yyyy-MM-dd');
  return getKoreanHolidays(year).has(dateStr);
}

/**
 * 특정 날짜가 근무일인지 확인합니다.
 * 평일(월~금)이고 공휴일이 아닌 날만 근무일입니다.
 */
export function isWorkday(date: Date): boolean {
  const dayOfWeek = date.getDay();
  // 토요일(6) 또는 일요일(0)이면 근무일이 아님
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;
  // 공휴일이면 근무일이 아님
  return !isKoreanHoliday(date);
}

/**
 * 특정 날짜 문자열('yyyy-MM-dd')이 근무일인지 확인합니다.
 */
export function isWorkdayStr(dateStr: string): boolean {
  const date = new Date(dateStr + 'T00:00:00');
  return isWorkday(date);
}
