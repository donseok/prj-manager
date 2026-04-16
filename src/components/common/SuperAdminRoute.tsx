import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

// 슈퍼관리자 전용 라우트 가드.
// 클라이언트 측 검증만 수행하므로, 민감한 작업은 서버(Supabase RLS)에서 별도로 검증해야 한다.
export default function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, isSuperAdmin } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (!isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
