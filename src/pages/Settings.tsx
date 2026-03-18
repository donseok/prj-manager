import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, Trash2, Archive, Download, Upload, AlertTriangle } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { useTaskStore } from '../store/taskStore';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import { storage } from '../lib/utils';
import type { Task } from '../types';
import * as XLSX from 'xlsx';

export default function Settings() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { currentProject, updateProject, deleteProject } = useProjectStore();
  const { tasks, setTasks } = useTaskStore();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    baseDate: '',
  });

  // 프로젝트 데이터 로드
  useEffect(() => {
    if (currentProject) {
      setFormData({
        name: currentProject.name || '',
        description: currentProject.description || '',
        startDate: currentProject.startDate || '',
        endDate: currentProject.endDate || '',
        baseDate: currentProject.baseDate || '',
      });
    }
  }, [currentProject]);

  // 작업 로드
  useEffect(() => {
    if (projectId) {
      const savedTasks = storage.get<Task[]>(`tasks-${projectId}`, []);
      setTasks(savedTasks);
    }
  }, [projectId, setTasks]);

  const handleSave = () => {
    if (!projectId) return;
    setIsSaving(true);

    updateProject(projectId, {
      ...formData,
      updatedAt: new Date().toISOString(),
    });

    // 로컬 스토리지에도 저장
    const projects = storage.get('projects', []) as any[];
    const updatedProjects = projects.map((p) =>
      p.id === projectId ? { ...p, ...formData, updatedAt: new Date().toISOString() } : p
    );
    storage.set('projects', updatedProjects);

    setTimeout(() => {
      setIsSaving(false);
      alert('저장되었습니다.');
    }, 500);
  };

  const handleDelete = () => {
    if (!projectId) return;

    deleteProject(projectId);

    // 로컬 스토리지에서도 삭제
    const projects = storage.get('projects', []) as any[];
    const updatedProjects = projects.filter((p) => p.id !== projectId);
    storage.set('projects', updatedProjects);
    storage.remove(`tasks-${projectId}`);
    storage.remove(`members-${projectId}`);

    navigate('/projects');
  };

  const handleArchive = () => {
    if (!projectId) return;

    updateProject(projectId, { status: 'archived' });

    // 로컬 스토리지에도 저장
    const projects = storage.get('projects', []) as any[];
    const updatedProjects = projects.map((p) =>
      p.id === projectId ? { ...p, status: 'archived' } : p
    );
    storage.set('projects', updatedProjects);

    alert('프로젝트가 보관되었습니다.');
  };

  // 엑셀 내보내기
  const handleExportExcel = () => {
    if (tasks.length === 0) {
      alert('내보낼 작업이 없습니다.');
      return;
    }

    const exportData = tasks.map((task) => ({
      구분: task.level === 1 ? 'Phase' : task.level === 2 ? 'Activity' : task.level === 3 ? 'Task' : 'Function',
      작업명: task.name,
      산출물: task.output || '',
      담당자: task.assigneeId || '',
      가중치: task.weight,
      계획시작: task.planStart || '',
      계획종료: task.planEnd || '',
      계획공정율: task.planProgress,
      실적시작: task.actualStart || '',
      실적종료: task.actualEnd || '',
      실적공정율: task.actualProgress,
      상태: task.status,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'WBS');

    XLSX.writeFile(wb, `${currentProject?.name || 'project'}_WBS.xlsx`);
  };

  // 엑셀 가져오기
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        // 데이터 변환
        const importedTasks: Task[] = jsonData.map((row: any, index: number) => {
          const levelMap: Record<string, number> = {
            'Phase': 1,
            'Activity': 2,
            'Task': 3,
            'Function': 4,
          };

          return {
            id: crypto.randomUUID(),
            projectId: projectId!,
            parentId: null,
            level: levelMap[row['구분']] || 3,
            orderIndex: index,
            name: row['작업명'] || '',
            output: row['산출물'] || '',
            assigneeId: null,
            weight: parseFloat(row['가중치']) || 0,
            planStart: row['계획시작'] || null,
            planEnd: row['계획종료'] || null,
            planProgress: parseFloat(row['계획공정율']) || 0,
            actualStart: row['실적시작'] || null,
            actualEnd: row['실적종료'] || null,
            actualProgress: parseFloat(row['실적공정율']) || 0,
            status: row['상태'] || 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        });

        if (tasks.length > 0) {
          if (!confirm('기존 작업을 덮어쓰시겠습니까?')) {
            return;
          }
        }

        setTasks(importedTasks);
        storage.set(`tasks-${projectId}`, importedTasks);
        alert(`${importedTasks.length}개의 작업을 가져왔습니다.`);
      } catch (error) {
        console.error('Import error:', error);
        alert('엑셀 파일을 읽는 중 오류가 발생했습니다.');
      }
    };
    reader.readAsArrayBuffer(file);

    // 파일 입력 초기화
    e.target.value = '';
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">프로젝트 설정</h1>

      {/* 기본 정보 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">기본 정보</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">프로젝트명 *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">설명</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">시작일</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">종료일</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">진척기준일</label>
            <input
              type="date"
              value={formData.baseDate}
              onChange={(e) => setFormData({ ...formData, baseDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">공정율 계산의 기준이 되는 날짜입니다</p>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button onClick={handleSave} isLoading={isSaving}>
            <Save className="w-4 h-4 mr-2" />
            저장
          </Button>
        </div>
      </div>

      {/* 데이터 관리 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">데이터 관리</h2>

        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={handleExportExcel}>
            <Download className="w-4 h-4 mr-2" />
            엑셀 내보내기
          </Button>

          <label className="cursor-pointer inline-flex items-center justify-center font-medium rounded-lg transition-colors px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
            <Upload className="w-4 h-4 mr-2" />
            엑셀 가져오기
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImportExcel}
              className="hidden"
            />
          </label>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
          엑셀 파일로 WBS 데이터를 내보내거나 가져올 수 있습니다
        </p>
      </div>

      {/* 위험 영역 */}
      <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-6">
        <h2 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          위험 영역
        </h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-red-100 dark:border-red-900">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">프로젝트 보관</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">프로젝트를 보관 처리합니다. 복원 가능합니다.</p>
            </div>
            <Button variant="outline" onClick={handleArchive}>
              <Archive className="w-4 h-4 mr-2" />
              보관
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-red-100 dark:border-red-900">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">프로젝트 삭제</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">프로젝트와 모든 데이터가 영구 삭제됩니다.</p>
            </div>
            <Button variant="danger" onClick={() => setShowDeleteModal(true)}>
              <Trash2 className="w-4 h-4 mr-2" />
              삭제
            </Button>
          </div>
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="프로젝트 삭제"
        size="sm"
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">정말 삭제하시겠습니까?</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">이 작업은 되돌릴 수 없습니다.</p>
            </div>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            <strong>{currentProject?.name}</strong> 프로젝트와 모든 작업, 멤버 정보가 영구적으로 삭제됩니다.
          </p>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              취소
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              삭제
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
