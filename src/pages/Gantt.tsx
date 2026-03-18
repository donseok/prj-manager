import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTaskStore } from '../store/taskStore';
import { useProjectStore } from '../store/projectStore';
import GanttChart from '../components/wbs/GanttChart';
import { storage, cn } from '../lib/utils';
import type { Task } from '../types';
import { LEVEL_LABELS } from '../types';
import { ChevronDown, ChevronRight } from 'lucide-react';

const ROW_HEIGHT = 36;

export default function Gantt() {
  const { projectId } = useParams<{ projectId: string }>();
  const { tasks, flatTasks, setTasks, toggleExpand, updateTask } = useTaskStore();
  const { currentProject } = useProjectStore();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // 작업 테이블 스크롤 동기화
  const tableRef = useRef<HTMLDivElement>(null);
  const [, setTableScrollTop] = useState(0);

  // 로컬 스토리지에서 작업 로드
  useEffect(() => {
    if (projectId) {
      const savedTasks = storage.get<Task[]>(`tasks-${projectId}`, []);
      setTasks(savedTasks);
    }
  }, [projectId, setTasks]);

  // 스크롤 동기화
  const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setTableScrollTop(e.currentTarget.scrollTop);
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTaskId(task.id);
  };

  const handleDateChange = (
    taskId: string,
    field: 'planStart' | 'planEnd' | 'actualStart' | 'actualEnd',
    date: string
  ) => {
    updateTask(taskId, { [field]: date });
    // 저장
    if (projectId) {
      const updatedTasks = tasks.map((t) =>
        t.id === taskId ? { ...t, [field]: date } : t
      );
      storage.set(`tasks-${projectId}`, updatedTasks);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {currentProject?.name || '프로젝트'} - 간트 차트
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          작업 일정을 시각적으로 확인하고 관리합니다
        </p>
      </div>

      <div className="flex-1 flex gap-0 min-h-0 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
        {/* 왼쪽: 작업 목록 */}
        <div className="w-80 flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
          {/* 헤더 */}
          <div className="h-[60px] border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center px-3">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">작업명</span>
          </div>

          {/* 작업 목록 */}
          <div
            ref={tableRef}
            className="flex-1 overflow-auto"
            onScroll={handleTableScroll}
          >
            {flatTasks.map((task) => {
              const hasChildren = tasks.some((t) => t.parentId === task.id);
              const isSelected = selectedTaskId === task.id;

              return (
                <div
                  key={task.id}
                  className={cn(
                    'flex items-center px-2 border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700',
                    isSelected && 'bg-blue-50 dark:bg-blue-900/30',
                    task.level === 1 && 'bg-gray-50 dark:bg-gray-900/50 font-medium'
                  )}
                  style={{
                    height: ROW_HEIGHT,
                    paddingLeft: `${(task.depth || 0) * 16 + 8}px`,
                  }}
                  onClick={() => handleTaskClick(task)}
                >
                  {/* 펼침/접기 버튼 */}
                  {hasChildren ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(task.id);
                      }}
                      className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded mr-1"
                    >
                      {task.isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      )}
                    </button>
                  ) : (
                    <span className="w-5" />
                  )}

                  {/* 레벨 표시 */}
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 mr-2 w-12 flex-shrink-0">
                    {LEVEL_LABELS[task.level] || `L${task.level}`}
                  </span>

                  {/* 작업명 */}
                  <span className="text-sm truncate flex-1 text-gray-900 dark:text-gray-100">
                    {task.name || <span className="text-gray-400 dark:text-gray-500">이름 없음</span>}
                  </span>

                  {/* 진행률 */}
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                    {task.actualProgress}%
                  </span>
                </div>
              );
            })}

            {flatTasks.length === 0 && (
              <div className="flex items-center justify-center h-32 text-gray-400 dark:text-gray-500 text-sm">
                작업이 없습니다
              </div>
            )}
          </div>
        </div>

        {/* 오른쪽: 간트 차트 */}
        <div className="flex-1 min-w-0">
          <GanttChart
            tasks={flatTasks}
            onTaskClick={handleTaskClick}
            onDateChange={handleDateChange}
          />
        </div>
      </div>

      {/* 범례 */}
      <div className="mt-4 flex items-center gap-6 text-sm text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <div className="w-6 h-3 bg-blue-200 dark:bg-blue-800 border border-blue-400 dark:border-blue-600 rounded" />
          <span>계획</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-3 bg-green-400 dark:bg-green-600 border border-green-500 dark:border-green-500 rounded" />
          <span>실적</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-0.5 h-4 bg-red-500" />
          <span>오늘</span>
        </div>
      </div>
    </div>
  );
}
