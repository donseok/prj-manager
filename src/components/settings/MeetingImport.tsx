import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, Loader2, Brain, AlertCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { parseMeetingFile } from '../../lib/meeting/meetingParser';
import { analyzeMeeting } from '../../lib/meeting/meetingAnalyzer';
import { isAIConfigured } from '../../lib/ai';
import MeetingPreviewModal from './MeetingPreviewModal';
import { cn } from '../../lib/utils';
import type { Task, MeetingTask, ProjectMember } from '../../types';

interface MeetingImportProps {
  projectId: string;
  tasks: Task[];
  members: ProjectMember[];
  /** 추출된 Task 배열을 상위에 전달. 상위에서 병합·저장을 담당한다. */
  onTasksAdded: (newTasks: Task[]) => void;
}

const ACCEPTED_EXTENSIONS = '.pdf,.txt,.docx';
const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

function convertToTasks(
  meetingTasks: MeetingTask[],
  projectId: string,
  parentId: string | null,
  existingTasks: Task[],
): Task[] {
  const now = new Date().toISOString();
  const maxOrder = existingTasks
    .filter((t) => t.parentId === parentId)
    .reduce((max, t) => Math.max(max, t.orderIndex), -1);

  return meetingTasks
    .filter((t) => t.selected)
    .map((mt, idx) => ({
      id: uuidv4(),
      projectId,
      parentId: (mt as MeetingTask & { parentId?: string }).parentId || parentId || undefined,
      level: mt.level,
      orderIndex: maxOrder + 1 + idx,
      name: mt.name,
      description: mt.description,
      assigneeId: (mt as MeetingTask & { assigneeId?: string }).assigneeId || undefined,
      weight: 1,
      planStart: mt.startDate || null,
      planEnd: mt.endDate || null,
      planProgress: 0,
      actualProgress: 0,
      status: 'pending' as const,
      taskSource: 'ai_generated' as const,
      createdAt: now,
      updatedAt: now,
    }));
}

function isValidFileType(file: File): boolean {
  if (ACCEPTED_MIME_TYPES.includes(file.type)) return true;
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ext === 'pdf' || ext === 'txt' || ext === 'docx';
}

export default function MeetingImport({ projectId, tasks, members, onTasksAdded }: MeetingImportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [extractedTasks, setExtractedTasks] = useState<MeetingTask[] | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const aiEnabled = isAIConfigured();

  const processFile = useCallback(
    async (file: File) => {
      if (!isValidFileType(file)) {
        setError('지원하지 않는 파일 형식입니다. PDF, TXT, DOCX 파일만 업로드할 수 있습니다.');
        return;
      }

      setError(null);
      setIsProcessing(true);

      try {
        setProcessingStep('회의록 텍스트 추출 중...');
        const parsed = await parseMeetingFile(file);
        const text = parsed.text;

        if (!text || text.trim().length === 0) {
          setError('파일에서 텍스트를 추출할 수 없습니다. 파일 내용을 확인해주세요.');
          setIsProcessing(false);
          return;
        }

        setProcessingStep(aiEnabled ? '회의록 분석 중... (AI 파싱)' : '회의록 분석 중... (규칙 기반 파싱)');
        const meetingTasks = await analyzeMeeting(text, aiEnabled);

        if (!meetingTasks || meetingTasks.length === 0) {
          setError('회의록에서 업무 항목을 찾을 수 없습니다. 회의록 내용을 확인해주세요.');
          setIsProcessing(false);
          return;
        }

        setExtractedTasks(meetingTasks);
        setShowPreview(true);
      } catch (err) {
        console.error('[MeetingImport] Processing error:', err);
        setError(
          err instanceof Error
            ? `분석 중 오류가 발생했습니다: ${err.message}`
            : '회의록 분석 중 알 수 없는 오류가 발생했습니다.',
        );
      } finally {
        setIsProcessing(false);
        setProcessingStep('');
      }
    },
    [aiEnabled],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        void processFile(file);
      }
      // Reset so the same file can be selected again
      e.target.value = '';
    },
    [processFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const file = e.dataTransfer.files?.[0];
      if (file) {
        void processFile(file);
      }
    },
    [processFile],
  );

  const handleConfirm = useCallback(
    (confirmedTasks: MeetingTask[]) => {
      const selectedCount = confirmedTasks.filter((t) => t.selected).length;
      if (selectedCount === 0) {
        setShowPreview(false);
        setExtractedTasks(null);
        return;
      }

      const newTasks = convertToTasks(confirmedTasks, projectId, null, tasks);
      onTasksAdded(newTasks);
      setShowPreview(false);
      setExtractedTasks(null);
    },
    [projectId, tasks, onTasksAdded],
  );

  const handleClosePreview = useCallback(() => {
    setShowPreview(false);
    setExtractedTasks(null);
  }, []);

  return (
    <div className="app-panel p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-[linear-gradient(135deg,#0ea5e9,#38bdf8)] text-white shadow-[0_18px_36px_-22px_rgba(14,165,233,0.7)]">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">
            회의록 임포트
          </h2>
          <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
            회의록 파일을 업로드하면 {aiEnabled ? 'AI가' : '규칙 기반으로'} 분석하여 업무 항목을 자동으로 추출합니다.
          </p>
        </div>
      </div>

      {/* AI status badge */}
      <div className="mt-4">
        {aiEnabled ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-600 dark:text-purple-400">
            <Brain className="h-3.5 w-3.5" />
            AI 분석 활성화됨
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-500/10 px-3 py-1 text-xs font-medium text-[color:var(--text-tertiary)]">
            <FileText className="h-3.5 w-3.5" />
            규칙 기반 분석
          </span>
        )}
      </div>

      {/* Drop zone */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          disabled={isProcessing}
          className={cn(
            'w-full rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-[rgba(15,118,110,0.28)] focus:ring-offset-2',
            isDragOver
              ? 'border-teal-500 bg-teal-500/5 dark:bg-teal-500/10'
              : 'border-[var(--border-color)] bg-[color:var(--bg-secondary)] hover:border-[rgba(15,118,110,0.28)] hover:bg-[color:var(--bg-tertiary)]',
            isProcessing && 'pointer-events-none opacity-60',
          )}
        >
          {isProcessing ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-teal-600 dark:text-teal-400" />
              <p className="text-sm font-medium text-[color:var(--text-primary)]">{processingStep}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload className="h-8 w-8 text-[color:var(--text-tertiary)]" />
              <div>
                <p className="text-sm font-medium text-[color:var(--text-primary)]">
                  파일을 드래그하거나 클릭하여 업로드하세요
                </p>
                <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">PDF, TXT, DOCX</p>
              </div>
            </div>
          )}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-500/20 dark:bg-red-500/10">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Preview modal */}
      {extractedTasks && (
        <MeetingPreviewModal
          isOpen={showPreview}
          onClose={handleClosePreview}
          tasks={extractedTasks}
          existingTasks={tasks}
          members={members}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}
