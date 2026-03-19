import { useState } from 'react';
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

export default function UserManual() {
  const [activeSection, setActiveSection] = useState('getting-started');
  const [searchQuery, setSearchQuery] = useState('');

  const sections: Section[] = [
    {
      id: 'getting-started',
      title: '시작하기',
      icon: <LogIn className="h-5 w-5" />,
      content: (
        <div className="space-y-6">
          <SectionCard title="시스템 요구사항">
            <InfoTable
              headers={['항목', '권장 사양']}
              rows={[
                ['브라우저', 'Chrome, Edge, Safari 최신 버전'],
                ['해상도', '1280×720 이상 (1920×1080 권장)'],
                ['네트워크', '인터넷 연결 필요 (Supabase 연동 시)'],
              ]}
            />
          </SectionCard>
          <SectionCard title="로그인">
            <StepList steps={[
              '브라우저에서 DK Flow 접속 URL을 엽니다.',
              '로그인 탭을 선택합니다.',
              '이메일과 비밀번호를 입력한 후 로그인 버튼을 클릭합니다.',
            ]} />
            <div className="mt-4">
              <Tip>Supabase가 설정되지 않은 환경에서는 자동으로 로컬 모드로 접속됩니다. 별도의 계정 없이 바로 사용할 수 있습니다.</Tip>
            </div>
          </SectionCard>
          <SectionCard title="회원가입">
            <StepList steps={[
              '로그인 화면에서 회원가입 탭을 선택합니다.',
              '이름, 이메일, 비밀번호(6자 이상)를 입력합니다.',
              '회원가입 버튼을 클릭하면 즉시 로그인되어 홈 화면으로 이동합니다.',
            ]} />
          </SectionCard>
        </div>
      ),
    },
    {
      id: 'home',
      title: '홈 화면',
      icon: <Home className="h-5 w-5" />,
      content: (
        <div className="space-y-6">
          <SectionCard title="요약 카드">
            <p className="mb-4 text-sm leading-6 text-[color:var(--text-secondary)]">상단 히어로 영역에서 다음 정보를 확인할 수 있습니다:</p>
            <InfoTable headers={['카드', '설명']} rows={[
              ['전체 프로젝트', '시스템에 등록된 모든 프로젝트 수'],
              ['진행중', '현재 진행중 상태인 프로젝트 수'],
              ['최근 기록', '빠르게 접근할 수 있는 최근 프로젝트 수'],
            ]} />
          </SectionCard>
          <SectionCard title="지표 패널">
            <InfoTable headers={['지표', '설명']} rows={[
              ['Active Ratio', '전체 프로젝트 대비 진행중 프로젝트 비율'],
              ['Completed', '완료된 프로젝트 수'],
              ['Quick Access', '최근 프로젝트 바로가기 (최대 3개)'],
            ]} />
          </SectionCard>
          <SectionCard title="최근 프로젝트">
            <p className="text-sm leading-6 text-[color:var(--text-secondary)]">
              하단에 최근 작업한 프로젝트 카드가 표시됩니다. 카드를 클릭하면 해당 프로젝트의 대시보드로 바로 진입합니다.
            </p>
          </SectionCard>
        </div>
      ),
    },
    {
      id: 'project-management',
      title: '프로젝트 관리',
      icon: <FolderOpen className="h-5 w-5" />,
      content: (
        <div className="space-y-6">
          <SectionCard title="프로젝트 생성">
            <StepList steps={[
              '홈 화면의 새 프로젝트 시작 버튼 또는 사이드바의 + 버튼을 클릭합니다.',
              '프로젝트명(필수), 설명, 시작일/종료일을 입력합니다.',
              '생성 후 자동으로 프로젝트 대시보드로 이동합니다.',
            ]} />
          </SectionCard>
          <SectionCard title="프로젝트 상태">
            <InfoTable headers={['상태', '설명']} rows={[
              ['준비', '프로젝트 준비 단계 (기본 상태)'],
              ['진행중', '프로젝트가 활발하게 진행 중'],
              ['완료', '프로젝트 완료 (완료일 자동 기록)'],
            ]} />
            <div className="mt-4">
              <Tip type="warning">상태 변경은 관리자 권한이 있는 사용자만 가능합니다.</Tip>
            </div>
          </SectionCard>
        </div>
      ),
    },
    {
      id: 'dashboard',
      title: '대시보드',
      icon: <LayoutDashboard className="h-5 w-5" />,
      content: (
        <div className="space-y-6">
          <SectionCard title="상단 현황 영역">
            <InfoTable headers={['항목', '설명']} rows={[
              ['전체 작업', '등록된 리프(말단) 작업 수'],
              ['멤버', '프로젝트 참여 멤버 수'],
              ['지연', '계획 종료일을 초과한 작업 수'],
            ]} />
          </SectionCard>
          <SectionCard title="차트 섹션">
            <InfoTable headers={['차트', '설명']} rows={[
              ['상태별 분포', '대기/진행중/완료/보류 작업 비율'],
              ['담당자별 진행률', '각 담당자의 작업 완료/잔여 현황 (막대 그래프)'],
              ['Phase별 진행률', '단계별 계획 vs 실적 공정율 비교'],
              ['프로젝트 일정 요약', '시작일, 종료일, 일정 경과율, 총/경과/잔여일'],
              ['Phase 가중치 분포', '각 Phase의 가중치 비중 (도넛 차트)'],
            ]} />
          </SectionCard>
          <SectionCard title="작업 큐">
            <InfoTable headers={['큐', '설명']} rows={[
              ['지연 작업', '지연 일수와 함께 지연된 작업 목록'],
              ['금주 작업', '이번 주에 진행 예정인 작업'],
              ['차주 작업', '다음 주에 진행 예정인 작업'],
              ['최근 완료 작업', '가장 최근에 완료된 작업 목록'],
            ]} />
          </SectionCard>
          <Tip>대시보드 상단의 현황 보고서 버튼을 클릭하면 Word(.docx) 형식의 프로젝트 현황 보고서를 자동 생성하여 다운로드합니다.</Tip>
        </div>
      ),
    },
    {
      id: 'wbs',
      title: 'WBS (작업분류체계)',
      icon: <ListTree className="h-5 w-5" />,
      content: (
        <div className="space-y-6">
          <SectionCard title="작업 계층 구조">
            <InfoTable headers={['레벨', '구분', '설명']} rows={[
              ['Level 1', 'Phase', '프로젝트 단계 (분석, 설계, 개발, 테스트 등)'],
              ['Level 2', 'Activity', '단계 내 활동'],
              ['Level 3', 'Task', '구체적 작업'],
              ['Level 4', 'Function', '세부 기능/산출물'],
            ]} />
          </SectionCard>
          <SectionCard title="인라인 편집 (엑셀 스타일)">
            <p className="mb-4 text-sm leading-6 text-[color:var(--text-secondary)]">테이블의 각 셀을 클릭하면 바로 편집할 수 있습니다:</p>
            <InfoTable headers={['컬럼', '편집 방식']} rows={[
              ['작업명', '클릭 후 텍스트 입력 → Enter로 확정'],
              ['산출물', '클릭 후 텍스트 입력'],
              ['담당자', '드롭다운에서 멤버 선택'],
              ['가중치', '클릭 후 숫자 입력 (소수점 지원)'],
              ['계획/실적 일정', '날짜 선택기로 입력'],
              ['계획/실적 공정율', '클릭 후 0~100 숫자 입력'],
              ['상태', '드롭다운에서 선택 (대기/진행중/완료/보류)'],
            ]} />
          </SectionCard>
          <SectionCard title="도구 모음">
            <InfoTable headers={['기능', '설명']} rows={[
              ['Phase 추가', '최상위 Phase 작업 추가'],
              ['전체 펼침', '모든 작업 트리 확장'],
              ['전체 접기', '모든 작업 트리 축소'],
              ['엑셀 다운로드', 'WBS를 엑셀(.xlsx) 파일로 내보내기'],
              ['되돌리기 / 다시하기', 'Ctrl+Z / Ctrl+Y'],
            ]} />
          </SectionCard>
          <Tip>WBS에서의 모든 변경사항은 자동 저장됩니다. 입력 후 약 0.7초 뒤 자동으로 서버에 반영됩니다.</Tip>
        </div>
      ),
    },
    {
      id: 'gantt',
      title: '간트 차트',
      icon: <Calendar className="h-5 w-5" />,
      content: (
        <div className="space-y-6">
          <SectionCard title="화면 구성">
            <InfoTable headers={['영역', '설명']} rows={[
              ['상단 히어로', '표시 작업 수, 오픈(미완료) 작업 수, 지연 작업 수'],
              ['작업 포커스 카드', '선택한 작업의 상세 정보 (기간, 공정율, 지연 등)'],
              ['필터/검색 바', '작업 검색, 상태 필터, 뷰 옵션 설정'],
              ['간트 차트', '좌측 작업 목록 + 우측 타임라인 바'],
            ]} />
          </SectionCard>
          <SectionCard title="검색 및 필터">
            <InfoTable headers={['기능', '설명']} rows={[
              ['검색', '작업명, 산출물, 담당자로 실시간 검색'],
              ['전체', '모든 작업 표시'],
              ['진행중/대기', '완료되지 않은 작업만 필터'],
              ['지연', '지연된 작업만 필터'],
              ['완료', '완료된 작업만 필터'],
            ]} />
          </SectionCard>
          <SectionCard title="뷰 옵션">
            <InfoTable headers={['옵션', '설명']} rows={[
              ['보기 범위', '6주 / 12주 / 24주 중 선택'],
              ['행 밀도', 'Compact (조밀) / Comfortable (여유)'],
              ['주말 강조', '타임라인에서 주말 영역 강조 On/Off'],
            ]} />
          </SectionCard>
          <SectionCard title="차트 범례">
            <InfoTable headers={['색상', '의미']} rows={[
              ['🟢 계획 바 (진한 청록)', '계획 일정 범위'],
              ['🟩 실적 바 (밝은 초록)', '실적 일정 범위'],
              ['🔴 오늘선 (빨간 세로선)', '현재 날짜'],
            ]} />
          </SectionCard>
        </div>
      ),
    },
    {
      id: 'members',
      title: '멤버 관리',
      icon: <Users className="h-5 w-5" />,
      content: (
        <div className="space-y-6">
          <SectionCard title="멤버 추가">
            <StepList steps={[
              '멤버 추가 버튼을 클릭합니다.',
              '팝업에서 이름과 역할을 입력합니다.',
              '추가 버튼을 클릭합니다.',
            ]} />
          </SectionCard>
          <SectionCard title="역할 유형">
            <InfoTable headers={['역할', '권한']} rows={[
              ['소유자', '모든 권한 (프로젝트 생성자)'],
              ['관리자', '대부분의 관리 권한'],
              ['멤버', '작업 수행 및 업데이트'],
              ['뷰어', '조회만 가능'],
            ]} />
          </SectionCard>
          <SectionCard title="멤버 정보 편집">
            <InfoTable headers={['기능', '방법']} rows={[
              ['이름 수정', '연필 아이콘 클릭 → 수정 → Enter 또는 ✓ 클릭'],
              ['역할 변경', '역할 지정 드롭다운에서 변경'],
              ['멤버 삭제', '휴지통 아이콘 클릭 → 확인'],
            ]} />
          </SectionCard>
        </div>
      ),
    },
    {
      id: 'settings',
      title: '프로젝트 설정',
      icon: <Settings className="h-5 w-5" />,
      content: (
        <div className="space-y-6">
          <SectionCard title="기본 정보">
            <InfoTable headers={['항목', '설명']} rows={[
              ['프로젝트명', '프로젝트 이름 (필수)'],
              ['설명', '프로젝트에 대한 상세 설명'],
              ['시작일', '프로젝트 시작 날짜'],
              ['종료일', '프로젝트 종료 목표 날짜'],
              ['진척기준일', '공정율 계산의 기준이 되는 날짜'],
            ]} />
            <div className="mt-4">
              <Tip>정보 수정 후 반드시 저장 버튼을 클릭해야 반영됩니다.</Tip>
            </div>
          </SectionCard>
          <SectionCard title="데이터 관리">
            <InfoTable headers={['기능', '설명']} rows={[
              ['WBS 엑셀 내보내기', '현재 WBS를 엑셀 파일로 다운로드'],
              ['엑셀 가져오기', '엑셀 파일에서 WBS 데이터를 불러오기'],
            ]} />
            <div className="mt-4">
              <Tip type="warning">엑셀 가져오기 시 기존 작업이 있으면 덮어쓰기 확인 대화상자가 표시됩니다.</Tip>
            </div>
          </SectionCard>
          <SectionCard title="위험 영역 (관리자 전용)">
            <Tip type="warning">프로젝트 삭제 시 모든 관련 데이터가 영구 삭제됩니다. 이 작업은 되돌릴 수 없습니다. 삭제 전에 WBS 엑셀 내보내기로 데이터를 백업해두는 것을 권장합니다.</Tip>
          </SectionCard>
        </div>
      ),
    },
    {
      id: 'admin',
      title: '사용자 관리',
      icon: <ShieldCheck className="h-5 w-5" />,
      content: (
        <div className="space-y-6">
          <SectionCard>
            <Tip type="warning">이 메뉴는 관리자 권한 사용자에게만 표시됩니다.</Tip>
            <p className="mt-4 text-sm leading-6 text-[color:var(--text-secondary)]">
              사이드바에서 사용자 관리 메뉴를 선택하면 시스템 전체 사용자를 관리할 수 있습니다.
            </p>
          </SectionCard>
        </div>
      ),
    },
    {
      id: 'theme',
      title: '테마 및 UI 설정',
      icon: <Palette className="h-5 w-5" />,
      content: (
        <div className="space-y-6">
          <SectionCard title="다크/라이트 모드">
            <p className="text-sm leading-6 text-[color:var(--text-secondary)]">
              헤더 영역에서 테마를 전환할 수 있습니다. 다크 모드와 라이트 모드 간 즉시 전환되며, 설정은 브라우저에 저장됩니다.
            </p>
          </SectionCard>
          <SectionCard title="사이드바 접기/펼치기">
            <InfoTable headers={['모드', '설명']} rows={[
              ['펼침 모드', '프로젝트 목록, 메뉴, 워크스페이스 정보 전체 표시'],
              ['접힘 모드', '아이콘만 표시 (화면 공간 확보)'],
            ]} />
          </SectionCard>
        </div>
      ),
    },
    {
      id: 'shortcuts',
      title: '키보드 단축키',
      icon: <Keyboard className="h-5 w-5" />,
      content: (
        <SectionCard>
          <InfoTable headers={['단축키', '기능', '페이지']} rows={[
            ['Ctrl/⌘ + Z', '되돌리기 (Undo)', 'WBS'],
            ['Ctrl/⌘ + Y', '다시하기 (Redo)', 'WBS'],
            ['Enter', '셀 편집 확정', 'WBS'],
            ['Escape', '셀 편집 취소', 'WBS'],
          ]} />
        </SectionCard>
      ),
    },
    {
      id: 'data',
      title: '데이터 관리',
      icon: <Database className="h-5 w-5" />,
      content: (
        <div className="space-y-6">
          <SectionCard title="내보내기 기능">
            <InfoTable headers={['기능', '위치', '형식']} rows={[
              ['WBS 엑셀 내보내기', 'WBS 페이지 / 설정 페이지', '.xlsx'],
              ['간트 차트 엑셀', '간트 차트 페이지', '.xlsx'],
              ['현황 보고서', '대시보드 페이지', '.docx (Word)'],
            ]} />
          </SectionCard>
          <SectionCard title="가져오기 기능">
            <p className="text-sm leading-6 text-[color:var(--text-secondary)]">
              설정 페이지 → 엑셀 가져오기 버튼으로 <code className="rounded-lg bg-[color:var(--bg-tertiary)] px-2 py-0.5 text-xs font-medium">.xlsx</code> 또는 <code className="rounded-lg bg-[color:var(--bg-tertiary)] px-2 py-0.5 text-xs font-medium">.xls</code> 파일을 업로드하여 WBS 데이터를 불러올 수 있습니다.
            </p>
          </SectionCard>
        </div>
      ),
    },
    {
      id: 'glossary',
      title: '용어 정의',
      icon: <BookText className="h-5 w-5" />,
      content: (
        <SectionCard>
          <InfoTable headers={['용어', '설명']} rows={[
            ['WBS', 'Work Breakdown Structure, 작업분류체계'],
            ['Phase', '프로젝트 단계 (분석, 설계, 개발, 테스트 등)'],
            ['Activity', '단계 내 활동'],
            ['Task', '구체적 작업'],
            ['Function', '세부 기능/산출물'],
            ['가중치', '작업의 상대적 중요도/비중 (숫자)'],
            ['공정율', '작업 진행률 (0~100%)'],
            ['계획 공정율', '계획 기준 공정 진행률'],
            ['실적 공정율', '실제 수행 기준 공정 진행률'],
            ['달성율', '계획 대비 실적 비율'],
            ['진척기준일', '공정율 계산의 기준이 되는 날짜'],
            ['리프 작업', '하위 작업이 없는 말단 작업 (실제 작업 단위)'],
          ]} />
        </SectionCard>
      ),
    },
    {
      id: 'faq',
      title: '자주 묻는 질문',
      icon: <HelpCircle className="h-5 w-5" />,
      content: (
        <div className="space-y-4">
          {[
            { q: '로컬 모드와 온라인 모드의 차이는?', a: '로컬 모드는 계정 없이 브라우저에 데이터가 저장됩니다. 온라인 모드(Supabase)에서는 이메일 계정이 필요하며, 서버에 데이터가 저장되어 멀티 사용자 및 동기화를 지원합니다.' },
            { q: '작업이 자동으로 저장되나요?', a: 'WBS 페이지에서의 변경사항은 약 0.7초 후 자동 저장됩니다. 프로젝트 설정에서의 기본 정보 변경은 저장 버튼을 눌러야 합니다.' },
            { q: '상위 작업의 공정율은 어떻게 계산되나요?', a: '상위 작업의 공정율은 하위 작업의 가중치와 공정율을 조합하여 자동 계산됩니다.' },
            { q: '엑셀 가져오기 시 기존 데이터는 어떻게 되나요?', a: '기존 작업이 있는 경우 덮어쓰기 확인 대화상자가 표시됩니다. "확인"을 클릭하면 기존 데이터가 교체됩니다.' },
            { q: '프로젝트 삭제 후 복구할 수 있나요?', a: '아니요. 프로젝트 삭제는 영구적이며 되돌릴 수 없습니다. 삭제 전에 WBS 엑셀 내보내기로 데이터를 백업해두는 것을 권장합니다.' },
            { q: '관리 기능에 접근할 수 없어요.', a: '상태 변경, 삭제 등의 관리 기능은 관리자 권한이 필요합니다. 시스템 관리자에게 권한 부여를 요청하세요.' },
          ].map((item, i) => (
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
    ? sections.filter((s) => s.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : sections;

  const currentSection = sections.find((s) => s.id === activeSection) || sections[0];

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="app-panel-dark relative overflow-hidden p-6 md:p-8">
        <div className="pointer-events-none absolute right-[-6rem] top-[-7rem] h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.18),transparent_70%)] blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-8rem] left-[12%] h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(255,190,120,0.18),transparent_72%)] blur-3xl" />
        <div className="relative">
          <div className="surface-badge border-white/12 bg-white/[0.14] text-white/90">
            <BookOpen className="h-3.5 w-3.5 text-[color:var(--accent-secondary)]" />
            User Manual v1.0
          </div>
          <h1 className="mt-6 text-[clamp(2rem,4vw,3.8rem)] font-semibold leading-[0.92] tracking-[-0.06em] text-white">
            DK Flow<br />사용자 매뉴얼
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/90 md:text-lg">
            프로젝트 관리 시스템의 모든 기능을 안내합니다. 아래 목차에서 원하는 섹션을 선택하세요.
          </p>
        </div>
      </section>

      {/* Body */}
      <section className="grid gap-6 xl:grid-cols-[280px_1fr]">
        {/* Sidebar TOC */}
        <div className="app-panel sticky top-[6.75rem] self-start overflow-hidden xl:max-h-[calc(100vh-8rem)]">
          <div className="border-b border-[var(--border-color)] p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="섹션 검색..."
                className="field-input !pl-9 py-2.5 text-sm"
              />
            </div>
          </div>
          <nav className="max-h-[calc(100vh-14rem)] overflow-y-auto p-3">
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
                  <span className="flex-1 truncate">{section.title}</span>
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
                const idx = sections.findIndex((s) => s.id === activeSection);
                if (idx > 0) { setActiveSection(sections[idx - 1].id); window.scrollTo({ top: 0, behavior: 'smooth' }); }
              }}
              disabled={sections.findIndex((s) => s.id === activeSection) === 0}
              className="rounded-full border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-5 py-2.5 text-sm font-medium text-[color:var(--text-secondary)] transition-all hover:bg-[color:var(--bg-tertiary)] disabled:opacity-40"
            >
              ← 이전
            </button>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-4 py-2.5 text-sm text-[color:var(--text-secondary)] transition-all hover:bg-[color:var(--bg-tertiary)]"
            >
              <ArrowUp className="h-4 w-4" /> 맨 위로
            </button>
            <button
              onClick={() => {
                const idx = sections.findIndex((s) => s.id === activeSection);
                if (idx < sections.length - 1) { setActiveSection(sections[idx + 1].id); window.scrollTo({ top: 0, behavior: 'smooth' }); }
              }}
              disabled={sections.findIndex((s) => s.id === activeSection) === sections.length - 1}
              className="rounded-full border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-5 py-2.5 text-sm font-medium text-[color:var(--text-secondary)] transition-all hover:bg-[color:var(--bg-tertiary)] disabled:opacity-40"
            >
              다음 →
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
