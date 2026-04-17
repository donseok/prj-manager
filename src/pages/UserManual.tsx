import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  LogIn,
  Home,
  FolderOpen,
  LayoutDashboard,
  ListTree,
  Calendar,
  Users,
  Settings,
  ShieldCheck,
  Palette,
  Keyboard,
  Database,
  BookText,
  HelpCircle,
  ChevronRight,
  Search,
  ArrowUp,
  Bot,
  ClipboardList,
  CalendarCheck,
  UserCog,
  FileText,
  Bookmark,
  GraduationCap,
  ListChecks,
  Info,
  Lightbulb,
  Sparkles,
  Compass,
} from 'lucide-react';

interface Section {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

function SectionCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[24px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-5 md:p-6">
      {title && (
        <h4 className="mb-4 text-lg font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">{title}</h4>
      )}
      {children}
    </div>
  );
}

function InfoTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border-color)]">
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--text-secondary)]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[var(--border-color)] last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-[color:var(--text-primary)]">
                  {j === 0 ? <span className="font-medium">{cell}</span> : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Tip({ children, type = 'info' }: { children: React.ReactNode; type?: 'info' | 'warning' }) {
  const styles = type === 'warning'
    ? 'border-[rgba(203,109,55,0.2)] bg-[rgba(203,109,55,0.06)] text-[color:var(--accent-warning)]'
    : 'border-[rgba(15,118,110,0.2)] bg-[rgba(15,118,110,0.06)] text-[color:var(--accent-primary)]';
  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${styles}`}>
      {type === 'warning' ? '⚠️ ' : '💡 '}{children}
    </div>
  );
}

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[image:var(--gradient-primary)] text-xs font-bold text-white">{i + 1}</span>
          <span className="pt-0.5 text-sm leading-6 text-[color:var(--text-primary)]">{step}</span>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/*  Floating decorative element component (manual hero)               */
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
/*  Floating stat bubble component (manual hero)                       */
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

export default function UserManual() {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState('getting-started');
  const [searchQuery, setSearchQuery] = useState('');

  const s = 'manual.sections';

  const sections: Section[] = [
    {
      id: 'getting-started',
      title: t(`${s}.gettingStarted.title`),
      icon: <LogIn className="h-5 w-5" />,
      content: (
        <div className="space-y-6">
          <SectionCard title={t(`${s}.gettingStarted.systemRequirements`)}>
            <InfoTable
              headers={t(`${s}.gettingStarted.systemTableHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.gettingStarted.systemTableRows`, { returnObjects: true }) as string[][]}
            />
          </SectionCard>
          <SectionCard title={t(`${s}.gettingStarted.login`)}>
            <StepList steps={t(`${s}.gettingStarted.loginSteps`, { returnObjects: true }) as string[]} />
            <div className="mt-4">
              <Tip>{t(`${s}.gettingStarted.loginTip`)}</Tip>
            </div>
          </SectionCard>
          <SectionCard title={t(`${s}.gettingStarted.signup`)}>
            <StepList steps={t(`${s}.gettingStarted.signupSteps`, { returnObjects: true }) as string[]} />
            <div className="mt-4">
              <Tip type="warning">{t(`${s}.gettingStarted.signupTip`)}</Tip>
            </div>
          </SectionCard>
          <SectionCard title={t(`${s}.gettingStarted.operatingMode`)}>
            <InfoTable
              headers={t(`${s}.gettingStarted.operatingModeHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.gettingStarted.operatingModeRows`, { returnObjects: true }) as string[][]}
            />
          </SectionCard>
        </div>
      ),
    },
    {
      id: 'home',
      title: t(`${s}.home.title`),
      icon: <Home className="h-5 w-5" />,
      content: (
        <div className="space-y-6">
          <SectionCard title={t(`${s}.home.heroArea`)}>
            <p className="mb-4 text-sm leading-6 text-[color:var(--text-secondary)]">{t(`${s}.home.heroAreaDesc`)}</p>
            <InfoTable
              headers={t(`${s}.home.heroTableHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.home.heroTableRows`, { returnObjects: true }) as string[][]}
            />
          </SectionCard>
          <SectionCard title={t(`${s}.home.summaryCards`)}>
            <p className="mb-4 text-sm leading-6 text-[color:var(--text-secondary)]">{t(`${s}.home.summaryCardsDesc`)}</p>
            <InfoTable
              headers={t(`${s}.home.summaryTableHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.home.summaryTableRows`, { returnObjects: true }) as string[][]}
            />
          </SectionCard>
          <SectionCard title={t(`${s}.home.metricsPanel`)}>
            <p className="mb-4 text-sm leading-6 text-[color:var(--text-secondary)]">{t(`${s}.home.metricsPanelDesc`)}</p>
            <InfoTable
              headers={t(`${s}.home.metricsTableHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.home.metricsTableRows`, { returnObjects: true }) as string[][]}
            />
          </SectionCard>
          <SectionCard title={t(`${s}.home.quickAccessCards`)}>
            <InfoTable
              headers={t(`${s}.home.quickAccessTableHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.home.quickAccessTableRows`, { returnObjects: true }) as string[][]}
            />
          </SectionCard>
          <SectionCard title={t(`${s}.home.recentProjects`)}>
            <p className="text-sm leading-6 text-[color:var(--text-secondary)]">{t(`${s}.home.recentProjectsDesc`)}</p>
          </SectionCard>
        </div>
      ),
    },
    {
      id: 'project-management',
      title: t(`${s}.projectManagement.title`),
      icon: <FolderOpen className="h-5 w-5" />,
      content: (
        <div className="space-y-6">
          <SectionCard title={t(`${s}.projectManagement.projectList`)}>
            <p className="mb-4 text-sm leading-6 text-[color:var(--text-secondary)]">{t(`${s}.projectManagement.projectListDesc`)}</p>
            <InfoTable
              headers={t(`${s}.projectManagement.projectListHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.projectManagement.projectListRows`, { returnObjects: true }) as string[][]}
            />
          </SectionCard>
          <SectionCard title={t(`${s}.projectManagement.projectCreation`)}>
            <StepList steps={t(`${s}.projectManagement.projectCreationSteps`, { returnObjects: true }) as string[]} />
          </SectionCard>
          <SectionCard title={t(`${s}.projectManagement.projectStatus`)}>
            <InfoTable
              headers={t(`${s}.projectManagement.projectStatusHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.projectManagement.projectStatusRows`, { returnObjects: true }) as string[][]}
            />
            <div className="mt-4"><Tip>{t(`${s}.projectManagement.projectStatusTip`)}</Tip></div>
          </SectionCard>
          <SectionCard title={t(`${s}.projectManagement.projectTheme`)}>
            <p className="mb-4 text-sm leading-6 text-[color:var(--text-secondary)]">{t(`${s}.projectManagement.projectThemeDesc`)}</p>
            <InfoTable
              headers={t(`${s}.projectManagement.projectThemeHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.projectManagement.projectThemeRows`, { returnObjects: true }) as string[][]}
            />
          </SectionCard>
        </div>
      ),
    },
    {
      id: 'dashboard',
      title: t(`${s}.dashboard.title`),
      icon: <LayoutDashboard className="h-5 w-5" />,
      content: (
        <div className="space-y-6">
          <SectionCard title={t(`${s}.dashboard.topStatus`)}>
            <InfoTable
              headers={t(`${s}.dashboard.topStatusHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.dashboard.topStatusRows`, { returnObjects: true }) as string[][]}
            />
          </SectionCard>
          <SectionCard title={t(`${s}.dashboard.chartSection`)}>
            <InfoTable
              headers={t(`${s}.dashboard.chartSectionHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.dashboard.chartSectionRows`, { returnObjects: true }) as string[][]}
            />
          </SectionCard>
          <SectionCard title={t(`${s}.dashboard.taskQueue`)}>
            <InfoTable
              headers={t(`${s}.dashboard.taskQueueHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.dashboard.taskQueueRows`, { returnObjects: true }) as string[][]}
            />
          </SectionCard>
          <SectionCard title={t(`${s}.dashboard.statusReport`)}>
            <p className="mb-4 text-sm leading-6 text-[color:var(--text-secondary)]">{t(`${s}.dashboard.statusReportDesc`)}</p>
            <InfoTable
              headers={t(`${s}.dashboard.statusReportHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.dashboard.statusReportRows`, { returnObjects: true }) as string[][]}
            />
          </SectionCard>
        </div>
      ),
    },
    {
      id: 'wbs',
      title: t(`${s}.wbs.title`),
      icon: <ListTree className="h-5 w-5" />,
      content: (
        <div className="space-y-6">
          <SectionCard title={t(`${s}.wbs.taskHierarchy`)}>
            <InfoTable
              headers={t(`${s}.wbs.taskHierarchyHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.wbs.taskHierarchyRows`, { returnObjects: true }) as string[][]}
            />
            <div className="mt-4"><Tip>{t(`${s}.wbs.taskHierarchyTip`)}</Tip></div>
          </SectionCard>
          <SectionCard title={t(`${s}.wbs.inlineEdit`)}>
            <p className="mb-4 text-sm leading-6 text-[color:var(--text-secondary)]">{t(`${s}.wbs.inlineEditDesc`)}</p>
            <InfoTable
              headers={t(`${s}.wbs.inlineEditHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.wbs.inlineEditRows`, { returnObjects: true }) as string[][]}
            />
          </SectionCard>
          <SectionCard title={t(`${s}.wbs.fieldAutoSync`)}>
            <p className="mb-4 text-sm leading-6 text-[color:var(--text-secondary)]">{t(`${s}.wbs.fieldAutoSyncDesc`)}</p>
            <InfoTable
              headers={t(`${s}.wbs.fieldAutoSyncHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.wbs.fieldAutoSyncRows`, { returnObjects: true }) as string[][]}
            />
          </SectionCard>
          <SectionCard title={t(`${s}.wbs.dragAndDrop`)}>
            <p className="text-sm leading-6 text-[color:var(--text-secondary)]">{t(`${s}.wbs.dragAndDropDesc`)}</p>
          </SectionCard>
          <SectionCard title={t(`${s}.wbs.toolbar`)}>
            <InfoTable
              headers={t(`${s}.wbs.toolbarHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.wbs.toolbarRows`, { returnObjects: true }) as string[][]}
            />
          </SectionCard>
          <SectionCard title={t(`${s}.wbs.draftGeneration`)}>
            <p className="mb-4 text-sm leading-6 text-[color:var(--text-secondary)]">{t(`${s}.wbs.draftGenerationDesc`)}</p>
            <InfoTable
              headers={t(`${s}.wbs.draftGenerationHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.wbs.draftGenerationRows`, { returnObjects: true }) as string[][]}
            />
            <div className="mt-4"><Tip type="warning">{t(`${s}.wbs.draftGenerationTip`)}</Tip></div>
          </SectionCard>
          <SectionCard title={t(`${s}.wbs.weeklyReport`)}>
            <p className="mb-4 text-sm leading-6 text-[color:var(--text-secondary)]">{t(`${s}.wbs.weeklyReportDesc`)}</p>
            <InfoTable
              headers={t(`${s}.wbs.weeklyReportHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.wbs.weeklyReportRows`, { returnObjects: true }) as string[][]}
            />
          </SectionCard>
          <SectionCard title={t(`${s}.wbs.weeklyExport`)}>
            <InfoTable
              headers={t(`${s}.wbs.weeklyExportHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.wbs.weeklyExportRows`, { returnObjects: true }) as string[][]}
            />
            <div className="mt-4"><Tip>{t(`${s}.wbs.weeklyExportTip`)}</Tip></div>
          </SectionCard>
          <SectionCard>
            <div><Tip>{t(`${s}.wbs.snapshotTip`)}</Tip></div>
          </SectionCard>
          <Tip>{t(`${s}.wbs.autoSaveTip`)}</Tip>
          <SectionCard title={t(`${s}.wbs.planProgressAutoCalc`)}>
            <p className="mb-4 text-sm leading-6 text-[color:var(--text-secondary)]">{t(`${s}.wbs.planProgressAutoCalcDesc`)}</p>
            <InfoTable
              headers={t(`${s}.wbs.planProgressAutoCalcHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.wbs.planProgressAutoCalcRows`, { returnObjects: true }) as string[][]}
            />
            <div className="mt-4"><Tip>{t(`${s}.wbs.planProgressAutoCalcTip`)}</Tip></div>
          </SectionCard>
        </div>
      ),
    },
    {
      id: 'gantt',
      title: t(`${s}.gantt.title`),
      icon: <Calendar className="h-5 w-5" />,
      content: (
        <div className="space-y-6">
          <SectionCard title={t(`${s}.gantt.screenLayout`)}>
            <InfoTable
              headers={t(`${s}.gantt.screenLayoutHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.gantt.screenLayoutRows`, { returnObjects: true }) as string[][]}
            />
          </SectionCard>
          <SectionCard title={t(`${s}.gantt.searchAndFilter`)}>
            <InfoTable
              headers={t(`${s}.gantt.searchAndFilterHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.gantt.searchAndFilterRows`, { returnObjects: true }) as string[][]}
            />
          </SectionCard>
          <SectionCard title={t(`${s}.gantt.viewOptions`)}>
            <InfoTable
              headers={t(`${s}.gantt.viewOptionsHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.gantt.viewOptionsRows`, { returnObjects: true }) as string[][]}
            />
          </SectionCard>
          <SectionCard title={t(`${s}.gantt.timelineNavigation`)}>
            <InfoTable
              headers={t(`${s}.gantt.timelineNavigationHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.gantt.timelineNavigationRows`, { returnObjects: true }) as string[][]}
            />
          </SectionCard>
          <SectionCard title={t(`${s}.gantt.chartLegend`)}>
            <InfoTable
              headers={t(`${s}.gantt.chartLegendHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.gantt.chartLegendRows`, { returnObjects: true }) as string[][]}
            />
          </SectionCard>
          <SectionCard title={t(`${s}.gantt.export`)}>
            <p className="text-sm leading-6 text-[color:var(--text-secondary)]">{t(`${s}.gantt.exportDesc`)}</p>
          </SectionCard>
        </div>
      ),
    },
    {
      id: 'members',
      title: t(`${s}.members.title`),
      icon: <Users className="h-5 w-5" />,
      content: (
        <div className="space-y-6">
          <SectionCard title={t(`${s}.members.addMember`)}>
            <p className="mb-4 text-sm leading-6 text-[color:var(--text-secondary)]">{t(`${s}.members.addMemberDesc`)}</p>
            <InfoTable
              headers={t(`${s}.members.addMemberHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.members.addMemberRows`, { returnObjects: true }) as string[][]}
            />
          </SectionCard>
          <SectionCard title={t(`${s}.members.roleTypes`)}>
            <InfoTable
              headers={t(`${s}.members.roleHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.members.roleRows`, { returnObjects: true }) as string[][]}
            />
          </SectionCard>
          <SectionCard title={t(`${s}.members.editMemberInfo`)}>
            <InfoTable
              headers={t(`${s}.members.editMemberHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.members.editMemberRows`, { returnObjects: true }) as string[][]}
            />
            <div className="mt-4"><Tip type="warning">{t(`${s}.members.ownershipTip`)}</Tip></div>
          </SectionCard>
          <SectionCard title={t(`${s}.members.memberStatus`)}>
            <InfoTable
              headers={t(`${s}.members.memberStatusHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.members.memberStatusRows`, { returnObjects: true }) as string[][]}
            />
          </SectionCard>
          <Tip>{t(`${s}.members.autoSaveTip`)}</Tip>
        </div>
      ),
    },
    {
      id: 'attendance',
      title: t(`${s}.attendance.title`),
      icon: <CalendarCheck className="h-5 w-5" />,
      content: (
        <div className="space-y-6">
          <SectionCard title={t(`${s}.attendance.overview`)}>
            <p className="mb-4 text-sm leading-6 text-[color:var(--text-secondary)]">{t(`${s}.attendance.overviewDesc`)}</p>
            <InfoTable
              headers={t(`${s}.attendance.overviewHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.attendance.overviewRows`, { returnObjects: true }) as string[][]}
            />
          </SectionCard>
          <SectionCard title={t(`${s}.attendance.registration`)}>
            <StepList steps={t(`${s}.attendance.registrationSteps`, { returnObjects: true }) as string[]} />
            <div className="mt-4"><Tip>{t(`${s}.attendance.registrationTip`)}</Tip></div>
          </SectionCard>
          <SectionCard title={t(`${s}.attendance.attendanceTypes`)}>
            <InfoTable
              headers={t(`${s}.attendance.attendanceTypesHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.attendance.attendanceTypesRows`, { returnObjects: true }) as string[][]}
            />
          </SectionCard>
          <SectionCard title={t(`${s}.attendance.editAndDelete`)}>
            <InfoTable
              headers={t(`${s}.attendance.editAndDeleteHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.attendance.editAndDeleteRows`, { returnObjects: true }) as string[][]}
            />
          </SectionCard>
          <SectionCard title={t(`${s}.attendance.permissionsByRole`)}>
            <InfoTable
              headers={t(`${s}.attendance.permissionsHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.attendance.permissionsRows`, { returnObjects: true }) as string[][]}
            />
          </SectionCard>
          <SectionCard title={t(`${s}.attendance.weeklyReportLink`)}>
            <p className="text-sm leading-6 text-[color:var(--text-secondary)]">{t(`${s}.attendance.weeklyReportLinkDesc`)}</p>
          </SectionCard>
          <Tip>{t(`${s}.attendance.dashboardTip`)}</Tip>
        </div>
      ),
    },
    {
      id: 'settings',
      title: t(`${s}.settings.title`),
      icon: <Settings className="h-5 w-5" />,
      content: (
        <div className="space-y-6">
          <SectionCard title={t(`${s}.settings.basicInfo`)}>
            <InfoTable
              headers={t(`${s}.settings.basicInfoHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.settings.basicInfoRows`, { returnObjects: true }) as string[][]}
            />
            <div className="mt-4"><Tip>{t(`${s}.settings.basicInfoTip`)}</Tip></div>
          </SectionCard>
          <SectionCard title={t(`${s}.settings.statusManagement`)}>
            <p className="mb-4 text-sm leading-6 text-[color:var(--text-secondary)]">{t(`${s}.settings.statusManagementDesc`)}</p>
            <InfoTable
              headers={t(`${s}.settings.statusManagementHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.settings.statusManagementRows`, { returnObjects: true }) as string[][]}
            />
            <div className="mt-4"><Tip type="warning">{t(`${s}.settings.statusManagementTip`)}</Tip></div>
          </SectionCard>
          <SectionCard title={t(`${s}.settings.dataManagement`)}>
            <InfoTable
              headers={t(`${s}.settings.dataManagementHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.settings.dataManagementRows`, { returnObjects: true }) as string[][]}
            />
            <div className="mt-4"><Tip type="warning">{t(`${s}.settings.dataManagementTip`)}</Tip></div>
          </SectionCard>
          <SectionCard title={t(`${s}.settings.auditLog`)}>
            <p className="mb-4 text-sm leading-6 text-[color:var(--text-secondary)]">{t(`${s}.settings.auditLogDesc`)}</p>
            <InfoTable
              headers={t(`${s}.settings.auditLogHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.settings.auditLogRows`, { returnObjects: true }) as string[][]}
            />
            <div className="mt-4"><Tip>{t(`${s}.settings.auditLogTip`)}</Tip></div>
          </SectionCard>
          <SectionCard title={t(`${s}.settings.dangerZone`)}>
            <Tip type="warning">{t(`${s}.settings.dangerZoneTip`)}</Tip>
          </SectionCard>
        </div>
      ),
    },
    {
      id: 'admin',
      title: t(`${s}.userManagement.title`),
      icon: <ShieldCheck className="h-5 w-5" />,
      content: (
        <div className="space-y-6">
          <SectionCard><Tip type="warning">{t(`${s}.userManagement.adminOnlyTip`)}</Tip></SectionCard>
          <SectionCard title={t(`${s}.userManagement.summaryCards`)}>
            <p className="mb-4 text-sm leading-6 text-[color:var(--text-secondary)]">{t(`${s}.userManagement.summaryCardsDesc`)}</p>
            <InfoTable
              headers={t(`${s}.userManagement.summaryCardsHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.userManagement.summaryCardsRows`, { returnObjects: true }) as string[][]}
            />
          </SectionCard>
          <SectionCard title={t(`${s}.userManagement.userList`)}>
            <p className="mb-4 text-sm leading-6 text-[color:var(--text-secondary)]">{t(`${s}.userManagement.userListDesc`)}</p>
            <InfoTable
              headers={t(`${s}.userManagement.userListHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.userManagement.userListRows`, { returnObjects: true }) as string[][]}
            />
          </SectionCard>
          <SectionCard title={t(`${s}.userManagement.accountStatus`)}>
            <InfoTable
              headers={t(`${s}.userManagement.accountStatusHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.userManagement.accountStatusRows`, { returnObjects: true }) as string[][]}
            />
          </SectionCard>
          <SectionCard title={t(`${s}.userManagement.systemRoles`)}>
            <InfoTable
              headers={t(`${s}.userManagement.systemRolesHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.userManagement.systemRolesRows`, { returnObjects: true }) as string[][]}
            />
            <div className="mt-4"><Tip>{t(`${s}.userManagement.systemRolesTip`)}</Tip></div>
          </SectionCard>
          <SectionCard title={t(`${s}.userManagement.pendingNotification`)}>
            <p className="text-sm leading-6 text-[color:var(--text-secondary)]">{t(`${s}.userManagement.pendingNotificationDesc`)}</p>
          </SectionCard>
        </div>
      ),
    },
    {
      id: 'chatbot',
      title: t(`${s}.dkBot.title`),
      icon: <Bot className="h-5 w-5" />,
      content: (
        <div className="space-y-6">
          <SectionCard title={t(`${s}.dkBot.overview`)}>
            <p className="text-sm leading-6 text-[color:var(--text-secondary)]">{t(`${s}.dkBot.overviewDesc`)}</p>
          </SectionCard>
          <SectionCard title={t(`${s}.dkBot.usage`)}>
            <StepList steps={t(`${s}.dkBot.usageSteps`, { returnObjects: true }) as string[]} />
          </SectionCard>
          <SectionCard title={t(`${s}.dkBot.suggestedQuestions`)}>
            <InfoTable
              headers={t(`${s}.dkBot.suggestedQuestionsHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.dkBot.suggestedQuestionsRows`, { returnObjects: true }) as string[][]}
            />
          </SectionCard>
          <Tip>{t(`${s}.dkBot.contextTip`)}</Tip>
        </div>
      ),
    },
    {
      id: 'theme',
      title: t(`${s}.theme.title`),
      icon: <Palette className="h-5 w-5" />,
      content: (
        <div className="space-y-6">
          <SectionCard title={t(`${s}.theme.darkLightMode`)}>
            <p className="text-sm leading-6 text-[color:var(--text-secondary)]">{t(`${s}.theme.darkLightModeDesc`)}</p>
          </SectionCard>
          <SectionCard title={t(`${s}.theme.sidebarToggle`)}>
            <InfoTable
              headers={t(`${s}.theme.sidebarToggleHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.theme.sidebarToggleRows`, { returnObjects: true }) as string[][]}
            />
          </SectionCard>
        </div>
      ),
    },
    {
      id: 'shortcuts',
      title: t(`${s}.shortcuts.title`),
      icon: <Keyboard className="h-5 w-5" />,
      content: (
        <SectionCard>
          <InfoTable
            headers={t(`${s}.shortcuts.tableHeaders`, { returnObjects: true }) as string[]}
            rows={t(`${s}.shortcuts.tableRows`, { returnObjects: true }) as string[][]}
          />
        </SectionCard>
      ),
    },
    {
      id: 'data',
      title: t(`${s}.dataManagement.title`),
      icon: <Database className="h-5 w-5" />,
      content: (
        <div className="space-y-6">
          <SectionCard title={t(`${s}.dataManagement.exportFeatures`)}>
            <InfoTable
              headers={t(`${s}.dataManagement.exportHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.dataManagement.exportRows`, { returnObjects: true }) as string[][]}
            />
          </SectionCard>
          <SectionCard title={t(`${s}.dataManagement.importFeatures`)}>
            <p className="text-sm leading-6 text-[color:var(--text-secondary)]">
              {t(`${s}.dataManagement.importFeaturesDesc`)}
            </p>
          </SectionCard>
          <SectionCard title={t(`${s}.dataManagement.autoSave`)}>
            <InfoTable
              headers={t(`${s}.dataManagement.autoSaveHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.dataManagement.autoSaveRows`, { returnObjects: true }) as string[][]}
            />
            <div className="mt-4"><Tip>{t(`${s}.dataManagement.autoSaveTip`)}</Tip></div>
          </SectionCard>
        </div>
      ),
    },
    {
      id: 'permissions',
      title: t(`${s}.permissions.title`),
      icon: <ClipboardList className="h-5 w-5" />,
      content: (
        <div className="space-y-6">
          {/* 사용자 데이터 분리 구조 */}
          <SectionCard title={t(`${s}.permissions.dataSeparation`)}>
            <p className="mb-5 text-sm leading-6 text-[color:var(--text-secondary)]">{t(`${s}.permissions.dataSeparationDesc`)}</p>
            <div className="space-y-3">
              {[
                { title: t(`${s}.permissions.dataSeparationStep1Title`), desc: t(`${s}.permissions.dataSeparationStep1Desc`), color: '#60a5fa', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.15)' },
                { title: t(`${s}.permissions.dataSeparationStep2Title`), desc: t(`${s}.permissions.dataSeparationStep2Desc`), color: '#fbbf24', bg: 'rgba(234,179,8,0.08)', border: 'rgba(234,179,8,0.15)' },
                { title: t(`${s}.permissions.dataSeparationStep3Title`), desc: t(`${s}.permissions.dataSeparationStep3Desc`), color: '#f87171', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.15)' },
              ].map((step, i) => (
                <div key={i} className="rounded-xl p-4" style={{ backgroundColor: step.bg, border: `1px solid ${step.border}` }}>
                  <p className="text-sm font-semibold mb-1" style={{ color: step.color }}>{step.title}</p>
                  <p className="text-xs leading-5 text-[color:var(--text-secondary)]">{step.desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Tip>{t(`${s}.permissions.dataSeparationCorePrinciple`)}</Tip>
            </div>
          </SectionCard>
          <SectionCard title={t(`${s}.permissions.dataSeparationExampleTitle`)}>
            <InfoTable
              headers={t(`${s}.permissions.dataSeparationExampleHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.permissions.dataSeparationExampleRows`, { returnObjects: true }) as string[][]}
            />
          </SectionCard>

          {/* 시스템 역할 vs 프로젝트 역할 */}
          <SectionCard title={t(`${s}.permissions.systemVsProject`)}>
            <p className="mb-4 text-sm leading-6 text-[color:var(--text-secondary)]">{t(`${s}.permissions.systemVsProjectDesc`)}</p>
            <InfoTable
              headers={t(`${s}.permissions.systemVsProjectHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.permissions.systemVsProjectRows`, { returnObjects: true }) as string[][]}
            />
          </SectionCard>
          <SectionCard title={t(`${s}.permissions.adminOnlyFeatures`)}>
            <InfoTable
              headers={t(`${s}.permissions.adminOnlyHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.permissions.adminOnlyRows`, { returnObjects: true }) as string[][]}
            />
          </SectionCard>

          {/* 프로젝트 역할별 상세 권한 */}
          <SectionCard title={t(`${s}.permissions.projectRolePermissions`)}>
            <p className="mb-4 text-sm leading-6 text-[color:var(--text-secondary)]">{t(`${s}.permissions.projectRoleDesc`)}</p>
            <InfoTable
              headers={t(`${s}.permissions.projectRoleHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.permissions.projectRoleRows`, { returnObjects: true }) as string[][]}
            />
          </SectionCard>
          <SectionCard title={t(`${s}.permissions.projectRoleDetailTitle`)}>
            <InfoTable
              headers={t(`${s}.permissions.projectRoleDetailHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.permissions.projectRoleDetailRows`, { returnObjects: true }) as string[][]}
            />
          </SectionCard>

          <SectionCard title={t(`${s}.permissions.auditLog`)}>
            <p className="text-sm leading-6 text-[color:var(--text-secondary)]">{t(`${s}.permissions.auditLogDesc`)}</p>
          </SectionCard>
        </div>
      ),
    },
    {
      id: 'account',
      title: t(`${s}.accountSettings.title`),
      icon: <UserCog className="h-5 w-5" />,
      content: (
        <div className="space-y-6">
          <SectionCard title={t(`${s}.accountSettings.access`)}>
            <p className="text-sm leading-6 text-[color:var(--text-secondary)]">{t(`${s}.accountSettings.accessDesc`)}</p>
          </SectionCard>
          <SectionCard title={t(`${s}.accountSettings.accountInfo`)}>
            <InfoTable
              headers={t(`${s}.accountSettings.accountInfoHeaders`, { returnObjects: true }) as string[]}
              rows={t(`${s}.accountSettings.accountInfoRows`, { returnObjects: true }) as string[][]}
            />
          </SectionCard>
          <SectionCard title={t(`${s}.accountSettings.withdrawal`)}>
            <StepList steps={t(`${s}.accountSettings.withdrawalSteps`, { returnObjects: true }) as string[]} />
            <div className="mt-4"><Tip type="warning">{t(`${s}.accountSettings.withdrawalTip`)}</Tip></div>
          </SectionCard>
        </div>
      ),
    },
    {
      id: 'glossary',
      title: t(`${s}.glossary.title`),
      icon: <BookText className="h-5 w-5" />,
      content: (
        <SectionCard>
          <InfoTable
            headers={t(`${s}.glossary.tableHeaders`, { returnObjects: true }) as string[]}
            rows={t(`${s}.glossary.tableRows`, { returnObjects: true }) as string[][]}
          />
        </SectionCard>
      ),
    },
    {
      id: 'faq',
      title: t(`${s}.faq.title`),
      icon: <HelpCircle className="h-5 w-5" />,
      content: (
        <div className="space-y-4">
          {(t(`${s}.faq.items`, { returnObjects: true }) as { q: string; a: string }[]).map((item, i) => (
            <SectionCard key={i}>
              <h4 className="flex items-start gap-2 text-base font-semibold text-[color:var(--text-primary)]">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(15,118,110,0.1)] text-xs font-bold text-[color:var(--accent-primary)]">Q</span>
                {item.q}
              </h4>
              <p className="mt-3 pl-8 text-sm leading-7 text-[color:var(--text-secondary)]">{item.a}</p>
            </SectionCard>
          ))}
        </div>
      ),
    },
  ];

  const filteredSections = searchQuery.trim()
    ? sections.filter((sec) => sec.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : sections;

  const currentSection = sections.find((sec) => sec.id === activeSection) || sections[0];

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-8">
      {/* Hero */}
      <section className="app-panel-dark relative min-h-[320px] overflow-hidden p-6 md:p-8 lg:min-h-[360px]">
        <div className="pointer-events-none absolute right-[-6rem] top-[-7rem] h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.18),transparent_70%)] blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-8rem] left-[12%] h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(255,190,120,0.18),transparent_72%)] blur-3xl" />
        <div className="pointer-events-none absolute right-[25%] top-[20%] h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.12),transparent_70%)] blur-3xl" />

        {/* ---- Floating decorative elements (right side) ---- */}
        <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden="true">
          <FloatingStatBubble
            value="12"
            label={t('manual.heroLabel')}
            className="hero-float-1 h-[76px] w-[76px]"
            style={{ top: '8%', right: '11%' }}
          />
          <FloatingStatBubble
            value="v3"
            label="latest"
            className="hero-float-3 h-[68px] w-[68px]"
            style={{ top: '40%', right: '5%' }}
          />
          <FloatingStatBubble
            value="✓"
            className="hero-float-2 h-[60px] w-[60px]"
            style={{ top: '20%', right: '26%' }}
          />

          <div
            className="hero-float-2 pointer-events-none absolute rounded-2xl border border-white/[0.12] bg-white/[0.08] backdrop-blur-md"
            style={{ top: '65%', right: '6%', width: '140px', padding: '10px 12px' }}
          >
            <div className="mb-2 flex items-center gap-1.5">
              <ListChecks className="h-3 w-3 text-amber-400/60" />
              <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/50">{t('manual.tocLabel')}</span>
            </div>
            <div className="space-y-1.5">
              <div className="h-1 w-full rounded-full bg-white/15" />
              <div className="h-1 w-[85%] rounded-full bg-white/10" />
              <div className="h-1 w-[70%] rounded-full bg-white/8" />
            </div>
          </div>

          <FloatingElement className="hero-float-4 h-11 w-11" style={{ top: '5%', right: '22%' }}>
            <BookOpen className="h-5 w-5 text-amber-400/50" />
          </FloatingElement>
          <FloatingElement className="hero-float-2 h-10 w-10" style={{ top: '54%', right: '12%' }}>
            <Lightbulb className="h-4.5 w-4.5 text-amber-300/50" />
          </FloatingElement>
          <FloatingElement className="hero-float-1 h-10 w-10" style={{ top: '60%', right: '24%' }}>
            <FileText className="h-4.5 w-4.5 text-teal-400/45" />
          </FloatingElement>
          <FloatingElement className="hero-float-3 h-9 w-9" style={{ top: '30%', right: '3%' }}>
            <Bookmark className="h-4 w-4 text-orange-400/40" />
          </FloatingElement>
          <FloatingElement className="hero-float-4 h-10 w-10" style={{ top: '48%', right: '30%' }}>
            <GraduationCap className="h-4.5 w-4.5 text-teal-300/45" />
          </FloatingElement>
          <FloatingElement className="hero-float-1 h-9 w-9" style={{ top: '78%', right: '18%' }}>
            <Info className="h-4 w-4 text-white/30" />
          </FloatingElement>
          <FloatingElement className="hero-float-2 h-11 w-11" style={{ top: '12%', right: '38%' }}>
            <Sparkles className="h-5 w-5 text-amber-400/40" />
          </FloatingElement>
          <FloatingElement className="hero-float-3 h-9 w-9" style={{ top: '72%', right: '34%' }}>
            <Compass className="h-4 w-4 text-teal-300/40 hero-spin-slow" />
          </FloatingElement>
          <FloatingElement className="hero-float-4 h-10 w-10" style={{ top: '82%', right: '4%' }}>
            <Search className="h-4.5 w-4.5 text-white/30" />
          </FloatingElement>

          <div className="absolute h-px w-16 bg-gradient-to-r from-transparent via-white/10 to-transparent hero-float-2" style={{ top: '26%', right: '15%', transform: 'rotate(-20deg)' }} />
          <div className="absolute h-px w-20 bg-gradient-to-r from-transparent via-amber-400/10 to-transparent hero-float-3" style={{ top: '50%', right: '18%', transform: 'rotate(15deg)' }} />
          <div className="absolute h-px w-14 bg-gradient-to-r from-transparent via-teal-400/10 to-transparent hero-float-1" style={{ top: '68%', right: '28%', transform: 'rotate(-10deg)' }} />

          <div className="absolute h-1.5 w-1.5 rounded-full bg-white/20 hero-float-1" style={{ top: '44%', right: '14%' }} />
          <div className="absolute h-1 w-1 rounded-full bg-amber-400/30 hero-float-4" style={{ top: '35%', right: '20%' }} />
          <div className="absolute h-1 w-1 rounded-full bg-teal-400/30 hero-float-2" style={{ top: '58%', right: '8%' }} />
          <div className="absolute h-1.5 w-1.5 rounded-full bg-orange-400/25 hero-float-3" style={{ top: '16%', right: '6%' }} />
        </div>

        <div className="relative z-10 max-w-2xl">
          <div className="surface-badge border-white/12 bg-white/[0.14] text-white/90">
            <BookOpen className="h-3.5 w-3.5 text-[color:var(--accent-secondary)]" />
            User Manual v3.0
          </div>
          <h1 className="mt-6 text-[clamp(2rem,4vw,3.8rem)] font-semibold leading-[0.92] tracking-[-0.06em] text-white">
            DK Flow<br />{t('manual.pageTitle')}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/90 md:text-lg">
            {t('manual.pageSubtitle')}
          </p>
        </div>
      </section>

      {/* Body */}
      <section className="grid gap-6 xl:grid-cols-[280px_1fr]">
        {/* Sidebar TOC */}
        <div className="app-panel sticky top-[6.75rem] self-start overflow-hidden">
          <div className="border-b border-[var(--border-color)] p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('manual.searchPlaceholder')}
                className="field-input !pl-9 py-2.5 text-sm"
              />
            </div>
          </div>
          <nav className="p-3">
            <div className="space-y-1">
              {filteredSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => { setActiveSection(section.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-200 ${
                    activeSection === section.id
                      ? 'bg-[rgba(15,118,110,0.1)] text-[color:var(--accent-primary)]'
                      : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-elevated)] hover:text-[color:var(--text-primary)]'
                  }`}
                >
                  {section.icon}
                  <span className="flex-1 truncate" title={section.title}>{section.title}</span>
                  {activeSection === section.id && <ChevronRight className="h-4 w-4 shrink-0" />}
                </button>
              ))}
            </div>
          </nav>
        </div>

        {/* Content */}
        <div className="min-w-0">
          <div className="app-panel p-6 md:p-8">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-[image:var(--gradient-primary)] text-white shadow-[0_24px_48px_-28px_rgba(15,118,110,0.78)]">
                {currentSection.icon}
              </div>
              <div>
                <p className="page-kicker">Manual Section</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
                  {currentSection.title}
                </h2>
              </div>
            </div>
            <div className="mt-8">{currentSection.content}</div>
          </div>

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => {
                const idx = sections.findIndex((sec) => sec.id === activeSection);
                if (idx > 0) { setActiveSection(sections[idx - 1].id); window.scrollTo({ top: 0, behavior: 'smooth' }); }
              }}
              disabled={sections.findIndex((sec) => sec.id === activeSection) === 0}
              className="rounded-full border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-5 py-2.5 text-sm font-medium text-[color:var(--text-secondary)] transition-all hover:bg-[color:var(--bg-tertiary)] disabled:opacity-40"
            >
              {t('manual.previous')}
            </button>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-4 py-2.5 text-sm text-[color:var(--text-secondary)] transition-all hover:bg-[color:var(--bg-tertiary)]"
            >
              <ArrowUp className="h-4 w-4" /> {t('manual.scrollToTop')}
            </button>
            <button
              onClick={() => {
                const idx = sections.findIndex((sec) => sec.id === activeSection);
                if (idx < sections.length - 1) { setActiveSection(sections[idx + 1].id); window.scrollTo({ top: 0, behavior: 'smooth' }); }
              }}
              disabled={sections.findIndex((sec) => sec.id === activeSection) === sections.length - 1}
              className="rounded-full border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-5 py-2.5 text-sm font-medium text-[color:var(--text-secondary)] transition-all hover:bg-[color:var(--bg-tertiary)] disabled:opacity-40"
            >
              {t('manual.next')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
