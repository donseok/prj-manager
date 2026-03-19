import { useEffect, useState } from 'react';
import { Shield, ShieldCheck, Search, Users } from 'lucide-react';
import { loadAllProfiles, updateUserSystemRole } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import type { SystemRole } from '../types';

interface ProfileItem {
  id: string;
  email: string;
  name: string;
  systemRole: SystemRole;
  createdAt: string;
}

export default function UserManagement() {
  const { user } = useAuthStore();
  const [profiles, setProfiles] = useState<ProfileItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    void loadAllProfiles().then((data) => {
      setProfiles(data);
      setLoading(false);
    });
  }, []);

  const filtered = profiles.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleRoleChange = async (userId: string, newRole: SystemRole) => {
    if (userId === user?.id) return; // 자기 자신 역할 변경 방지
    setUpdating(userId);
    const { error } = await updateUserSystemRole(userId, newRole);
    if (!error) {
      setProfiles((prev) =>
        prev.map((p) => (p.id === userId ? { ...p, systemRole: newRole } : p))
      );
    }
    setUpdating(null);
  };

  return (
    <section className="app-panel p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em]">사용자 관리</h1>
          <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
            시스템 사용자 목록 및 역할을 관리합니다.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-3 py-2">
          <Search className="h-4 w-4 text-[color:var(--text-secondary)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름 또는 이메일 검색..."
            className="w-48 bg-transparent text-sm outline-none placeholder:text-[color:var(--text-secondary)]"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent-primary)]/30 border-t-[var(--accent-primary)]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-[color:var(--text-muted)]">
          <Users className="mb-3 h-10 w-10 opacity-40" />
          <p className="text-sm">{search ? '검색 결과가 없습니다.' : '등록된 사용자가 없습니다.'}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--border-color)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-[color:var(--bg-elevated)]">
                <th className="px-4 py-3 text-left font-semibold text-[color:var(--text-secondary)]">이름</th>
                <th className="px-4 py-3 text-left font-semibold text-[color:var(--text-secondary)]">이메일</th>
                <th className="px-4 py-3 text-left font-semibold text-[color:var(--text-secondary)]">가입일</th>
                <th className="px-4 py-3 text-center font-semibold text-[color:var(--text-secondary)]">역할</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((profile) => (
                <tr
                  key={profile.id}
                  className="border-b border-[var(--border-color)] last:border-b-0 transition-colors hover:bg-[color:var(--bg-elevated)]"
                >
                  <td className="px-4 py-3 font-medium">
                    {profile.name}
                    {profile.id === user?.id && (
                      <span className="ml-2 text-xs text-[color:var(--text-secondary)]">(나)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[color:var(--text-secondary)]">{profile.email}</td>
                  <td className="px-4 py-3 text-[color:var(--text-secondary)]">
                    {new Date(profile.createdAt).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center">
                      {profile.id === user?.id ? (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-teal-100 px-3 py-1.5 text-xs font-semibold text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          관리자
                        </span>
                      ) : (
                        <button
                          onClick={() =>
                            void handleRoleChange(
                              profile.id,
                              profile.systemRole === 'admin' ? 'user' : 'admin'
                            )
                          }
                          disabled={updating === profile.id}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-50 ${
                            profile.systemRole === 'admin'
                              ? 'bg-teal-100 text-teal-700 hover:bg-teal-200 dark:bg-teal-900/30 dark:text-teal-400'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800/40 dark:text-gray-400'
                          }`}
                        >
                          {updating === profile.id ? (
                            <div className="h-3.5 w-3.5 animate-spin rounded-full border border-current/30 border-t-current" />
                          ) : profile.systemRole === 'admin' ? (
                            <ShieldCheck className="h-3.5 w-3.5" />
                          ) : (
                            <Shield className="h-3.5 w-3.5" />
                          )}
                          {profile.systemRole === 'admin' ? '관리자' : '일반 사용자'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
