import { Link } from 'react-router-dom';
import { FolderKanban, User, LogOut, Settings, Moon, Sun, ChevronRight } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useProjectStore } from '../../store/projectStore';
import { useThemeStore } from '../../store/themeStore';
import { useState } from 'react';

export default function Header() {
  const { user, logout } = useAuthStore();
  const { currentProject } = useProjectStore();
  const { isDark, toggleTheme } = useThemeStore();
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200/50 dark:border-gray-700/50 px-6 py-3 sticky top-0 z-40 transition-all duration-300">
      <div className="flex items-center justify-between">
        {/* 로고 및 프로젝트명 */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25 group-hover:shadow-blue-500/40 transition-all duration-300 group-hover:scale-105">
              <FolderKanban className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
              프로젝트 관리
            </span>
          </Link>

          {currentProject && (
            <div className="flex items-center gap-2 ml-2">
              <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <span className="px-3 py-1 bg-gradient-to-r from-blue-50 to-violet-50 dark:from-blue-900/30 dark:to-violet-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-medium border border-blue-100 dark:border-blue-800/50">
                {currentProject.name}
              </span>
            </div>
          )}
        </div>

        {/* 오른쪽 영역 */}
        <div className="flex items-center gap-2">
          {/* 다크모드 토글 */}
          <button
            onClick={toggleTheme}
            className="relative p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 group"
            title={isDark ? '라이트 모드' : '다크 모드'}
          >
            <div className="relative">
              {isDark ? (
                <Sun className="w-5 h-5 text-amber-400 group-hover:text-amber-300 transition-colors group-hover:rotate-45 duration-300" />
              ) : (
                <Moon className="w-5 h-5 text-slate-600 group-hover:text-slate-800 transition-colors group-hover:-rotate-12 duration-300" />
              )}
            </div>
          </button>

          {/* 사용자 메뉴 */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 group"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-violet-500 rounded-lg flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:shadow-blue-500/30 transition-all">
                <User className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{user?.name || '사용자'}</span>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-gray-800 rounded-xl shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 py-2 z-50 animate-scale-in">
                <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 mb-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400">로그인 계정</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.email || 'user@example.com'}</p>
                </div>
                <Link
                  to="/settings"
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  onClick={() => setShowUserMenu(false)}
                >
                  <Settings className="w-4 h-4" />
                  설정
                </Link>
                <button
                  onClick={() => {
                    logout();
                    setShowUserMenu(false);
                  }}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 w-full transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  로그아웃
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
