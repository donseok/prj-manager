import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
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
  Loader2,
  FolderKanban,
  Layers,
  GitBranch,
  Target,
  BarChart3,
  Users,
  Calendar,
  Bookmark,
} from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import Button from '../components/common/Button';
import ConfirmModal from '../components/common/ConfirmModal';
import FeedbackNotice from '../components/common/FeedbackNotice';
import Modal from '../components/common/Modal';
import { generateId } from '../lib/utils';
import { deleteProjectById, loadProjectMembers, loadProjectTasks, syncProjectMembers, syncProjectTasks, upsertProject } from '../lib/dataRepository';
import { cloneProjectMembers, cloneProjectTasks } from '../lib/projectClone';
import { logAuditEvent } from '../lib/auditLog';
import {
  getProjectCardBackground,
  getProjectSummary,
  getProjectTimeline,
  getProjectVisualTone,
} from '../lib/projectVisuals';
import { useProjectStatus } from '../hooks/useProjectStatus';
import { usePageFeedback } from '../hooks/usePageFeedback';
import { useSystemSettingsStore } from '../store/systemSettingsStore';
import type { Project, ProjectMember, ProjectStatus } from '../types';
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from '../types';

export default function ProjectList() {
  const navigate = useNavigate();
  const location = useLocation();
  const { projects, addProject, deleteProject } = useProjectStore();
  const { user, isAdmin } = useAuthStore();
  const { isDark } = useThemeStore();
  const { changeStatus } = useProjectStatus();
  const { settings: systemSettings } = useSystemSettingsStore();
  const canCreateProject = systemSettings.projectCreationPolicy === 'all' || isAdmin;
  const [showCreateModal, setShowCreateModal] = useState(false);

  // /projects/new 경로 접근 시 생성 모달 자동 오픈
  useEffect(() => {
    if (location.pathname === '/projects/new') {
      setShowCreateModal(true);
    }
  }, [location.pathname]);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [pendingDeleteProject, setPendingDeleteProject] = useState<Project | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const { feedback, showFeedback, clearFeedback } = usePageFeedback();

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
    creationMode: 'blank',
    sourceProjectId: '',
  });

  const validateProjectName = (name: string): string | null => {
    const trimmed = name.trim();
    if (!trimmed) return null; // 빈 값은 disabled로 처리
    if (trimmed.length < 2) return '프로젝트명은 2자 이상이어야 합니다.';
    if (!/[a-zA-Z0-9가-힣]/.test(trimmed)) return '프로젝트명에는 한글, 영문 또는 숫자가 포함되어야 합니다.';
    if (/<[^>]*>/.test(trimmed)) return 'HTML 태그는 사용할 수 없습니다.';
    return null;
  };

  const validateDates = (startDate: string, endDate: string): string | null => {
    if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
      return '종료일은 시작일보다 이후여야 합니다.';
    }
    return null;
  };

  const nameError = validateProjectName(newProject.name);
  const dateError = validateDates(newProject.startDate, newProject.endDate);

  const isCreateDisabled = isCreating
    || !newProject.name.trim()
    || !!nameError
    || !!dateError
    || (newProject.creationMode === 'clone' && !newProject.sourceProjectId);

  const getCreateButtonText = (): string => {
    if (isCreating) return ''; // handled separately with spinner
    if (!newProject.name.trim()) return '프로젝트명을 입력해주세요';
    if (nameError) return '프로젝트명을 확인해주세요';
    if (dateError) return '날짜를 확인해주세요';
    if (newProject.creationMode === 'clone' && !newProject.sourceProjectId) return '복제 원본을 선택해주세요';
    return '생성';
  };

  const filteredProjects = projects.filter(
    (project) =>
      project.status !== 'deleted' &&
      (statusFilter === 'all' || project.status === statusFilter) &&
      project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const reusableProjects = projects.filter((project) => project.status !== 'deleted');

  const preparingProjects = projects.filter((project) => project.status === 'preparing').length;
  const activeProjects = projects.filter((project) => project.status === 'active').length;
  const completedProjects = projects.filter((project) => project.status === 'completed').length;

  const handleCreateProject = async () => {
    if (!newProject.name.trim()) return;
    if (!user) return;
    if (isCreating) return;

    setIsCreating(true);
    const timeoutId = setTimeout(() => {
      setIsCreating(false);
      showFeedback({ tone: 'error', title: '요청 시간 초과', message: '프로젝트 생성에 시간이 너무 오래 걸립니다. 다시 시도해주세요.' });
    }, 15000);

    try {
      const owner = user;
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
      if (newProject.creationMode === 'clone' && newProject.sourceProjectId) {
        const [sourceMembers, sourceTasks] = await Promise.all([
          loadProjectMembers(newProject.sourceProjectId),
          loadProjectTasks(newProject.sourceProjectId),
        ]);

        const { members: clonedMembers, memberIdMap } = cloneProjectMembers({
          sourceMembers,
          targetProjectId: savedProject.id,
          ownerUserId: owner.id,
          ownerName: owner.name,
        });
        const hasOwner = clonedMembers.some((member) => member.userId === owner.id);
        const ownerMember: ProjectMember = {
          id: generateId(),
          projectId: savedProject.id,
          userId: owner.id,
          name: owner.name,
          role: 'owner',
          createdAt: now,
        };

        const nextMembers = hasOwner ? clonedMembers : [ownerMember, ...clonedMembers];
        await syncProjectMembers(savedProject.id, nextMembers);
        await syncProjectTasks(
          savedProject.id,
          cloneProjectTasks({
            sourceTasks,
            targetProjectId: savedProject.id,
            memberIdMap,
          })
        );
      } else {
        const ownerMember: ProjectMember = {
          id: generateId(),
          projectId: savedProject.id,
          userId: owner.id,
          name: owner.name,
          role: 'owner',
          createdAt: now,
        };

        await syncProjectMembers(savedProject.id, [ownerMember]);
      }

      addProject(savedProject);
      setShowCreateModal(false);
      setNewProject({ name: '', description: '', startDate: '', endDate: '', creationMode: 'blank', sourceProjectId: '' });
      navigate(`/projects/${savedProject.id}`);
    } catch (err) {
      console.error('Failed to create project:', err);
      setShowCreateModal(false);
      const msg = err instanceof Error ? err.message : String(err);
      showFeedback({
        tone: 'error',
        title: '프로젝트 생성 실패',
        message: msg,
      });
    } finally {
      clearTimeout(timeoutId);
      setIsCreating(false);
    }
  };

  const handleDeleteProject = (project: Project) => {
    setPendingDeleteProject(project);
    setMenuOpenId(null);
  };

  const confirmDeleteProject = async () => {
    if (!pendingDeleteProject) return;

    setIsDeleting(true);
    try {
      if (user) {
        await logAuditEvent({
          projectId: pendingDeleteProject.id,
          userId: user.id,
          userName: user.name,
          action: 'project.delete',
          details: `프로젝트 "${pendingDeleteProject.name}" 삭제`,
        });
      }
      await deleteProjectById(pendingDeleteProject.id);
      deleteProject(pendingDeleteProject.id);
      showFeedback({
        tone: 'success',
        title: '프로젝트 삭제 완료',
        message: `"${pendingDeleteProject.name}" 프로젝트를 삭제했습니다.`,
      });
    } catch (error) {
      console.error('Failed to delete project:', error);
      showFeedback({
        tone: 'error',
        title: '프로젝트 삭제 실패',
        message: '프로젝트를 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.',
      });
    } finally {
      setIsDeleting(false);
      setPendingDeleteProject(null);
    }
  };

  const handleChangeStatus = async (id: string, newStatus: ProjectStatus) => {
    const project = projects.find((item) => item.id === id);
    if (!project) return;
    try {
      await changeStatus(project, newStatus);
      showFeedback({
        tone: 'success',
        title: '상태 고정 완료',
        message: `"${project.name}" 프로젝트 상태를 "${PROJECT_STATUS_LABELS[newStatus]}"로 변경했습니다.`,
      });
    } catch (error) {
      console.error('Failed to change project status:', error);
      showFeedback({
        tone: 'error',
        title: '상태 변경 실패',
        message: '프로젝트 상태를 변경하지 못했습니다.',
      });
    }
    setMenuOpenId(null);
  };

  return (
    <div className="space-y-8">
      {feedback && (
        <FeedbackNotice
          tone={feedback.tone}
          title={feedback.title}
          message={feedback.message}
          onClose={clearFeedback}
        />
      )}

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="app-panel-dark relative min-h-[320px] overflow-hidden p-6 md:p-8 lg:min-h-[360px]">
          <div className="pointer-events-none absolute right-[-4rem] top-[-6rem] h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.16),transparent_70%)] blur-3xl" />
          <div className="pointer-events-none absolute bottom-[-6rem] left-[10%] h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(255,190,120,0.14),transparent_72%)] blur-3xl" />
          <div className="pointer-events-none absolute right-[22%] top-[25%] h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(15,118,110,0.14),transparent_70%)] blur-3xl" />

          {/* ---- Floating decorative elements (right side) — 프로젝트 라이브러리 테마 ---- */}
          <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden="true">
            {/* Stat bubbles */}
            <div
              className="pointer-events-none absolute flex flex-col items-center justify-center rounded-[20px] border border-white/[0.1] bg-white/[0.07] backdrop-blur-md hero-float-1 h-[76px] w-[76px]"
              style={{ top: '8%', right: '10%' }}
            >
              <span className="text-2xl font-bold text-white/90">{projects.length}</span>
              <span className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-white/50">total</span>
            </div>
            <div
              className="pointer-events-none absolute flex flex-col items-center justify-center rounded-[20px] border border-white/[0.1] bg-white/[0.07] backdrop-blur-md hero-float-3 h-[68px] w-[68px]"
              style={{ top: '38%', right: '5%' }}
            >
              <span className="text-2xl font-bold text-white/90">{projects.filter(p => p.status === 'active').length}</span>
              <span className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-white/50">active</span>
            </div>
            <div
              className="pointer-events-none absolute flex flex-col items-center justify-center rounded-[20px] border border-white/[0.1] bg-white/[0.07] backdrop-blur-md hero-float-2 h-[64px] w-[64px]"
              style={{ top: '20%', right: '25%' }}
            >
              <span className="text-2xl font-bold text-white/90">✓</span>
            </div>

            {/* Mini project card */}
            <div
              className="hero-float-2 pointer-events-none absolute rounded-2xl border border-white/[0.12] bg-white/[0.08] backdrop-blur-md"
              style={{ top: '66%', right: '6%', width: '136px', padding: '10px 12px' }}
            >
              <div className="mb-2 flex items-center gap-1.5">
                <FolderKanban className="h-3 w-3 text-teal-400/60" />
                <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/50">프로젝트</span>
              </div>
              <div className="space-y-1.5">
                <div className="h-1 w-full rounded-full bg-white/15" />
                <div className="h-1 w-[80%] rounded-full bg-teal-400/20" />
                <div className="h-1 w-[60%] rounded-full bg-white/8" />
              </div>
            </div>

            {/* Icon elements */}
            <div className="pointer-events-none absolute flex items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.06] backdrop-blur-sm hero-float-4 h-11 w-11" style={{ top: '5%', right: '22%' }}>
              <FolderOpen className="h-5 w-5 text-amber-400/50" />
            </div>
            <div className="pointer-events-none absolute flex items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.06] backdrop-blur-sm hero-float-2 h-10 w-10" style={{ top: '54%', right: '12%' }}>
              <Layers className="h-4.5 w-4.5 text-teal-400/50" />
            </div>
            <div className="pointer-events-none absolute flex items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.06] backdrop-blur-sm hero-float-1 h-10 w-10" style={{ top: '60%', right: '24%' }}>
              <GitBranch className="h-4.5 w-4.5 text-white/30" />
            </div>
            <div className="pointer-events-none absolute flex items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.06] backdrop-blur-sm hero-float-3 h-9 w-9" style={{ top: '30%', right: '3%' }}>
              <Target className="h-4 w-4 text-orange-400/40" />
            </div>
            <div className="pointer-events-none absolute flex items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.06] backdrop-blur-sm hero-float-4 h-10 w-10" style={{ top: '48%', right: '30%' }}>
              <BarChart3 className="h-4.5 w-4.5 text-teal-300/45" />
            </div>
            <div className="pointer-events-none absolute flex items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.06] backdrop-blur-sm hero-float-1 h-9 w-9" style={{ top: '78%', right: '18%' }}>
              <Users className="h-4 w-4 text-white/30" />
            </div>
            <div className="pointer-events-none absolute flex items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.06] backdrop-blur-sm hero-float-2 h-11 w-11" style={{ top: '12%', right: '38%' }}>
              <Calendar className="h-5 w-5 text-amber-400/40" />
            </div>
            <div className="pointer-events-none absolute flex items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.06] backdrop-blur-sm hero-float-3 h-9 w-9" style={{ top: '74%', right: '34%' }}>
              <Bookmark className="h-4 w-4 text-teal-300/40" />
            </div>

            {/* Decorative lines */}
            <div className="absolute h-px w-16 bg-gradient-to-r from-transparent via-white/10 to-transparent hero-float-2" style={{ top: '26%', right: '15%', transform: 'rotate(-20deg)' }} />
            <div className="absolute h-px w-20 bg-gradient-to-r from-transparent via-teal-400/10 to-transparent hero-float-3" style={{ top: '50%', right: '18%', transform: 'rotate(15deg)' }} />
            <div className="absolute h-px w-14 bg-gradient-to-r from-transparent via-amber-400/10 to-transparent hero-float-1" style={{ top: '70%', right: '28%', transform: 'rotate(-10deg)' }} />

            {/* Decorative dots */}
            <div className="absolute h-1.5 w-1.5 rounded-full bg-white/20 hero-float-1" style={{ top: '44%', right: '14%' }} />
            <div className="absolute h-1 w-1 rounded-full bg-teal-400/30 hero-float-4" style={{ top: '35%', right: '20%' }} />
            <div className="absolute h-1 w-1 rounded-full bg-amber-400/30 hero-float-2" style={{ top: '58%', right: '8%' }} />
            <div className="absolute h-1.5 w-1.5 rounded-full bg-orange-400/25 hero-float-3" style={{ top: '16%', right: '6%' }} />
          </div>

          <div className="relative z-10 max-w-2xl">
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
              {canCreateProject && (
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
          {projects.length === 0 ? (
            <>
              {(['Preparing', 'Active', 'Completed'] as const).map((label) => (
                <div key={label} className="metric-card animate-pulse p-6">
                  <p className="eyebrow-stat">{label}</p>
                  <div className="mt-3 h-10 w-12 rounded-lg bg-[color:var(--bg-tertiary)]" />
                  <div className="mt-2 h-4 w-24 rounded bg-[color:var(--bg-tertiary)]" />
                </div>
              ))}
            </>
          ) : (
            <>
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
            </>
          )}
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
          {canCreateProject && (
            <Button variant="outline" onClick={() => setShowCreateModal(true)} data-testid="projects-open-create-button">
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
                          <h3 className="mt-3 truncate text-lg font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]" title={project.name}>
                            {project.name}
                          </h3>
                          <p className="mt-1 line-clamp-2 text-sm leading-6 text-[color:var(--text-secondary)]" title={getProjectSummary(project)}>
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
                                onClick={() => handleDeleteProject(project)}
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
            {!searchQuery && canCreateProject && (
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
              data-testid="projects-create-name"
              className="field-input"
              placeholder="예: 통합 운영 대시보드 고도화"
              maxLength={100}
              autoFocus
            />
            <div className="mt-1.5 flex items-center justify-between">
              <div>
                {newProject.name.length > 0 && !newProject.name.trim() && (
                  <p className="text-xs text-[color:var(--accent-danger)]">프로젝트명을 입력해주세요.</p>
                )}
                {nameError && (
                  <p className="text-xs text-[color:var(--accent-danger)]">{nameError}</p>
                )}
              </div>
              {newProject.name.length >= 80 && (
                <p className="text-xs text-[color:var(--text-muted)]">{newProject.name.length}/100자</p>
              )}
            </div>
          </div>

          <div>
            <label className="field-label">설명</label>
            <textarea
              value={newProject.description}
              onChange={(event) => setNewProject({ ...newProject, description: event.target.value })}
              data-testid="projects-create-description"
              className="field-textarea"
              rows={4}
              placeholder="프로젝트 목적, 범위, 전달 포인트를 간단히 적어주세요"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="field-label">시작 방식</label>
              <select
                value={newProject.creationMode}
                onChange={(event) =>
                  setNewProject({
                    ...newProject,
                    creationMode: event.target.value,
                    sourceProjectId: event.target.value === 'clone' ? newProject.sourceProjectId : '',
                  })
                }
                className="field-select"
              >
                <option value="blank">빈 프로젝트</option>
                <option value="clone">기존 프로젝트 복제</option>
              </select>
            </div>

            <div>
              <label className="field-label">복제 원본</label>
              <select
                value={newProject.sourceProjectId}
                onChange={(event) => setNewProject({ ...newProject, sourceProjectId: event.target.value })}
                className="field-select"
                disabled={newProject.creationMode !== 'clone'}
              >
                <option value="">원본 프로젝트 선택</option>
                {reusableProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
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
            {dateError && (
              <p className="mt-1.5 text-xs text-[color:var(--accent-danger)]">{dateError}</p>
            )}
          </div>

          {newProject.creationMode === 'clone' && (
            <p className="text-sm leading-6 text-[color:var(--text-secondary)]">
              복제를 선택하면 기존 WBS와 멤버 구성을 새 프로젝트로 복사하고, 진행 상태와 실적은 초기화합니다.
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
              취소
            </Button>
            <Button
              onClick={() => void handleCreateProject()}
              disabled={isCreateDisabled}
              data-testid="projects-create-submit"
            >
              {isCreating ? <><Loader2 className="w-4 h-4 animate-spin" /> 생성 중...</> : getCreateButtonText()}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={Boolean(pendingDeleteProject)}
        onClose={() => setPendingDeleteProject(null)}
        onConfirm={() => void confirmDeleteProject()}
        title="프로젝트 삭제"
        description={
          pendingDeleteProject
            ? `"${pendingDeleteProject.name}" 프로젝트와 관련 데이터가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`
            : ''
        }
        confirmLabel="프로젝트 삭제"
        confirmVariant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
