import { Link } from 'react-router-dom';
import { Plus, FolderOpen, BarChart3, ArrowRight, Sparkles, TrendingUp, Clock } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import Button from '../components/common/Button';

export default function Home() {
  const { projects } = useProjectStore();

  const recentProjects = projects.slice(0, 5);
  const activeProjects = projects.filter(p => p.status === 'active').length;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-violet-600 to-purple-700 p-8 md:p-10 shadow-2xl">
        {/* Decorative dots pattern */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)',
            backgroundSize: '20px 20px'
          }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-yellow-300" />
            <span className="text-sm font-medium text-blue-100">프로젝트 관리 시스템</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
            IT 프로젝트를 효율적으로<br />관리하세요
          </h1>
          <p className="text-blue-100 text-lg mb-6 max-w-xl">
            WBS 기반의 체계적인 일정 관리와 실시간 진척 현황 모니터링으로 프로젝트를 성공적으로 완료하세요.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/projects/new">
              <Button className="bg-white text-blue-600 hover:bg-blue-50 shadow-lg shadow-blue-900/30 px-6 py-2.5">
                <Plus className="w-4 h-4 mr-2" />
                새 프로젝트 시작
              </Button>
            </Link>
            <Link to="/projects">
              <Button variant="outline" className="border-white/30 text-white hover:bg-white/10 px-6 py-2.5">
                프로젝트 둘러보기
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
        {/* Decorative elements */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute right-20 top-10 w-32 h-32 bg-yellow-400/20 rounded-full blur-2xl"></div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Link
          to="/projects/new"
          className="group relative bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-violet-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform duration-300">
              <Plus className="w-7 h-7 text-white" />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-1">새 프로젝트</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">새로운 프로젝트를 시작합니다</p>
          </div>
        </Link>

        <Link
          to="/projects"
          className="group relative bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative">
            <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform duration-300">
              <FolderOpen className="w-7 h-7 text-white" />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-1">프로젝트 목록</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">전체 프로젝트를 확인합니다</p>
          </div>
        </Link>

        <div className="group relative bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-purple-500/5"></div>
          <div className="relative">
            <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-violet-500/30">
              <BarChart3 className="w-7 h-7 text-white" />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-1">전체 현황</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                {projects.length}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">개 프로젝트</span>
            </div>
            <div className="flex items-center gap-1 mt-2 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">{activeProjects}개 진행중</span>
            </div>
          </div>
        </div>
      </div>

      {/* 최근 프로젝트 */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/25">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">최근 프로젝트</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">최근에 작업한 프로젝트들</p>
            </div>
          </div>
          <Link
            to="/projects"
            className="flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            전체 보기
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {recentProjects.length > 0 ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {recentProjects.map((project, index) => (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all duration-200 group"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-violet-100 dark:from-blue-900/50 dark:to-violet-900/50 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                    <FolderOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {project.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {project.startDate} ~ {project.endDate || '진행중'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                      project.status === 'active'
                        ? 'bg-gradient-to-r from-emerald-100 to-green-100 dark:from-emerald-900/50 dark:to-green-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600'
                    }`}
                  >
                    {project.status === 'active' ? '진행중' : '보관됨'}
                  </span>
                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all duration-200" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 px-6">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-3xl flex items-center justify-center mx-auto mb-5">
              <FolderOpen className="w-10 h-10 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">아직 프로젝트가 없습니다</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">새 프로젝트를 만들어 시작하세요</p>
            <Link to="/projects/new">
              <Button className="shadow-lg shadow-blue-500/25">
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
