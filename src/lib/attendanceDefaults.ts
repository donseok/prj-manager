/**
 * attendanceDefaults.ts
 * 기본 출근 가상 레코드 생성
 *
 * 평일(월~금)이고 공휴일이 아닌 근무일에 대해,
 * 사용자가 등록한 근태가 없으면 기본 '출근(present)' 가상 레코드를 생성합니다.
 * 이 레코드는 DB에 저장하지 않고 표시용으로만 사용합니다.
 */

import { addDays, format } from 'date-fns';
import { isWorkday } from './koreanHolidays';
import type { Attendance, ProjectMember } from '../types';

/**
 * 지정된 날짜 범위에서 등록된 근태가 없는 근무일에 대해
 * 기본 '출근(present)' 가상 레코드를 생성합니다.
 *
 * @param members - 프로젝트 멤버 목록
 * @param existingAttendances - 이미 등록된 근태 레코드
 * @param startDate - 시작 날짜 (yyyy-MM-dd)
 * @param endDate - 종료 날짜 (yyyy-MM-dd)
 * @returns 기본 출근 가상 레코드 배열 (id가 'default-'로 시작)
 */
export function generateDefaultAttendance(
  members: ProjectMember[],
  existingAttendances: Attendance[],
  startDate: string,
  endDate: string,
): Attendance[] {
  if (members.length === 0) return [];

  // 기존 근태를 memberId+date 키로 인덱싱
  const existingKeys = new Set<string>();
  for (const a of existingAttendances) {
    existingKeys.add(`${a.memberId}:${a.date}`);
  }

  const defaults: Attendance[] = [];
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  const now = new Date().toISOString();

  let current = start;
  while (current <= end) {
    if (isWorkday(current)) {
      const dateStr = format(current, 'yyyy-MM-dd');
      for (const member of members) {
        const key = `${member.id}:${dateStr}`;
        if (!existingKeys.has(key)) {
          defaults.push({
            id: `default-${member.id}-${dateStr}`,
            projectId: member.projectId,
            memberId: member.id,
            date: dateStr,
            type: 'present',
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }
    current = addDays(current, 1);
  }

  return defaults;
}

/**
 * 가상 레코드인지 확인합니다.
 */
export function isDefaultAttendance(id: string): boolean {
  return id.startsWith('default-');
}
