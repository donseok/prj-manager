import { useCallback, useEffect, useRef, useState } from 'react';

export type AutoSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

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
  const currentProjectIdRef = useRef<string | null | undefined>(null);
  const hydratedRef = useRef(false);
  const latestDataRef = useRef(data);
  const saveFnRef = useRef(saveFn);
  const [saveStatus, setSaveStatus] = useState<AutoSaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  useEffect(() => {
    latestDataRef.current = data;
  }, [data]);

  useEffect(() => {
    saveFnRef.current = saveFn;
  }, [saveFn]);

  const clearPendingSave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const runSave = useCallback(async (payload: T) => {
    clearPendingSave();
    setSaveStatus('saving');

    try {
      await saveFnRef.current(payload);
      setLastSavedAt(new Date().toISOString());
      setSaveStatus('saved');
    } catch (error) {
      console.error('자동 저장 실패:', error);
      setSaveStatus('error');
      throw error;
    }
  }, [clearPendingSave]);

  // 미저장 변경사항이 있을 때 페이지 이탈 경고
  const hasPendingSave = useRef(false);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasPendingSave.current) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    if (!projectId || loadedProjectId !== projectId) {
      clearPendingSave();
      return;
    }

    if (currentProjectIdRef.current !== projectId) {
      currentProjectIdRef.current = projectId;
      hydratedRef.current = false;
      // 프로젝트 전환 시 저장 상태 초기화 (의도적 effect 내 setState)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 프로젝트 전환 시 저장 상태 초기화
      setSaveStatus('idle');
      setLastSavedAt(null);
    }

    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }

    hasPendingSave.current = true;
    setSaveStatus('pending');
    timeoutRef.current = setTimeout(() => {
      hasPendingSave.current = false;
      void runSave(latestDataRef.current);
    }, delay);

    return () => {
      clearPendingSave();
    };
  }, [clearPendingSave, data, delay, loadedProjectId, projectId, runSave]);

  // 컴포넌트 언마운트 시 (세션 만료 등) 보류 중인 변경사항 즉시 저장
  useEffect(() => {
    return () => {
      if (hasPendingSave.current && currentProjectIdRef.current) {
        hasPendingSave.current = false;
        try {
          saveFnRef.current(latestDataRef.current);
        } catch {
          // 언마운트 시 에러 무시
        }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 언마운트 전용
  }, []);

  return {
    saveStatus,
    lastSavedAt,
    saveNow: async (payload?: T) => runSave(payload ?? latestDataRef.current),
  };
}
