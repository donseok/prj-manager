import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  FolderOpen,
  MoreVertical,
  Trash2,
  Archive,
  Search,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { useAuthStore } from '../store/authStore';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import { generateId } from '../lib/utils';
import { createLocalFallbackUser } from '../lib/supabase';
import { deleteProjectById, syncProjectMembers, upsertProject } from '../lib/dataRepository';
import type { Project, ProjectMember } from '../types';

export default function ProjectList() {
  const navigate = useNavigate();
  const { projects, addProject, deleteProject, updateProject } = useProjectStore();
  const { user } = useAuthStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
  });

  const filteredProjects = projects.filter(
    (project) =>
      project.status !== 'deleted' &&
      project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeProjects = projects.filter((project) => project.status === 'active').length;
  const archivedProjects = projects.filter((project) => project.status === 'archived').length;

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
      status: 'active',
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

  const handleArchiveProject = async (id: string) => {
    const project = projects.find((item) => item.id === id);
    if (!project) return;

    const savedProject = await upsertProject({
      ...project,
      status: 'archived',
      updatedAt: new Date().toISOString(),
    });

    updateProject(id, {
      status: savedProject.status,
      updatedAt: savedProject.updatedAt,
    });
    setMenuOpenId(null);
  };

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="app-panel-dark relative overflow-hidden p-7 md:p-8">
          <div className="pointer-events-none absolute right-[-4rem] top-[-6rem] h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.16),transparent_70%)] blur-3xl" />
          <div className="relative">
            <div className="surface-badge border-white/10 bg-white/[0.06] text-white/72">
              <Sparkles className="h-3.5 w-3.5 text-[color:var(--accent-secondary)]" />
              Project Library
            </div>
            <h1 className="mt-5 text-[clamp(2rem,4vw,3.8rem)] font-semibold tracking-[-0.06em] text-white">
              프로젝트를 한곳에서
              <br />
              선명하게 관리합니다
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70 md:text-base">
              검색, 상태, 최근성까지 한 번에 읽히는 카드 뷰로 재구성했습니다. 프로젝트 생성 모달도
              같은 시각 언어로 맞춰 워크플로우가 끊기지 않도록 정리했습니다.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4" />
                새 프로젝트
              </Button>
              <Link to="/">
                <Button variant="outline" className="border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.1]">
                  홈으로
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1">
          <div className="metric-card p-6">
            <p className="eyebrow-stat">Total</p>
            <p className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[color:var(--text-primary)]">
              {projects.length}
            </p>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">전체 프로젝트 수</p>
          </div>
          <div className="metric-card p-6">
            <p className="eyebrow-stat">Active</p>
            <p className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[color:var(--text-primary)]">
              {activeProjects}
            </p>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">현재 운영 중</p>
          </div>
          <div className="metric-card p-6">
            <p className="eyebrow-stat">Archived</p>
            <p className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[color:var(--text-primary)]">
              {archivedProjects}
            </p>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">보관된 프로젝트</p>
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
          <Button variant="outline" onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4" />
            새 프로젝트
          </Button>
        </div>

        <div className="mt-5 relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--text-muted)]" />
          <input
            type="text"
            placeholder="프로젝트 이름으로 검색"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="field-input pl-12"
          />
        </div>
      </section>

      {filteredProjects.length > 0 ? (
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="metric-card group p-5 transition-all duration-300 hover:-translate-y-1"
            >
              <div className="absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--accent-primary),transparent)] opacity-55" />

              <div className="relative">
                <div className="flex items-start justify-between gap-3">
                  <Link to={`/projects/${project.id}`} className="min-w-0 flex-1">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-[image:var(--gradient-primary)] text-white shadow-[0_24px_48px_-28px_rgba(15,118,110,0.72)]">
                        <FolderOpen className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">
                          {project.name}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-[color:var(--text-secondary)]">
                          {project.description || '프로젝트 설명이 아직 없습니다.'}
                        </p>
                      </div>
                    </div>
                  </Link>

                  <div className="relative">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        setMenuOpenId(menuOpenId === project.id ? null : project.id);
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-color)] bg-white/50 text-[color:var(--text-secondary)] transition-all duration-200 hover:bg-white/82 hover:text-[color:var(--text-primary)] dark:bg-white/5 dark:hover:bg-white/8"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>

                    {menuOpenId === project.id && (
                      <div className="absolute right-0 top-full z-10 mt-2 w-40 overflow-hidden rounded-[20px] border border-[var(--border-color)] bg-[image:var(--gradient-surface)] p-1.5 shadow-[0_26px_64px_-38px_rgba(0,0,0,0.48)] backdrop-blur-2xl dark:bg-[image:var(--gradient-dark)]">
                        <button
                          onClick={() => handleArchiveProject(project.id)}
                          className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-[color:var(--text-primary)] transition-colors hover:bg-black/5 dark:hover:bg-white/6"
                        >
                          <Archive className="w-4 h-4" />
                          보관
                        </button>
                        <button
                          onClick={() => handleDeleteProject(project.id)}
                          className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-[color:var(--accent-danger)] transition-colors hover:bg-[rgba(203,75,95,0.08)]"
                        >
                          <Trash2 className="w-4 h-4" />
                          삭제
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <Link to={`/projects/${project.id}`} className="mt-5 block">
                  <div className="rounded-[22px] border border-[var(--border-color)] bg-white/45 p-4 dark:bg-white/5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[color:var(--text-secondary)]">
                        {project.startDate || '시작일 미정'}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          project.status === 'active'
                            ? 'bg-[rgba(15,118,110,0.12)] text-[color:var(--accent-primary)]'
                            : 'bg-black/5 text-[color:var(--text-secondary)] dark:bg-white/8'
                        }`}
                      >
                        {project.status === 'active' ? '진행중' : '보관됨'}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-sm font-medium text-[color:var(--text-primary)]">프로젝트 열기</p>
                      <ArrowRight className="h-4 w-4 text-[color:var(--text-muted)] transition-transform duration-200 group-hover:translate-x-1" />
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          ))}
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
            {!searchQuery && (
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
