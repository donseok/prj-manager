import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  FolderOpen,
  MoreVertical,
  Trash2,
  Search,
  ArrowRight,
  Sparkles,
  Play,
  CheckCircle2,
  Clock3,
} from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import { generateId } from '../lib/utils';
import { createLocalFallbackUser } from '../lib/supabase';
import { deleteProjectById, syncProjectMembers, upsertProject } from '../lib/dataRepository';
import {
  getProjectCardBackground,
  getProjectSummary,
  getProjectTimeline,
  getProjectVisualTone,
} from '../lib/projectVisuals';
import { useProjectStatus } from '../hooks/useProjectStatus';
import type { Project, ProjectMember, ProjectStatus } from '../types';
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from '../types';

export default function ProjectList() {
  const navigate = useNavigate();
  const { projects, addProject, deleteProject } = useProjectStore();
  const { user, isAdmin } = useAuthStore();
  const { isDark } = useThemeStore();
  const { changeStatus } = useProjectStatus();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    if (!menuOpenId) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpenId]);

  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
  });

  const filteredProjects = projects.filter(
    (project) =>
      project.status !== 'deleted' &&
      (statusFilter === 'all' || project.status === statusFilter) &&
      project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const preparingProjects = projects.filter((project) => project.status === 'preparing').length;
  const activeProjects = projects.filter((project) => project.status === 'active').length;
  const completedProjects = projects.filter((project) => project.status === 'completed').length;

  const handleCreateProject = async () => {
    if (!newProject.name.trim()) return;

    const owner = user || createLocalFallbackUser();
    const now = new Date().toISOString();
    const project: Project = {
      id: generateId(),
      ownerId: owner.id,
      name: newProject.name,
      description: newProject.description,
      startDate: newProject.startDate,
      endDate: newProject.endDate,
      status: 'preparing',
      createdAt: now,
      updatedAt: now,
    };

    const savedProject = await upsertProject(project);
    const ownerMember: ProjectMember = {
      id: generateId(),
      projectId: savedProject.id,
      userId: owner.id,
      name: owner.name,
      role: 'owner',
      createdAt: now,
    };

    await syncProjectMembers(savedProject.id, [ownerMember]);
    addProject(savedProject);
    setShowCreateModal(false);
    setNewProject({ name: '', description: '', startDate: '', endDate: '' });
    navigate(`/projects/${savedProject.id}`);
  };

  const handleDeleteProject = async (id: string) => {
    if (confirm('정말 삭제하시겠습니까?')) {
      await deleteProjectById(id);
      deleteProject(id);
    }
    setMenuOpenId(null);
  };

  const handleChangeStatus = async (id: string, newStatus: ProjectStatus) => {
    const project = projects.find((item) => item.id === id);
    if (!project) return;
    await changeStatus(project, newStatus);
    setMenuOpenId(null);
  };

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="app-panel-dark relative overflow-hidden p-6 md:p-8">
          <div className="pointer-events-none absolute right-[-4rem] top-[-6rem] h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.16),transparent_70%)] blur-3xl" />
          <div className="relative">
            <div className="surface-badge border-white/12 bg-white/[0.14] text-white/90">
              <Sparkles className="h-3.5 w-3.5 text-[color:var(--accent-secondary)]" />
              Project Library
            </div>
            <h1 className="mt-5 text-[clamp(2rem,4vw,3.8rem)] font-semibold tracking-[-0.06em] text-white">
              프로젝트를 한곳에서
              <br />
              선명하게 관리합니다
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/90 md:text-base">
              검색, 상태, 최근성까지 한 번에 읽히는 카드 뷰로 재구성했습니다. 프로젝트 생성 모달도
              같은 시각 언어로 맞춰 워크플로우가 끊기지 않도록 정리했습니다.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {isAdmin && (
                <Button onClick={() => setShowCreateModal(true)}>
                  <Plus className="w-4 h-4" />
                  새 프로젝트
                </Button>
              )}
              <Link to="/">
                <Button variant="outline" className="border-white/12 bg-white/[0.14] text-white hover:bg-white/[0.2]">
                  홈으로
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1">
          <div className="metric-card p-6">
            <p className="eyebrow-stat">Preparing</p>
            <p className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[color:var(--text-primary)]">
              {preparingProjects}
            </p>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">준비중 프로젝트</p>
          </div>
          <div className="metric-card p-6">
            <p className="eyebrow-stat">Active</p>
            <p className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[color:var(--text-primary)]">
              {activeProjects}
            </p>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">진행중 프로젝트</p>
          </div>
          <div className="metric-card p-6">
            <p className="eyebrow-stat">Completed</p>
            <p className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[color:var(--text-primary)]">
              {completedProjects}
            </p>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">완료된 프로젝트</p>
          </div>
        </div>
      </section>

      <section className="app-panel p-4 md:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="page-kicker">Search & Filter</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
              프로젝트 탐색
            </h2>
          </div>
          {isAdmin && (
            <Button variant="outline" onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4" />
              새 프로젝트
            </Button>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {([
            { key: 'all' as const, label: '전체', count: projects.filter((p) => p.status !== 'deleted').length },
            { key: 'preparing' as const, label: '준비', count: preparingProjects, icon: <Clock3 className="h-3.5 w-3.5" /> },
            { key: 'active' as const, label: '진행', count: activeProjects, icon: <Play className="h-3.5 w-3.5" /> },
            { key: 'completed' as const, label: '완료', count: completedProjects, icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 ${
                statusFilter === tab.key
                  ? 'border-[color:var(--accent-primary)] bg-[rgba(15,118,110,0.1)] text-[color:var(--accent-primary)]'
                  : 'border-[var(--border-color)] bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-tertiary)]'
              }`}
            >
              {tab.icon}
              {tab.label}
              <span className={`ml-1 rounded-full px-1.5 py-0.5 text-xs ${
                statusFilter === tab.key
                  ? 'bg-[rgba(15,118,110,0.15)] text-[color:var(--accent-primary)]'
                  : 'bg-[color:var(--bg-tertiary)] text-[color:var(--text-secondary)]'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-4 relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--text-muted)]" />
          <input
            type="text"
            placeholder="프로젝트 이름으로 검색"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="field-input !pl-12"
          />
        </div>
      </section>

      {filteredProjects.length > 0 ? (
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredProjects.map((project) => {
            const tone = getProjectVisualTone(project);
            const ToneIcon = tone.icon;

            return (
              <div
                key={project.id}
                className="metric-card group p-5 transition-all duration-300 hover:-translate-y-1"
                style={{ background: getProjectCardBackground(project, isDark) }}
              >
                <div className="absolute inset-x-6 top-0 h-px opacity-80" style={{ backgroundColor: tone.accent }} />
                <div
                  className="pointer-events-none absolute -right-8 top-[-2.5rem] h-24 w-24 rounded-full blur-3xl opacity-75"
                  style={{ backgroundColor: `${tone.accent}18` }}
                />

                <div className="relative">
                  <div className="flex items-start justify-between gap-3">
                    <Link to={`/projects/${project.id}`} className="min-w-0 flex-1">
                      <div className="flex items-start gap-3">
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-[20px] text-white shadow-[0_24px_48px_-28px_rgba(17,24,39,0.4)]"
                          style={{ background: `linear-gradient(135deg, ${tone.accent}, ${tone.accent}cc)` }}
                        >
                          <ToneIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div
                            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]"
                            style={{
                              borderColor: `${tone.accent}22`,
                              backgroundColor: `${tone.accent}10`,
                              color: tone.accent,
                            }}
                          >
                            <ToneIcon className="h-3.5 w-3.5" />
                            {tone.label}
                          </div>
                          <h3 className="mt-3 truncate text-lg font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">
                            {project.name}
                          </h3>
                          <p className="mt-1 line-clamp-2 text-sm leading-6 text-[color:var(--text-secondary)]">
                            {getProjectSummary(project)}
                          </p>
                        </div>
                      </div>
                    </Link>

                    <div className="relative" ref={menuOpenId === project.id ? menuRef : undefined}>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          setMenuOpenId(menuOpenId === project.id ? null : project.id);
                        }}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-color)] bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)] transition-all duration-200 hover:bg-[color:var(--bg-tertiary)] hover:text-[color:var(--text-primary)]"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>

                      {menuOpenId === project.id && (
                        <div className="absolute right-0 top-full z-10 mt-2 w-44 overflow-hidden rounded-[20px] border border-[var(--border-color)] bg-[image:var(--gradient-surface)] p-1.5 shadow-[0_26px_64px_-38px_rgba(0,0,0,0.48)] backdrop-blur-2xl dark:bg-[image:var(--gradient-dark)]">
                          {isAdmin && project.status !== 'preparing' && (
                            <button
                              onClick={() => handleChangeStatus(project.id, 'preparing')}
                              className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-[color:var(--text-primary)] transition-colors hover:bg-[color:var(--bg-elevated)]"
                            >
                              <Clock3 className="w-4 h-4" style={{ color: PROJECT_STATUS_COLORS.preparing }} />
                              준비로 변경
                            </button>
                          )}
                          {isAdmin && project.status !== 'active' && (
                            <button
                              onClick={() => handleChangeStatus(project.id, 'active')}
                              className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-[color:var(--text-primary)] transition-colors hover:bg-[color:var(--bg-elevated)]"
                            >
                              <Play className="w-4 h-4" style={{ color: PROJECT_STATUS_COLORS.active }} />
                              진행으로 변경
                            </button>
                          )}
                          {isAdmin && project.status !== 'completed' && (
                            <button
                              onClick={() => handleChangeStatus(project.id, 'completed')}
                              className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-[color:var(--text-primary)] transition-colors hover:bg-[color:var(--bg-elevated)]"
                            >
                              <CheckCircle2 className="w-4 h-4" style={{ color: PROJECT_STATUS_COLORS.completed }} />
                              완료 처리
                            </button>
                          )}
                          {isAdmin && (
                            <>
                              <div className="my-1 border-t border-[var(--border-color)]" />
                              <button
                                onClick={() => handleDeleteProject(project.id)}
                                className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-[color:var(--accent-danger)] transition-colors hover:bg-[rgba(203,75,95,0.08)]"
                              >
                                <Trash2 className="w-4 h-4" />
                                삭제
                              </button>
                            </>
                          )}
                          {!isAdmin && (
                            <p className="px-3 py-2 text-xs text-[color:var(--text-muted)]">
                              조회/수정만 가능합니다
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <Link to={`/projects/${project.id}`} className="mt-5 block">
                    <div className="rounded-[22px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-4">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-secondary)]">
                            Timeline
                          </p>
                          <p className="mt-1 font-medium text-[color:var(--text-primary)]">
                            {getProjectTimeline(project)}
                          </p>
                        </div>
                        <span
                          className="rounded-full px-3 py-1 text-xs font-semibold"
                          style={{
                            backgroundColor: `${PROJECT_STATUS_COLORS[project.status]}18`,
                            color: PROJECT_STATUS_COLORS[project.status],
                          }}
                        >
                          {PROJECT_STATUS_LABELS[project.status]}
                        </span>
                      </div>
                      {project.completedAt ? (
                        <p className="mt-3 text-xs text-[color:var(--text-secondary)]">
                          완료일: {new Date(project.completedAt).toLocaleDateString('ko-KR')}
                        </p>
                      ) : (
                        <p className="mt-3 text-xs" style={{ color: tone.accent }}>
                          {tone.note}
                        </p>
                      )}
                      <div className="mt-3 flex items-center justify-between">
                        <p className="text-sm font-medium text-[color:var(--text-primary)]">프로젝트 열기</p>
                        <ArrowRight className="h-4 w-4 text-[color:var(--text-muted)] transition-transform duration-200 group-hover:translate-x-1" />
                      </div>
                    </div>
                  </Link>
                </div>
              </div>
            );
          })}
        </section>
      ) : (
        <section className="app-panel">
          <div className="empty-state px-6 py-16">
            <FolderOpen className="h-12 w-12 text-[color:var(--text-muted)]" />
            <h3 className="text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
              {searchQuery ? '검색 결과가 없습니다' : '프로젝트가 없습니다'}
            </h3>
            <p className="max-w-md text-sm leading-6 text-[color:var(--text-secondary)]">
              {searchQuery
                ? '다른 키워드로 검색하거나 새 프로젝트를 생성해보세요.'
                : '첫 프로젝트를 만들면 여기에서 카드 기반으로 관리할 수 있습니다.'}
            </p>
            {!searchQuery && isAdmin && (
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4" />
                새 프로젝트 만들기
              </Button>
            )}
          </div>
        </section>
      )}

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="새 프로젝트"
        size="md"
      >
        <div className="space-y-5 p-6">
          <div>
            <label className="field-label">프로젝트명 *</label>
            <input
              type="text"
              value={newProject.name}
              onChange={(event) => setNewProject({ ...newProject, name: event.target.value })}
              className="field-input"
              placeholder="예: 통합 운영 대시보드 고도화"
              autoFocus
            />
          </div>

          <div>
            <label className="field-label">설명</label>
            <textarea
              value={newProject.description}
              onChange={(event) => setNewProject({ ...newProject, description: event.target.value })}
              className="field-textarea"
              rows={4}
              placeholder="프로젝트 목적, 범위, 전달 포인트를 간단히 적어주세요"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="field-label">시작일</label>
              <input
                type="date"
                value={newProject.startDate}
                onChange={(event) => setNewProject({ ...newProject, startDate: event.target.value })}
                className="field-input"
              />
            </div>
            <div>
              <label className="field-label">종료일</label>
              <input
                type="date"
                value={newProject.endDate}
                onChange={(event) => setNewProject({ ...newProject, endDate: event.target.value })}
                className="field-input"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
              취소
            </Button>
            <Button onClick={handleCreateProject} disabled={!newProject.name.trim()}>
              생성
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
