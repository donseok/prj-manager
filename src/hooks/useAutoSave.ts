import { useEffect, useRef } from 'react';

/**
 * 데이터 변경 시 디바운스 자동 저장 훅.
 * WBS 태스크 저장, 멤버 저장 등에 공통 사용.
 */
export function useAutoSave<T>(
  data: T,
  saveFn: (data: T) => void | Promise<void>,
  options: {
    /** 현재 로드된 프로젝트 ID (null이면 저장하지 않음) */
    projectId: string | null | undefined;
    /** 로드 완료된 프로젝트 ID (projectId와 일치해야 저장) */
    loadedProjectId: string | null | undefined;
    /** 디바운스 지연 시간 (ms) */
    delay?: number;
  }
) {
  const { projectId, loadedProjectId, delay = 700 } = options;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!projectId || loadedProjectId !== projectId) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      void saveFn(data);
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, projectId, loadedProjectId, delay, saveFn]);
}
