import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

// 프로젝트 관리자 전용 라우트 가드.
// 로그인된 사용자라면 접근 허용한다. 실제 "관리할 프로젝트가 있는지" 여부는
// ProjectAdminHome이 멤버 데이터를 조회하여 필터링하고, 없으면 빈 상태를 표시한다.
export default function ProjectAdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
