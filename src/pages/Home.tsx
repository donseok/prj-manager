import { Link } from 'react-router-dom';
import {
  Plus,
  FolderOpen,
  BarChart3,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Clock3,
  Layers3,
} from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import Button from '../components/common/Button';

export default function Home() {
  const { projects } = useProjectStore();

  const recentProjects = projects.slice(0, 4);
  const activeProjects = projects.filter((project) => project.status === 'active').length;
  const completedProjects = projects.filter((project) => project.status === 'completed').length;

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
        <div className="app-panel-dark relative overflow-hidden p-7 md:p-10">
          <div className="pointer-events-none absolute right-[-6rem] top-[-7rem] h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.18),transparent_70%)] blur-3xl" />
          <div className="pointer-events-none absolute bottom-[-7rem] left-[20%] h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(255,190,120,0.16),transparent_72%)] blur-3xl" />

          <div className="relative">
            <div className="surface-badge border-white/12 bg-white/[0.12] text-white/92">
              <Sparkles className="h-3.5 w-3.5 text-[color:var(--accent-secondary)]" />
              2026 Workspace Edition
            </div>
            <h1 className="mt-6 max-w-3xl text-[clamp(2.5rem,6vw,4.8rem)] font-semibold leading-[0.92] tracking-[-0.06em] text-white">
              세련된 흐름으로
              <br />
              프로젝트를 운영하세요
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/90 md:text-lg">
              WBS, 일정, 멤버 관리 화면을 하나의 톤으로 다시 묶었습니다. 빠르게 훑어봐도
              구조가 보이고, 오래 봐도 지루하지 않은 운영용 인터페이스를 목표로 했습니다.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/projects/new">
                <Button className="min-w-[10rem]">
                  <Plus className="w-4 h-4" />
                  새 프로젝트 시작
                </Button>
              </Link>
              <Link to="/projects">
                <Button variant="outline" className="border-white/12 bg-white/[0.12] text-white hover:bg-white/[0.18]">
                  전체 프로젝트
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              <div className="rounded-[24px] border border-white/12 bg-white/[0.1] p-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/74">전체 프로젝트</p>
                <p className="mt-2 text-3xl font-semibold text-white">{projects.length}</p>
                <p className="mt-1 text-sm text-white/84">준비·진행·완료 프로젝트 전체 수</p>
              </div>
              <div className="rounded-[24px] border border-white/12 bg-white/[0.1] p-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/74">진행중</p>
                <p className="mt-2 text-3xl font-semibold text-white">{activeProjects}</p>
                <p className="mt-1 text-sm text-white/84">현재 작업이 이어지고 있는 프로젝트</p>
              </div>
              <div className="rounded-[24px] border border-white/12 bg-white/[0.1] p-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/74">최근 기록</p>
                <p className="mt-2 text-3xl font-semibold text-white">{recentProjects.length}</p>
                <p className="mt-1 text-sm text-white/84">빠르게 다시 열 수 있는 최근 워크스페이스</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-1">
          <div className="metric-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="eyebrow-stat">Active Ratio</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
                  {projects.length > 0 ? Math.round((activeProjects / projects.length) * 100) : 0}%
                </h2>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[image:var(--gradient-primary)] text-white shadow-[0_20px_42px_-24px_rgba(15,118,110,0.72)]">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-[color:var(--text-secondary)]">
              진행 상태의 프로젝트 비중을 바로 확인할 수 있도록 홈에서도 운영 밀도를 드러냈습니다.
            </p>
          </div>

          <div className="app-panel p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="eyebrow-stat">Completed</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
                  {completedProjects}
                </h2>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#2fa67c,#34c997)] text-white shadow-[0_20px_42px_-24px_rgba(47,166,124,0.68)]">
                <Layers3 className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-[color:var(--text-secondary)]">
              완료된 프로젝트의 실적을 언제든 다시 조회할 수 있습니다.
            </p>
          </div>

          <div className="app-panel p-6">
            <p className="eyebrow-stat">Quick Access</p>
            <div className="mt-4 space-y-3">
              {recentProjects.length > 0 ? (
                recentProjects.slice(0, 3).map((project) => (
                  <Link
                    key={project.id}
                    to={`/projects/${project.id}`}
                    className="flex items-center justify-between rounded-[22px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-4 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:bg-[color:var(--bg-tertiary)]"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[color:var(--text-primary)]">{project.name}</p>
                      <p className="mt-1 text-xs text-[color:var(--text-muted)]">{project.startDate || '시작일 미정'}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-[color:var(--text-muted)]" />
                  </Link>
                ))
              ) : (
                <div className="rounded-[22px] border border-dashed border-[var(--border-color)] px-4 py-6 text-center text-sm text-[color:var(--text-secondary)]">
                  최근 프로젝트가 없습니다
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Link to="/projects/new" className="metric-card p-6 transition-transform duration-300 hover:-translate-y-1">
          <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-[image:var(--gradient-primary)] text-white shadow-[0_24px_48px_-28px_rgba(15,118,110,0.78)]">
            <Plus className="h-6 w-6" />
          </div>
          <h3 className="mt-6 text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">새 프로젝트</h3>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">
            새 프로젝트의 기본 정보부터 설정하고 바로 대시보드로 진입합니다.
          </p>
        </Link>

        <Link to="/projects" className="metric-card p-6 transition-transform duration-300 hover:-translate-y-1">
          <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-[linear-gradient(135deg,#f2be83,#cb6d37)] text-[color:var(--bg-inverse)] shadow-[0_24px_48px_-28px_rgba(203,109,55,0.72)]">
            <FolderOpen className="h-6 w-6" />
          </div>
          <h3 className="mt-6 text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">프로젝트 라이브러리</h3>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">
            모든 프로젝트를 카드 뷰로 확인하고 상태별로 빠르게 접근할 수 있습니다.
          </p>
        </Link>

        <div className="metric-card p-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-[linear-gradient(135deg,#123d64,#23547b)] text-white shadow-[0_24px_48px_-28px_rgba(18,61,100,0.72)]">
            <BarChart3 className="h-6 w-6" />
          </div>
          <h3 className="mt-6 text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">운영 중심 대시보드</h3>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">
            단순 카드 나열 대신 핵심 지표와 작업 흐름을 중심으로 읽히도록 레이아웃을 재구성했습니다.
          </p>
        </div>
      </section>

      <section className="app-panel overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-[var(--border-color)] px-6 py-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="page-kicker">Recent Workspace</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
              최근 프로젝트
            </h2>
            <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">
              방금 작업하던 흐름으로 다시 돌아갈 수 있도록 최근 프로젝트 접근성을 높였습니다.
            </p>
          </div>
          <Link
            to="/projects"
            className="inline-flex items-center gap-2 text-sm font-medium text-[color:var(--accent-primary)] transition-transform hover:translate-x-0.5"
          >
            전체 보기
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {recentProjects.length > 0 ? (
          <div className="grid gap-4 p-6 md:grid-cols-2">
            {recentProjects.map((project) => (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="group rounded-[24px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-5 transition-all duration-200 hover:-translate-y-1 hover:bg-[color:var(--bg-tertiary)] hover:shadow-[0_28px_60px_-34px_rgba(17,24,39,0.26)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="surface-badge">
                      <Clock3 className="h-3.5 w-3.5 text-[color:var(--accent-secondary)]" />
                      최근 접근
                    </div>
                    <h3 className="mt-4 truncate text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">
                      {project.name}
                    </h3>
                    <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
                      {project.startDate || '시작일 미정'} {project.endDate ? `~ ${project.endDate}` : '~ 진행중'}
                    </p>
                  </div>
                  <span className="rounded-full border border-[var(--border-color)] px-3 py-1 text-xs font-semibold text-[color:var(--text-secondary)]">
                    {project.status === 'active' ? '진행중' : project.status === 'completed' ? '완료' : project.status === 'preparing' ? '준비' : '삭제'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state px-6 py-12">
            <FolderOpen className="h-12 w-12 text-[color:var(--text-muted)]" />
            <h3 className="text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">
              아직 프로젝트가 없습니다
            </h3>
            <p className="max-w-md text-sm leading-6 text-[color:var(--text-secondary)]">
              첫 프로젝트를 생성하면 홈 화면의 최근 워크스페이스 영역도 함께 활성화됩니다.
            </p>
            <Link to="/projects/new">
              <Button>
                <Plus className="w-4 h-4" />
                첫 프로젝트 만들기
              </Button>
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
