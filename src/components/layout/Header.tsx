import { Link } from 'react-router-dom';
import { FolderKanban, User, LogOut, Settings, Moon, Sun } from 'lucide-react';
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
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 transition-colors">
      <div className="flex items-center justify-between">
        {/* 로고 및 프로젝트명 */}
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400">
            <FolderKanban className="w-6 h-6" />
            <span className="font-semibold text-lg">프로젝트 관리</span>
          </Link>

          {currentProject && (
            <>
              <span className="text-gray-300 dark:text-gray-600">/</span>
              <span className="text-gray-700 dark:text-gray-300 font-medium">{currentProject.name}</span>
            </>
          )}
        </div>

        {/* 오른쪽 영역 */}
        <div className="flex items-center gap-2">
          {/* 다크모드 토글 */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={isDark ? '라이트 모드' : '다크 모드'}
          >
            {isDark ? (
              <Sun className="w-5 h-5 text-yellow-500" />
            ) : (
              <Moon className="w-5 h-5 text-gray-600" />
            )}
          </button>

          {/* 사용자 메뉴 */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-sm text-gray-700 dark:text-gray-300">{user?.name || '사용자'}</span>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                <Link
                  to="/settings"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
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
                  className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-700 w-full"
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
