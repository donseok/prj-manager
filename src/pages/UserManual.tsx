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
  Bot,
  ClipboardList,
  CalendarCheck,
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
              '회원가입 버튼을 클릭하면 가입 승인 대기 상태로 전환됩니다.',
              '시스템 관리자가 승인하면 자동으로 로그인 가능 상태가 됩니다.',
            ]} />
            <div className="mt-4">
              <Tip type="warning">가입 후 관리자 승인이 필요합니다. 승인 대기 화면에서 10초마다 자동으로 승인 여부를 확인하며, 승인 시 자동으로 홈 화면으로 이동합니다.</Tip>
            </div>
          </SectionCard>
          <SectionCard title="운영 모드">
            <InfoTable headers={['모드', '설명']} rows={[
              ['온라인 모드 (Supabase)', '이메일 계정으로 로그인하며 서버에 데이터가 저장됩니다. 멀티 사용자와 동기화를 지원합니다.'],
              ['로컬 모드', '브라우저 localStorage에 데이터가 저장됩니다. 계정 없이 바로 사용 가능하며, 4개의 샘플 프로젝트가 제공됩니다.'],
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
              하단에 최근 작업한 프로젝트 카드가 표시됩니다. 카드를 클릭하면 해당 프로젝트의 대시보드로 바로 진입합니다. 각 프로젝트에는 자동으로 부여된 테마(톤)에 따라 고유한 색상과 아이콘이 적용됩니다.
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
          <SectionCard title="프로젝트 목록">
            <p className="mb-4 text-sm leading-6 text-[color:var(--text-secondary)]">프로젝트 목록 페이지에서 등록된 프로젝트를 탐색하고 관리할 수 있습니다:</p>
            <InfoTable headers={['기능', '설명']} rows={[
              ['상태 필터 탭', '전체 / 준비 / 진행 / 완료 탭으로 프로젝트를 상태별 필터링 (각 탭에 건수 표시)'],
              ['검색', '프로젝트 이름으로 실시간 검색'],
              ['컨텍스트 메뉴', '각 프로젝트 카드의 ⋮ 버튼으로 상태 변경(관리자) 및 삭제 가능'],
            ]} />
          </SectionCard>
          <SectionCard title="프로젝트 생성">
            <StepList steps={[
              '홈 화면의 새 프로젝트 시작 버튼 또는 프로젝트 목록의 새 프로젝트 버튼을 클릭합니다.',
              '프로젝트명(필수), 설명을 입력합니다.',
              '시작 방식을 선택합니다: 빈 프로젝트(기본) 또는 기존 프로젝트 복제.',
              '복제를 선택하면 원본 프로젝트의 WBS와 멤버 구성이 복사되고, 진행 상태와 실적은 초기화됩니다.',
              '시작일/종료일을 입력한 후 생성 버튼을 클릭합니다.',
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
              <Tip>프로젝트 상태는 기본적으로 WBS 작업 데이터를 기반으로 자동 계산됩니다. 설정 페이지에서 수동 모드로 전환하면 관리자가 직접 상태를 고정할 수 있습니다.</Tip>
            </div>
          </SectionCard>
          <SectionCard title="프로젝트 테마 (톤)">
            <p className="mb-4 text-sm leading-6 text-[color:var(--text-secondary)]">프로젝트 설명의 키워드에 따라 자동으로 시각 테마가 부여됩니다:</p>
            <InfoTable headers={['테마', '적용 기준']} rows={[
              ['Steel', '철강, 소재, 제조 관련 키워드'],
              ['Precision', '계측, 분석, 정밀 관련 키워드'],
              ['Digital', '디지털, IT, 소프트웨어 관련 키워드'],
              ['Creative', '디자인, 기획, 마케팅 관련 키워드'],
              ['Standard', '기본 테마 (키워드 없을 때)'],
            ]} />
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
              ['실적 공정율', '전체 프로젝트의 실적 진행률 (프로그레스 바 표시)'],
              ['계획 공정율', '전체 프로젝트의 계획 진행률'],
              ['진행중 작업', '현재 진행중 상태인 리프 작업 수'],
              ['완료 작업', '완료된 리프 작업 수'],
              ['리스크 작업', '지연된 작업 수 (지연 카드)'],
            ]} />
          </SectionCard>
          <SectionCard title="차트 섹션">
            <InfoTable headers={['차트', '설명']} rows={[
              ['상태별 분포', '대기/진행중/완료/보류 각 상태의 작업 수와 비율 (프로그레스 바 카드)'],
              ['담당자별 진행률', '각 담당자의 작업 완료/잔여 현황 (수평 막대 그래프)'],
              ['Phase별 진행률', '단계별 계획 vs 실적 공정율 비교 (막대 그래프)'],
              ['프로젝트 일정 요약', '시작일, 종료일, 일정 경과율, 총/경과/잔여일'],
              ['Phase 가중치 분포', '각 Phase의 가중치 비중 (도넛 차트)'],
            ]} />
          </SectionCard>
          <SectionCard title="작업 큐">
            <InfoTable headers={['큐', '설명']} rows={[
              ['지연 작업', '지연 일수와 함께 지연된 작업 목록 (상위 5개)'],
              ['금주 작업', '이번 주에 진행 예정인 작업'],
              ['차주 작업', '다음 주에 진행 예정인 작업'],
              ['최근 완료 작업', '가장 최근에 완료된 작업 목록'],
            ]} />
          </SectionCard>
          <SectionCard title="현황 보고서">
            <p className="mb-4 text-sm leading-6 text-[color:var(--text-secondary)]">대시보드 상단의 현황 보고서 버튼을 클릭하면 Word(.docx) 형식의 프로젝트 현황 보고서를 자동 생성합니다.</p>
            <InfoTable headers={['보고서 섹션', '포함 내용']} rows={[
              ['표지', '프로젝트명, 상태, 생성일, 보고서 생성일'],
              ['프로젝트 개요', '기본 정보 테이블'],
              ['진행 지표', '계획/실적 공정율, 상태별 작업 수'],
              ['Phase별 현황', '단계별 진행률 비교 테이블'],
              ['담당자별 현황', '멤버별 작업 분배 테이블'],
              ['지연/금주/차주 작업', '상세 작업 목록'],
            ]} />
          </SectionCard>
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
            ]} />
            <div className="mt-4">
              <Tip>상위 작업(Phase, Activity)의 일정, 공정율, 상태는 하위 작업을 기반으로 자동 계산됩니다. 직접 수정해도 다음 저장 시 하위 작업 기준으로 다시 계산됩니다.</Tip>
            </div>
          </SectionCard>
          <SectionCard title="인라인 편집 (엑셀 스타일)">
            <p className="mb-4 text-sm leading-6 text-[color:var(--text-secondary)]">테이블의 각 셀을 클릭하면 바로 편집할 수 있습니다:</p>
            <InfoTable headers={['컬럼', '편집 방식']} rows={[
              ['작업명', '클릭 후 텍스트 입력 → Enter로 확정'],
              ['산출물', '클릭 후 텍스트 입력'],
              ['담당자', '드롭다운에서 멤버 선택 (목록에 없으면 새 멤버를 바로 생성 가능)'],
              ['가중치', '클릭 후 숫자 입력 (소수점 지원)'],
              ['계획/실적 일정', '날짜 선택기로 입력'],
              ['계획/실적 공정율', '클릭 후 0~100 숫자 입력'],
              ['상태', '드롭다운에서 선택 (대기/진행중/완료/보류)'],
            ]} />
          </SectionCard>
          <SectionCard title="필드 자동 연동">
            <p className="mb-4 text-sm leading-6 text-[color:var(--text-secondary)]">리프(말단) 작업에서 필드 값을 변경하면 관련 필드가 자동으로 동기화됩니다:</p>
            <InfoTable headers={['변경 필드', '자동 반영']} rows={[
              ['상태 → 완료', '실적 공정율 100%, 실적 종료일 자동 설정'],
              ['상태 → 진행중', '실적 시작일 자동 설정 (미설정 시)'],
              ['상태 → 대기', '실적 공정율, 실적 시작/종료일 초기화'],
              ['실적 공정율 100%', '상태 → 완료로 자동 변경'],
              ['실적 종료일 설정', '상태 → 완료, 공정율 100%'],
            ]} />
          </SectionCard>
          <SectionCard title="드래그 앤 드롭">
            <p className="text-sm leading-6 text-[color:var(--text-secondary)]">
              작업 행 좌측의 그립 아이콘을 드래그하여 작업 순서를 변경하거나 다른 상위 작업으로 이동할 수 있습니다. 드롭 위치에 따라 위/아래 이동 또는 하위 작업으로 편입됩니다.
            </p>
          </SectionCard>
          <SectionCard title="도구 모음">
            <InfoTable headers={['기능', '설명']} rows={[
              ['Phase 추가', '최상위 Phase 작업 추가'],
              ['Activity 추가', '마지막 Phase 하위에 Activity 추가 (Phase 존재 시 활성)'],
              ['초안 생성', '템플릿 기반 WBS 초안을 자동 생성 (아래 별도 설명 참조)'],
              ['일정계산', '작업 기간과 선후행 관계를 기반으로 계획 일정을 자동 산출'],
              ['선후행', '같은 상위 작업 내 리프 작업들을 순차적으로 연결'],
              ['자동채움', '산출물 제안, 담당자 라운드로빈 배정, 가중치 자동 계산을 한 번에 실행'],
              ['실적 입력', '리프 작업의 실적 공정율을 일괄 입력하는 빠른 입력 화면'],
              ['주간보고', '주간 현황 보기 (아래 별도 설명 참조)'],
              ['전체 펼침 / 전체 접기', '모든 작업 트리 확장/축소'],
              ['저장', '수동 저장 (Ctrl+S)'],
              ['되돌리기 / 다시하기', 'Ctrl+Z / Ctrl+Y (최대 50단계)'],
              ['엑셀 다운로드', 'WBS를 엑셀(.xlsx) 파일로 내보내기'],
              ['크게 보기', 'WBS 테이블을 전체 화면 팝업으로 보기'],
            ]} />
          </SectionCard>
          <SectionCard title="WBS 초안 생성">
            <p className="mb-4 text-sm leading-6 text-[color:var(--text-secondary)]">도구 모음의 초안 생성 버튼을 클릭하면 템플릿 기반으로 WBS를 자동 생성할 수 있습니다:</p>
            <InfoTable headers={['기능', '설명']} rows={[
              ['템플릿 선택', '4종 기본 템플릿 (철강 프로젝트, 웹 런칭, 모바일 앱, 사내 시스템) 중 선택'],
              ['스마트 매칭', '프로젝트 설명을 입력하면 가장 적합한 템플릿을 자동 추천'],
              ['템플릿 미리보기', '선택한 템플릿의 Phase 수, 작업 수, 대상 분야를 사전 확인'],
            ]} />
            <div className="mt-4">
              <Tip type="warning">초안 생성 시 기존 작업이 있으면 덮어쓰여집니다. 중요한 데이터가 있는 경우 먼저 엑셀로 내보내기하세요.</Tip>
            </div>
          </SectionCard>
          <SectionCard title="주간보고">
            <p className="mb-4 text-sm leading-6 text-[color:var(--text-secondary)]">WBS 도구 모음의 주간보고 버튼을 클릭하면 주간 현황을 확인할 수 있습니다:</p>
            <InfoTable headers={['섹션', '내용']} rows={[
              ['금주 실적', '이번 주 진행/완료 작업 목록'],
              ['금주 완료', '이번 주에 완료된 작업'],
              ['차주 계획', '다음 주 예정 작업 목록'],
              ['지연 작업', '지연된 작업과 지연 일수'],
            ]} />
            <div className="mt-4">
              <Tip>주간보고는 스냅샷을 저장하여 주차별 비교가 가능합니다. 전주 대비 완료 수, 공정율 변화량, 지연 변화가 델타 지표로 표시됩니다.</Tip>
            </div>
          </SectionCard>
          <Tip>WBS에서의 모든 변경사항은 자동 저장됩니다. 입력 후 약 0.7초 뒤 자동으로 서버에 반영됩니다. 하단 상태 표시줄에서 저장 상태와 최종 저장 시간을 확인할 수 있습니다.</Tip>
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
              ['마감 임박', '종료일이 가장 가까운 미완료 작업 5개 목록 (초과 시 빨간색, 임박 시 주황색 표시)'],
              ['담당자별 워크로드', '각 담당자의 활성 작업 수와 지연 작업 수를 상위 6명까지 표시'],
              ['작업 포커스 카드', '선택한 작업의 상세 정보 (기간, 공정율, 지연 등)'],
              ['필터/검색 바', '작업 검색, 상태 필터, 뷰 옵션 설정'],
              ['간트 차트', '좌측 작업 목록 + 우측 타임라인 바'],
            ]} />
          </SectionCard>
          <SectionCard title="작업 포커스 카드 & 빠른 편집">
            <p className="mb-4 text-sm leading-6 text-[color:var(--text-secondary)]">간트 차트에서 작업을 클릭하면 포커스 카드가 표시되고, 직접 편집할 수 있습니다:</p>
            <InfoTable headers={['편집 가능 필드', '설명']} rows={[
              ['작업명, 산출물', '텍스트 입력'],
              ['담당자', '드롭다운 선택'],
              ['상태', '드롭다운 선택'],
              ['계획 시작/종료', '날짜 선택기'],
              ['실적 시작/종료', '날짜 선택기'],
              ['계획/실적 공정율', '0~100 숫자 입력'],
            ]} />
            <div className="mt-4">
              <Tip>간트 차트에서 편집한 내용도 자동 저장됩니다. WBS 페이지에 가지 않아도 빠르게 작업 정보를 업데이트할 수 있습니다.</Tip>
            </div>
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
              ['보기 범위', '4주 / 8주 / 12주 중 선택'],
              ['행 밀도', 'Compact (조밀) / Comfortable (여유)'],
              ['주말 강조', '타임라인에서 주말 영역 강조 On/Off'],
            ]} />
          </SectionCard>
          <SectionCard title="타임라인 내비게이션">
            <InfoTable headers={['버튼', '설명']} rows={[
              ['← / →', '이전/다음 기간으로 타임라인 이동'],
              ['오늘', '오늘 날짜로 타임라인 이동'],
              ['일정에 맞춤', '모든 작업 일정 범위에 맞게 자동 이동'],
            ]} />
          </SectionCard>
          <SectionCard title="차트 범례">
            <InfoTable headers={['색상', '의미']} rows={[
              ['계획 바 (진한 청록)', '계획 일정 범위'],
              ['실적 바 (밝은 초록)', '실적 일정 범위'],
              ['오늘선 (빨간 세로선)', '현재 날짜'],
            ]} />
          </SectionCard>
          <SectionCard title="내보내기">
            <p className="text-sm leading-6 text-[color:var(--text-secondary)]">
              간트 차트 페이지에서 엑셀 다운로드 버튼을 클릭하면 현재 필터가 적용된 상태의 간트 데이터를 엑셀(.xlsx) 파일로 내보낼 수 있습니다. 크게 보기 버튼으로 차트를 전체 화면으로 확대할 수도 있습니다.
            </p>
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
            <p className="mb-4 text-sm leading-6 text-[color:var(--text-secondary)]">멤버 추가 팝업에서 두 가지 방법으로 멤버를 추가할 수 있습니다:</p>
            <InfoTable headers={['방법', '설명']} rows={[
              ['개별 입력', '이름과 역할을 지정하여 한 명씩 추가'],
              ['일괄 붙여넣기', '여러 이름을 줄바꿈으로 구분하여 한 번에 추가 (역할은 자동으로 "멤버"로 설정)'],
            ]} />
          </SectionCard>
          <SectionCard title="역할 유형">
            <InfoTable headers={['역할', '권한']} rows={[
              ['소유자', '모든 권한 (프로젝트 생성자에게 자동 부여)'],
              ['관리자', '대부분의 관리 권한'],
              ['멤버', '작업 수행 및 업데이트'],
              ['뷰어', '조회만 가능 (편집 불가)'],
            ]} />
          </SectionCard>
          <SectionCard title="멤버 정보 편집">
            <InfoTable headers={['기능', '방법']} rows={[
              ['이름 수정', '연필 아이콘 클릭 → 수정 → Enter 또는 ✓ 클릭'],
              ['역할 변경', '역할 드롭다운에서 변경'],
              ['멤버 삭제', '휴지통 아이콘 클릭 → 확인'],
            ]} />
          </SectionCard>
          <SectionCard title="멤버 현황">
            <InfoTable headers={['지표', '설명']} rows={[
              ['전체 인원', '프로젝트에 등록된 총 멤버 수'],
              ['관리자', '소유자 + 관리자 역할 멤버 수'],
              ['기여자', '멤버 역할 인원 수'],
            ]} />
          </SectionCard>
          <Tip>멤버 정보 변경은 자동 저장됩니다. WBS의 담당자 드롭다운에는 여기에 등록된 멤버 목록이 표시됩니다.</Tip>
        </div>
      ),
    },
    {
      id: 'attendance',
      title: '근태현황',
      icon: <CalendarCheck className="h-5 w-5" />,
      content: (
        <div className="space-y-6">
          <SectionCard title="근태현황 개요">
            <p className="mb-4 text-sm leading-6 text-[color:var(--text-secondary)]">
              프로젝트 멤버의 출결 상태를 캘린더 뷰와 리스트 뷰로 관리합니다.
              평일은 기본 출근 상태이며, 연차/반차/출장 등 변경이 필요한 경우에만 근태를 등록합니다.
            </p>
            <InfoTable headers={['항목', '설명']} rows={[
              ['캘린더 뷰', '월간 달력 형태로 멤버별 근태를 한눈에 확인 (일요일~토요일)'],
              ['리스트 뷰', '테이블 형태로 날짜/담당자/유형/사유를 목록으로 확인'],
              ['월간 요약', '페이지 하단에 멤버별 근태유형 카운트 테이블 표시'],
            ]} />
          </SectionCard>
          <SectionCard title="근태 등록">
            <StepList steps={[
              '근태현황 페이지에서 "근태 등록" 버튼을 클릭하거나, 캘린더의 날짜 셀을 클릭합니다.',
              '담당자를 선택합니다.',
              '날짜를 지정합니다. 여러 날을 한 번에 등록하려면 "범위 선택"을 체크합니다.',
              '근태유형을 선택합니다 (기본값: 출근).',
              '필요 시 사유/비고를 입력합니다.',
              '"등록" 버튼을 클릭하면 즉시 저장됩니다.',
            ]} />
            <div className="mt-4">
              <Tip>범위 선택 시 주말(토/일)은 자동으로 제외됩니다.</Tip>
            </div>
          </SectionCard>
          <SectionCard title="근태유형">
            <InfoTable headers={['유형', '설명', '색상']} rows={[
              ['출근', '정상 출근', '녹색'],
              ['연차', '연차 휴가', '파란색'],
              ['오전반차', '오전 반일 휴가', '하늘색'],
              ['오후반차', '오후 반일 휴가', '하늘색'],
              ['병가', '질병으로 인한 휴가', '빨간색'],
              ['출장', '업무 출장', '보라색'],
              ['지각', '지각 출근', '주황색'],
              ['조퇴', '조기 퇴근', '주황색'],
              ['결근', '무단 결근', '진빨간색'],
            ]} />
          </SectionCard>
          <SectionCard title="근태 수정 및 삭제">
            <InfoTable headers={['기능', '방법']} rows={[
              ['수정', '캘린더 뷰에서 근태 항목 클릭 또는 리스트 뷰에서 편집 아이콘 클릭 → 모달에서 수정 후 저장'],
              ['삭제', '리스트 뷰에서 휴지통 아이콘 클릭 → 확인 팝업에서 삭제'],
            ]} />
          </SectionCard>
          <SectionCard title="권한별 기능">
            <InfoTable headers={['역할', '조회', '본인 근태 등록/수정', '전체 근태 관리']} rows={[
              ['소유자/관리자', '가능', '가능', '가능'],
              ['멤버', '가능', '가능', '불가'],
              ['뷰어', '가능', '불가', '불가'],
            ]} />
          </SectionCard>
          <SectionCard title="주간보고서 연동">
            <p className="text-sm leading-6 text-[color:var(--text-secondary)]">
              WBS 페이지에서 주간보고를 생성하면, 해당 주의 근태현황이 자동으로 포함됩니다.
              요약 현황 탭에서 멤버별 요일(월~금) 근태와 소계를 확인할 수 있습니다.
            </p>
          </SectionCard>
          <Tip>대시보드에서도 "금주 근태현황" 위젯으로 오늘 등록된 근태와 주간 통계를 빠르게 확인할 수 있습니다.</Tip>
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
          <SectionCard title="프로젝트 상태 관리">
            <p className="mb-4 text-sm leading-6 text-[color:var(--text-secondary)]">프로젝트 상태를 자동 또는 수동으로 관리할 수 있습니다:</p>
            <InfoTable headers={['정책', '설명']} rows={[
              ['자동 상태 동기화 (기본)', 'WBS와 간트에서 작업을 저장하면 프로젝트 상태가 자동으로 계산됩니다. (모든 작업 완료 → 완료, 진행중 작업 존재 → 진행중, 그 외 → 준비)'],
              ['수동 상태 고정', '관리자가 직접 프로젝트 상태를 준비/진행중/완료 중 하나로 고정합니다. 작업 변경이 상태를 덮어쓰지 않습니다.'],
            ]} />
            <div className="mt-4">
              <Tip type="warning">상태 정책 변경 및 수동 상태 선택은 시스템 관리자(admin) 권한이 필요합니다.</Tip>
            </div>
          </SectionCard>
          <SectionCard title="데이터 관리">
            <InfoTable headers={['기능', '설명']} rows={[
              ['WBS 엑셀 내보내기', '현재 WBS를 엑셀 파일로 다운로드'],
              ['엑셀 가져오기', '엑셀 파일에서 WBS 데이터를 불러오기 (.xlsx, .xls)'],
            ]} />
            <div className="mt-4">
              <Tip type="warning">엑셀 가져오기 시 기존 작업이 있으면 덮어쓰기 확인 대화상자가 표시됩니다. 중요한 데이터는 미리 엑셀로 내보내기하여 백업하세요.</Tip>
            </div>
          </SectionCard>
          <SectionCard title="위험 영역 (삭제 권한 필요)">
            <Tip type="warning">프로젝트 삭제 시 모든 관련 데이터(작업, 멤버 등)가 영구 삭제됩니다. 이 작업은 되돌릴 수 없습니다. 프로젝트 소유자만 삭제할 수 있습니다.</Tip>
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
            <Tip type="warning">이 메뉴는 시스템 관리자(admin) 권한 사용자에게만 표시됩니다. 사이드바 또는 헤더 사용자 메뉴에서 접근합니다.</Tip>
          </SectionCard>
          <SectionCard title="요약 카드">
            <p className="mb-4 text-sm leading-6 text-[color:var(--text-secondary)]">페이지 상단에 4개의 요약 카드가 표시됩니다:</p>
            <InfoTable headers={['카드', '설명']} rows={[
              ['전체 사용자', '시스템에 등록된 총 사용자 수'],
              ['승인 대기', '가입 후 관리자 승인을 기다리는 사용자 수'],
              ['활성', '정상적으로 사용 중인 사용자 수'],
              ['정지', '사용이 정지된 사용자 수'],
            ]} />
          </SectionCard>
          <SectionCard title="사용자 목록">
            <p className="mb-4 text-sm leading-6 text-[color:var(--text-secondary)]">시스템에 가입한 모든 사용자를 관리할 수 있습니다. 이름이나 이메일로 검색하고, 탭으로 상태별 필터링이 가능합니다.</p>
            <InfoTable headers={['탭', '설명']} rows={[
              ['전체', '모든 사용자 표시'],
              ['승인대기', '가입 후 승인을 기다리는 사용자'],
              ['활성', '정상적으로 사용 중인 사용자'],
              ['정지', '사용이 정지된 사용자'],
            ]} />
          </SectionCard>
          <SectionCard title="계정 상태 관리">
            <InfoTable headers={['상태', '설명', '가능한 동작']} rows={[
              ['승인대기 (Pending)', '회원가입 후 관리자 승인 대기', '승인 → 활성 / 거절 → 정지'],
              ['활성 (Active)', '정상 사용 가능', '정지 → 정지'],
              ['정지 (Suspended)', '사용 불가 상태', '복원 → 활성'],
            ]} />
          </SectionCard>
          <SectionCard title="시스템 역할 관리">
            <InfoTable headers={['역할', '권한']} rows={[
              ['user (일반)', '프로젝트 생성/참여, WBS/간트 작업'],
              ['admin (관리자)', '일반 권한 + 사용자 관리, 프로젝트 상태 수동 변경'],
            ]} />
            <div className="mt-4">
              <Tip>사용자 목록에서 각 사용자의 역할을 user ↔ admin 간 전환할 수 있습니다. 자기 자신의 역할은 변경할 수 없습니다.</Tip>
            </div>
          </SectionCard>
          <SectionCard title="승인대기 알림">
            <p className="text-sm leading-6 text-[color:var(--text-secondary)]">
              승인 대기 중인 사용자가 있으면 헤더의 프로필 아이콘에 빨간 배지로 대기 수가 표시됩니다. 사이드바의 사용자 관리 메뉴에도 배지가 나타납니다.
            </p>
          </SectionCard>
        </div>
      ),
    },
    {
      id: 'chatbot',
      title: 'DK Bot (채팅 어시스턴트)',
      icon: <Bot className="h-5 w-5" />,
      content: (
        <div className="space-y-6">
          <SectionCard title="개요">
            <p className="text-sm leading-6 text-[color:var(--text-secondary)]">
              화면 우하단의 DK Bot 버튼을 클릭하면 프로젝트 데이터를 기반으로 질문에 답변하는 채팅 어시스턴트가 열립니다.
              현재 프로젝트의 작업, 멤버, 일정 데이터를 분석하여 자연어로 응답합니다.
            </p>
          </SectionCard>
          <SectionCard title="사용 방법">
            <StepList steps={[
              '우하단의 DK Bot 아이콘을 클릭합니다.',
              '추천 질문 칩을 선택하거나 직접 질문을 입력합니다.',
              'Enter 키 또는 전송 버튼으로 질문을 보냅니다.',
              '대화 내용을 초기화하려면 리셋 버튼을 클릭합니다.',
            ]} />
          </SectionCard>
          <SectionCard title="추천 질문 예시">
            <InfoTable headers={['질문', '응답 내용']} rows={[
              ['"이번 주 일정은?"', '이번 주에 진행 예정인 작업 목록'],
              ['"지연 작업 알려줘"', '지연된 작업과 지연 일수'],
              ['"팀원 현황"', '멤버별 작업 배정 현황'],
              ['"프로젝트 진행률"', '전체 프로젝트 진행률 요약'],
            ]} />
          </SectionCard>
          <Tip>DK Bot은 현재 선택된 프로젝트의 데이터를 기반으로 응답합니다. 프로젝트를 전환하면 인사말과 컨텍스트가 자동으로 업데이트됩니다.</Tip>
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
              헤더 영역의 해/달 아이콘 버튼으로 테마를 전환할 수 있습니다. 다크 모드와 라이트 모드 간 즉시 전환되며, 설정은 브라우저에 저장됩니다. 로그인 화면에서도 테마를 전환할 수 있습니다.
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
            ['Ctrl/⌘ + S', '수동 저장', 'WBS'],
            ['Ctrl/⌘ + Z', '되돌리기 (Undo)', 'WBS'],
            ['Ctrl/⌘ + Y', '다시하기 (Redo)', 'WBS'],
            ['Enter', '셀 편집 확정', 'WBS / 간트'],
            ['Escape', '셀 편집 취소', 'WBS / 간트'],
            ['Shift + Enter', '텍스트 필드 줄바꿈', 'WBS'],
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
              ['주간보고 엑셀', 'WBS 페이지 → 주간보고 팝업', '.xlsx'],
            ]} />
          </SectionCard>
          <SectionCard title="가져오기 기능">
            <p className="text-sm leading-6 text-[color:var(--text-secondary)]">
              설정 페이지 → 엑셀 가져오기 버튼으로 <code className="rounded-lg bg-[color:var(--bg-tertiary)] px-2 py-0.5 text-xs font-medium">.xlsx</code> 또는 <code className="rounded-lg bg-[color:var(--bg-tertiary)] px-2 py-0.5 text-xs font-medium">.xls</code> 파일을 업로드하여 WBS 데이터를 불러올 수 있습니다.
            </p>
          </SectionCard>
          <SectionCard title="자동 저장">
            <InfoTable headers={['대상', '동작']} rows={[
              ['WBS 작업', '변경 후 약 0.7초 뒤 자동 저장'],
              ['멤버 정보', '변경 후 약 0.7초 뒤 자동 저장'],
              ['프로젝트 설정', '저장 버튼 클릭 시 수동 저장'],
            ]} />
            <div className="mt-4">
              <Tip>자동 저장 상태는 페이지 하단 상태바에 표시됩니다: 대기중 → 저장중 → 저장완료 (최종 저장 시간 포함)</Tip>
            </div>
          </SectionCard>
        </div>
      ),
    },
    {
      id: 'permissions',
      title: '권한 체계',
      icon: <ClipboardList className="h-5 w-5" />,
      content: (
        <div className="space-y-6">
          <SectionCard title="시스템 역할 vs 프로젝트 역할">
            <p className="mb-4 text-sm leading-6 text-[color:var(--text-secondary)]">DK Flow는 두 가지 역할 체계를 사용합니다:</p>
            <InfoTable headers={['구분', '범위', '역할']} rows={[
              ['시스템 역할', '전체 시스템', 'admin (관리자) / user (일반)'],
              ['프로젝트 역할', '개별 프로젝트', '소유자 / 관리자 / 멤버 / 뷰어'],
            ]} />
          </SectionCard>
          <SectionCard title="시스템 관리자 전용 기능">
            <InfoTable headers={['기능', '설명']} rows={[
              ['사용자 관리 페이지', '가입 승인, 계정 정지/복원, 역할 변경'],
              ['프로젝트 상태 수동 변경', '설정 페이지에서 수동 상태 고정/해제'],
            ]} />
          </SectionCard>
          <SectionCard title="프로젝트 역할별 권한">
            <InfoTable headers={['기능', '소유자', '관리자', '멤버', '뷰어']} rows={[
              ['작업 편집', 'O', 'O', 'O', 'X'],
              ['멤버 관리', 'O', 'O', 'X', 'X'],
              ['설정 변경', 'O', 'O', 'X', 'X'],
              ['프로젝트 삭제', 'O', 'X', 'X', 'X'],
            ]} />
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
            ['가중치', '작업의 상대적 중요도/비중 (숫자)'],
            ['공정율', '작업 진행률 (0~100%)'],
            ['계획 공정율', '계획 기준 공정 진행률'],
            ['실적 공정율', '실제 수행 기준 공정 진행률'],
            ['달성율', '계획 대비 실적 비율'],
            ['진척기준일', '공정율 계산의 기준이 되는 날짜'],
            ['리프 작업', '하위 작업이 없는 말단 작업 (실제 작업 단위)'],
            ['선후행', '작업 간 순서 의존 관계 (선행 작업 완료 후 후행 작업 시작)'],
            ['스냅샷', '특정 시점의 프로젝트 상태를 저장한 기록 (주간보고용)'],
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
            { q: '회원가입 후 바로 사용할 수 없나요?', a: '온라인 모드에서는 시스템 관리자의 승인이 필요합니다. 가입 후 승인 대기 화면에서 자동으로 승인 여부를 확인하며, 승인 시 자동으로 홈 화면으로 이동합니다.' },
            { q: '작업이 자동으로 저장되나요?', a: 'WBS와 멤버 페이지에서의 변경사항은 약 0.7초 후 자동 저장됩니다. 프로젝트 설정에서의 기본 정보 변경은 저장 버튼을 눌러야 합니다.' },
            { q: '상위 작업의 공정율은 어떻게 계산되나요?', a: '상위 작업의 공정율은 하위 작업의 가중치와 공정율을 조합하여 자동 계산됩니다. 직접 수정해도 다음 저장 시 재계산됩니다.' },
            { q: '프로젝트 상태를 수동으로 변경하려면?', a: '프로젝트 설정 > 프로젝트 상태 관리에서 "수동 상태 고정"을 선택한 후, 원하는 상태를 클릭합니다. 시스템 관리자 권한이 필요합니다.' },
            { q: '엑셀 가져오기 시 기존 데이터는 어떻게 되나요?', a: '기존 작업이 있는 경우 덮어쓰기 확인 대화상자가 표시됩니다. "확인"을 클릭하면 기존 데이터가 교체됩니다.' },
            { q: '프로젝트 삭제 후 복구할 수 있나요?', a: '아니요. 프로젝트 삭제는 영구적이며 되돌릴 수 없습니다. 삭제 전에 WBS 엑셀 내보내기로 데이터를 백업하세요.' },
            { q: 'DK Bot은 AI인가요?', a: 'DK Bot은 프로젝트 데이터를 분석하는 키워드 기반 어시스턴트입니다. 외부 AI API를 사용하지 않으며, 현재 프로젝트의 작업/멤버/일정 데이터를 기반으로 응답합니다.' },
            { q: '뷰어 역할은 어떤 제한이 있나요?', a: '뷰어는 모든 데이터를 조회할 수 있지만 작업 편집, 멤버 관리, 설정 변경은 할 수 없습니다. 대시보드와 간트 차트 조회, 보고서 다운로드는 가능합니다.' },
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
            User Manual v2.0
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
