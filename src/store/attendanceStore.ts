import { create } from 'zustand';
import type { Attendance, ProjectMember } from '../types';
import { generateDefaultAttendance } from '../lib/attendanceDefaults';

interface AttendanceState {
  attendances: Attendance[];
  loadedProjectId: string | null;
  isLoading: boolean;

  setAttendances: (attendances: Attendance[], projectId: string) => void;
  addAttendance: (attendance: Attendance) => void;
  updateAttendance: (id: string, updates: Partial<Attendance>) => void;
  removeAttendance: (id: string) => void;

  getByMember: (memberId: string) => Attendance[];
  getByDateRange: (start: string, end: string) => Attendance[];

  /** 기본 출근(가상 레코드)을 포함한 근태 목록 반환 */
  getWithDefaults: (members: ProjectMember[], start: string, end: string) => Attendance[];
}

export const useAttendanceStore = create<AttendanceState>((set, get) => ({
  attendances: [],
  loadedProjectId: null,
  isLoading: false,

  setAttendances: (attendances, projectId) =>
    set({ attendances, loadedProjectId: projectId, isLoading: false }),

  addAttendance: (attendance) =>
    set((state) => ({ attendances: [attendance, ...state.attendances] })),

  updateAttendance: (id, updates) =>
    set((state) => ({
      attendances: state.attendances.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      ),
    })),

  removeAttendance: (id) =>
    set((state) => ({
      attendances: state.attendances.filter((a) => a.id !== id),
    })),

  getByMember: (memberId) =>
    get().attendances.filter((a) => a.memberId === memberId),

  getByDateRange: (start, end) =>
    get().attendances.filter((a) => a.date >= start && a.date <= end),

  getWithDefaults: (members, start, end) => {
    const existing = get().attendances.filter((a) => a.date >= start && a.date <= end);
    const defaults = generateDefaultAttendance(members, existing, start, end);
    return [...existing, ...defaults];
  },
}));
