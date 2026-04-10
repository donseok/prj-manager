import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  FolderOpen,
  BarChart3,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Clock3,
  Layers3,
  Settings,
  Lightbulb,
  GitBranch,
  Target,
  Workflow,
  Zap,
  PieChart,
  Users,
} from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { useThemeStore } from '../store/themeStore';
import Button from '../components/common/Button';
import { PROJECT_STATUS_COLORS, PROJECT_STATUS_LABELS } from '../types';
import {
  getProjectCardBackground,
  getProjectSummary,
  getProjectTimeline,
  getProjectVisualTone,
} from '../lib/projectVisuals';

/* ------------------------------------------------------------------ */
/*  Floating decorative element component                              */
/* ------------------------------------------------------------------ */
function FloatingElement({
  children,
  className = '',
  style = {},
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`pointer-events-none absolute flex items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.06] backdrop-blur-sm ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Floating stat bubble component                                     */
/* ------------------------------------------------------------------ */
function FloatingStatBubble({
  value,
  label,
  className = '',
  style = {},
}: {
  value: string;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`pointer-events-none absolute flex flex-col items-center justify-center rounded-[20px] border border-white/[0.1] bg-white/[0.07] backdrop-blur-md ${className}`}
      style={style}
    >
      <span className="text-2xl font-bold text-white/90">{value}</span>
      {label && <span className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-white/50">{label}</span>}
    </div>
  );
}

export default function Home() {
  const { t } = useTranslation();
  const { projects } = useProjectStore();
  const { isDark } = useThemeStore();

  const recentProjects = projects.slice(0, 4);
  const activeProjects = projects.filter((project) => project.status === 'active').length;
  const completedProjects = projects.filter((project) => project.status === 'completed').length;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-8">
      {/* ============================================================ */}
      {/*  HERO — full width immersive panel                           */}
      {/* ============================================================ */}
      <section>
        <div className="app-panel-dark relative min-h-[520px] overflow-hidden p-6 md:p-10 lg:p-12">
          {/* Background ambient glows */}
          <div className="pointer-events-none absolute right-[-8rem] top-[-8rem] h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.14),transparent_70%)] blur-3xl" />
          <div className="pointer-events-none absolute bottom-[-8rem] left-[15%] h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(255,190,120,0.12),transparent_72%)] blur-3xl" />
          <div className="pointer-events-none absolute right-[20%] top-[30%] h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(15,118,110,0.18),transparent_70%)] blur-3xl" />

          {/* ---- Floating decorative elements (right side) ---- */}
          <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden="true">
            {/* Stat bubbles */}
            <FloatingStatBubble
              value="29"
              label="tasks"
              className="hero-float-1 h-[72px] w-[72px]"
              style={{ top: '8%', right: '12%' }}
            />
            <FloatingStatBubble
              value="11"
              label="done"
              className="hero-float-2 h-[64px] w-[64px]"
              style={{ top: '38%', right: '6%' }}
            />
            <FloatingStatBubble
              value="58"
              label="%"
              className="hero-float-3 h-[76px] w-[76px]"
              style={{ top: '18%', right: '26%' }}
            />

            {/* Icon elements */}
            <FloatingElement
              className="hero-float-4 h-11 w-11"
              style={{ top: '5%', right: '22%' }}
            >
              <Settings className="h-5 w-5 text-white/40 hero-spin-slow" />
            </FloatingElement>
            <FloatingElement
              className="hero-float-2 h-10 w-10"
              style={{ top: '55%', right: '10%' }}
            >
              <Lightbulb className="h-4.5 w-4.5 text-amber-400/50" />
            </FloatingElement>
            <FloatingElement
              className="hero-float-1 h-10 w-10"
              style={{ top: '62%', right: '22%' }}
            >
              <BarChart3 className="h-4.5 w-4.5 text-teal-400/50" />
            </FloatingElement>
            <FloatingElement
              className="hero-float-3 h-9 w-9"
              style={{ top: '30%', right: '3%' }}
            >
              <GitBranch className="h-4 w-4 text-white/30" />
            </FloatingElement>
            <FloatingElement
              className="hero-float-4 h-10 w-10"
              style={{ top: '48%', right: '28%' }}
            >
              <Target className="h-4.5 w-4.5 text-orange-400/40" />
            </FloatingElement>
            <FloatingElement
              className="hero-float-2 h-9 w-9"
              style={{ top: '72%', right: '16%' }}
            >
              <Workflow className="h-4 w-4 text-white/30" />
            </FloatingElement>
            <FloatingElement
              className="hero-float-1 h-11 w-11"
              style={{ top: '12%', right: '38%' }}
            >
              <Zap className="h-5 w-5 text-yellow-400/40" />
            </FloatingElement>
            <FloatingElement
              className="hero-float-3 h-9 w-9"
              style={{ top: '68%', right: '32%' }}
            >
              <PieChart className="h-4 w-4 text-teal-300/40" />
            </FloatingElement>
            <FloatingElement
              className="hero-float-4 h-10 w-10"
              style={{ top: '78%', right: '5%' }}
            >
              <Users className="h-4.5 w-4.5 text-white/30" />
            </FloatingElement>

            {/* Decorative connecting lines / dots */}
            <div
              className="absolute h-px w-16 bg-gradient-to-r from-transparent via-white/10 to-transparent hero-float-2"
              style={{ top: '25%', right: '15%', transform: 'rotate(-20deg)' }}
            />
            <div
              className="absolute h-px w-20 bg-gradient-to-r from-transparent via-white/8 to-transparent hero-float-3"
              style={{ top: '50%', right: '18%', transform: 'rotate(15deg)' }}
            />
            <div
              className="absolute h-1.5 w-1.5 rounded-full bg-white/20 hero-float-1"
              style={{ top: '44%', right: '14%' }}
            />
            <div
              className="absolute h-1 w-1 rounded-full bg-teal-400/30 hero-float-4"
              style={{ top: '35%', right: '20%' }}
            />
          </div>

          {/* ---- Main content ---- */}
          <div className="relative z-10 max-w-2xl">
            <div className="surface-badge border-white/12 bg-white/[0.12] text-white/92">
              <Sparkles className="h-3.5 w-3.5 text-[color:var(--accent-secondary)]" />
              2026 Workspace Edition
            </div>

            <h1 className="mt-7 text-[clamp(2.6rem,5.8vw,4.8rem)] font-semibold leading-[0.92] tracking-[-0.06em] text-white">
              {t('home.heroTitle1')}{' '}
              <br className="hidden sm:block" />
              {t('home.heroTitle2')}
            </h1>

            <p className="mt-5 max-w-xl text-base leading-7 text-white/88 md:text-lg">
              {t('home.heroDescription')}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/projects/new">
                <Button className="min-w-[10rem]">
                  <Plus className="w-4 h-4" />
                  {t('home.newProjectStart')}
                </Button>
              </Link>
              <Link to="/projects">
                <Button
                  variant="outline"
                  className="border-white/12 bg-white/[0.12] text-white hover:bg-white/[0.18]"
                >
                  {t('home.allProjects')}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>

          {/* ---- 3 stat cards (inside hero, bottom area) ---- */}
          <div className="relative z-10 mt-10 grid gap-4 md:grid-cols-3">
              <div className="rounded-[24px] border border-white/12 bg-white/[0.08] backdrop-blur-sm p-4 transition-transform duration-300 hover:scale-[1.02]">
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/80">{t('home.totalProjects')}</p>
                <p className="mt-2 text-3xl font-semibold text-white">{projects.length}</p>
                <p className="mt-1 text-sm text-white/70">{t('home.totalProjectsDesc')}</p>
              </div>
              <div className="rounded-[24px] border border-white/12 bg-white/[0.08] backdrop-blur-sm p-4 transition-transform duration-300 hover:scale-[1.02]">
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/80">{t('home.inProgress')}</p>
                <p className="mt-2 text-3xl font-semibold text-white">{activeProjects}</p>
                <p className="mt-1 text-sm text-white/70">{t('home.inProgressDesc')}</p>
              </div>
              <div className="rounded-[24px] border border-white/12 bg-white/[0.08] backdrop-blur-sm p-4 transition-transform duration-300 hover:scale-[1.02]">
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/80">{t('home.recentRecords')}</p>
                <p className="mt-2 text-3xl font-semibold text-white">{recentProjects.length}</p>
                <p className="mt-1 text-sm text-white/70">{t('home.recentRecordsDesc')}</p>
              </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  Metric cards row — Active Ratio, Completed, Quick Access     */}
      {/* ============================================================ */}
      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
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
            {t('home.activeRatioDesc')}
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
            {t('home.completedDesc')}
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
                    <p className="truncate font-medium text-[color:var(--text-primary)]" title={project.name}>{project.name}</p>
                    <p className="mt-1 text-xs text-[color:var(--text-muted)]">{project.startDate || t('home.startDatePending')}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-[color:var(--text-muted)]" />
                </Link>
              ))
            ) : (
              <div className="rounded-[22px] border border-dashed border-[var(--border-color)] px-4 py-6 text-center text-sm text-[color:var(--text-secondary)]">
                {t('home.noRecentProjects')}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  Action cards row                                             */}
      {/* ============================================================ */}
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Link to="/projects/new" className="metric-card p-6 transition-transform duration-300 hover:-translate-y-1">
          <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-[image:var(--gradient-primary)] text-white shadow-[0_24px_48px_-28px_rgba(15,118,110,0.78)]">
            <Plus className="h-6 w-6" />
          </div>
          <h3 className="mt-6 text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">{t('home.newProject')}</h3>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">
            {t('home.newProjectDesc')}
          </p>
        </Link>

        <Link to="/projects" className="metric-card p-6 transition-transform duration-300 hover:-translate-y-1">
          <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-[linear-gradient(135deg,#f2be83,#cb6d37)] text-[color:var(--bg-inverse)] shadow-[0_24px_48px_-28px_rgba(203,109,55,0.72)]">
            <FolderOpen className="h-6 w-6" />
          </div>
          <h3 className="mt-6 text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">{t('home.projectLibrary')}</h3>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">
            {t('home.projectLibraryDesc')}
          </p>
        </Link>

        <div className="metric-card p-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-[linear-gradient(135deg,#123d64,#23547b)] text-white shadow-[0_24px_48px_-28px_rgba(18,61,100,0.72)]">
            <BarChart3 className="h-6 w-6" />
          </div>
          <h3 className="mt-6 text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">{t('home.operationDashboard')}</h3>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">
            {t('home.operationDashboardDesc')}
          </p>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  Recent projects section (unchanged)                          */}
      {/* ============================================================ */}
      <section className="app-panel overflow-hidden">
        <div className="relative flex flex-col gap-4 border-b border-[var(--border-color)] px-6 py-6 md:flex-row md:items-end md:justify-between">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(15,118,110,0.08),transparent)] dark:bg-[linear-gradient(180deg,rgba(15,118,110,0.12),transparent)]" />
          <div>
            <p className="page-kicker">Recent Workspace</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
              {t('home.recentProjects')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">
              {t('home.recentProjectsDesc')}
            </p>
          </div>
          <Link
            to="/projects"
            className="inline-flex items-center gap-2 text-sm font-medium text-[color:var(--accent-primary)] transition-transform hover:translate-x-0.5"
          >
            {t('common.viewAll')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {recentProjects.length > 0 ? (
          <div className="grid gap-4 p-6 md:grid-cols-2">
            {recentProjects.map((project) => {
              const tone = getProjectVisualTone(project);
              const ToneIcon = tone.icon;

              return (
                <Link
                  key={project.id}
                  to={`/projects/${project.id}`}
                  className="group relative overflow-hidden rounded-[24px] border border-[var(--border-color)] p-5 transition-all duration-200 hover:-translate-y-1 hover:border-[var(--border-strong)] hover:shadow-[0_28px_60px_-34px_rgba(17,24,39,0.26)]"
                  style={{ backgroundImage: getProjectCardBackground(project, isDark) }}
                >
                  <div className="pointer-events-none absolute inset-x-5 top-0 h-px opacity-90" style={{ backgroundColor: tone.accent }} />
                  <div
                    className="pointer-events-none absolute -right-8 top-[-2.5rem] h-28 w-28 rounded-full blur-3xl opacity-80"
                    style={{ backgroundColor: `${tone.accent}22` }}
                  />
                  <div className="pointer-events-none absolute bottom-5 right-5 h-16 w-16 rounded-full border opacity-60" style={{ borderColor: `${tone.accent}26` }} />

                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="surface-badge border-[var(--border-strong)] bg-white/78 dark:bg-white/10">
                          <Clock3 className="h-3.5 w-3.5 text-[color:var(--accent-secondary)]" />
                          {t('home.recentWork')}
                        </div>
                        <div
                          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.16em] uppercase"
                          style={{
                            borderColor: `${tone.accent}24`,
                            backgroundColor: `${tone.accent}12`,
                            color: tone.accent,
                          }}
                        >
                          <ToneIcon className="h-3.5 w-3.5" />
                          {tone.label}
                        </div>
                      </div>
                      <h3 className="mt-4 truncate text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]" title={project.name}>
                        {project.name}
                      </h3>
                      <p className="mt-2 line-clamp-1 text-sm text-[color:var(--text-secondary)]" title={getProjectSummary(project)}>
                        {getProjectSummary(project)}
                      </p>
                    </div>
                    <span
                      className="rounded-full border px-3 py-1 text-xs font-semibold"
                      style={{
                        borderColor: `${PROJECT_STATUS_COLORS[project.status]}2e`,
                        backgroundColor: `${PROJECT_STATUS_COLORS[project.status]}14`,
                        color: PROJECT_STATUS_COLORS[project.status],
                      }}
                    >
                      {PROJECT_STATUS_LABELS[project.status]}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                    <div
                      className="rounded-[18px] border px-4 py-3"
                      style={{
                        borderColor: `${tone.accent}20`,
                        backgroundColor: `${tone.accent}0d`,
                      }}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-secondary)]">
                        Schedule
                      </p>
                      <p className="mt-1 text-sm font-medium text-[color:var(--text-primary)]">
                        {getProjectTimeline(project)}
                      </p>
                    </div>
                    <div
                      className="rounded-[18px] border px-4 py-3"
                      style={{
                        borderColor: `${tone.accent}18`,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.66)',
                      }}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-secondary)]">
                        Focus
                      </p>
                      <p className="mt-1 text-sm font-medium" style={{ color: tone.accent }}>
                        {tone.note}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-[16px] shadow-[0_18px_34px_-24px_rgba(17,24,39,0.4)]"
                        style={{
                          background: `linear-gradient(135deg, ${tone.accent}22, ${tone.accent}10)`,
                          color: tone.accent,
                        }}
                      >
                        <FolderOpen className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-medium text-[color:var(--text-secondary)]">{t('home.openWorkspace')}</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-[color:var(--text-secondary)] transition-transform duration-200 group-hover:translate-x-1 group-hover:text-[color:var(--text-primary)]" />
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="empty-state px-6 py-12">
            <FolderOpen className="h-12 w-12 text-[color:var(--text-muted)]" />
            <h3 className="text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">
              {t('home.noProjectsYet')}
            </h3>
            <p className="max-w-md text-sm leading-6 text-[color:var(--text-secondary)]">
              {t('home.noProjectsDesc')}
            </p>
            <Link to="/projects/new">
              <Button>
                <Plus className="w-4 h-4" />
                {t('home.createFirst')}
              </Button>
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
