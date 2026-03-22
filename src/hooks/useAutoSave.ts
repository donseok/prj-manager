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
    /** 디바운스 최대 지연 상한 (ms) — 연속 편집 시에도 이 시간 안에 저장 보장 */
    maxDelay?: number;
  }
) {
  const { projectId, loadedProjectId, delay = 700, maxDelay = 5000 } = options;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentProjectIdRef = useRef<string | null | undefined>(null);
  const hydratedRef = useRef(false);
  const latestDataRef = useRef(data);
  const saveFnRef = useRef(saveFn);
  const isSavingRef = useRef(false);
  const pendingAfterSaveRef = useRef(false);
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

  const clearMaxTimeout = useCallback(() => {
    if (maxTimeoutRef.current) {
      clearTimeout(maxTimeoutRef.current);
      maxTimeoutRef.current = null;
    }
  }, []);

  const runSave = useCallback(async (payload: T) => {
    // 이미 저장 중이면 완료 후 재시도 예약
    if (isSavingRef.current) {
      pendingAfterSaveRef.current = true;
      return;
    }

    clearPendingSave();
    clearMaxTimeout();
    isSavingRef.current = true;
    setSaveStatus('saving');

    try {
      await saveFnRef.current(payload);
      setLastSavedAt(new Date().toISOString());
      setSaveStatus('saved');
    } catch (error) {
      console.error('자동 저장 실패:', error);
      setSaveStatus('error');
    } finally {
      isSavingRef.current = false;
      // 저장 중 새 변경이 있었으면 최신 데이터로 즉시 재저장
      if (pendingAfterSaveRef.current) {
        pendingAfterSaveRef.current = false;
        void runSave(latestDataRef.current);
      }
    }
  }, [clearPendingSave, clearMaxTimeout]);

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
    let isActive = true;

    if (!projectId || loadedProjectId !== projectId) {
      clearPendingSave();
      clearMaxTimeout();
      return () => {
        isActive = false;
      };
    }

    if (currentProjectIdRef.current !== projectId) {
      currentProjectIdRef.current = projectId;
      hydratedRef.current = false;
      // 프로젝트 전환 시 저장 상태 초기화 (의도적 effect 내 setState)
      queueMicrotask(() => {
        if (!isActive) return;
        setSaveStatus('idle');
        setLastSavedAt(null);
      });
    }

    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return () => {
        isActive = false;
      };
    }

    hasPendingSave.current = true;
    queueMicrotask(() => {
      if (!isActive) return;
      setSaveStatus('pending');
    });

    // 디바운스 타이머: 매 변경마다 리셋
    clearPendingSave();
    timeoutRef.current = setTimeout(() => {
      hasPendingSave.current = false;
      void runSave(latestDataRef.current);
    }, delay);

    // 최대 지연 타이머: 첫 변경 이후 maxDelay 내 반드시 저장 (이미 돌고 있으면 유지)
    if (!maxTimeoutRef.current) {
      maxTimeoutRef.current = setTimeout(() => {
        maxTimeoutRef.current = null;
        clearPendingSave();
        hasPendingSave.current = false;
        void runSave(latestDataRef.current);
      }, maxDelay);
    }

    return () => {
      isActive = false;
      clearPendingSave();
    };
  }, [clearPendingSave, clearMaxTimeout, data, delay, maxDelay, loadedProjectId, projectId, runSave]);

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
  }, []);

  return {
    saveStatus,
    lastSavedAt,
    saveNow: async (payload?: T) => runSave(payload ?? latestDataRef.current),
  };
}
