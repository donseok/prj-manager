import { Link } from 'react-router-dom';
import { Plus, FolderOpen, BarChart3 } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import Button from '../components/common/Button';

export default function Home() {
  const { projects } = useProjectStore();

  const recentProjects = projects.slice(0, 5);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">프로젝트 관리 시스템</h1>
        <p className="text-gray-600 dark:text-gray-400">IT 프로젝트의 일정과 작업을 효율적으로 관리하세요.</p>
      </div>

      {/* 빠른 액션 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link
          to="/projects/new"
          className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-6 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors group"
        >
          <Plus className="w-10 h-10 text-blue-600 dark:text-blue-400 mb-3 group-hover:scale-110 transition-transform" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">새 프로젝트</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">새로운 프로젝트를 시작합니다</p>
        </Link>

        <Link
          to="/projects"
          className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-xl p-6 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors group"
        >
          <FolderOpen className="w-10 h-10 text-green-600 dark:text-green-400 mb-3 group-hover:scale-110 transition-transform" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">프로젝트 목록</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">전체 프로젝트를 확인합니다</p>
        </Link>

        <div className="bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-xl p-6">
          <BarChart3 className="w-10 h-10 text-purple-600 dark:text-purple-400 mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">전체 현황</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            총 {projects.length}개 프로젝트
          </p>
        </div>
      </div>

      {/* 최근 프로젝트 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">최근 프로젝트</h2>
          <Link to="/projects" className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
            전체 보기
          </Link>
        </div>

        {recentProjects.length > 0 ? (
          <div className="space-y-3">
            {recentProjects.map((project) => (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="flex items-center justify-between p-4 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                    <FolderOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{project.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {project.startDate} ~ {project.endDate || '진행중'}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    project.status === 'active'
                      ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {project.status === 'active' ? '진행중' : '보관됨'}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <FolderOpen className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 mb-4">아직 프로젝트가 없습니다</p>
            <Link to="/projects/new">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                새 프로젝트 만들기
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
