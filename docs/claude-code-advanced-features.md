# Claude Code 고급 기능 가이드

> 출처: [요즘IT - Boris Cherny의 Claude Code 팁](https://yozm.wishket.com/magazine/detail/3690/)
> 발표일: 2026-04-06

---

## 목차

1. [Codex 플러그인 — Claude Code에서 OpenAI Codex 사용하기](#1-codex-플러그인)
2. [Remote Control — 기기 간 세션 이동](#2-remote-control)
3. [Loop — 반복 자동화](#3-loop)
4. [Schedule — 크론 기반 원격 에이전트](#4-schedule)
5. [BTW — 작업 중 사이드 쿼리](#5-btw)
6. [Batch — 대규모 병렬 처리](#6-batch)
7. [Harness 플러그인 — 에이전트 팀 아키텍처](#7-harness-플러그인)
8. [Dev 플러그인 — WBS 기반 TDD 자동화](#8-dev-플러그인)

---

## 1. Codex 플러그인

> **Claude Code 안에서 OpenAI Codex를 호출하여 코드 리뷰나 문제 해결을 위임하는 플러그인**

### 왜 쓰는가?

- Claude가 작성한 코드를 **다른 AI 모델(Codex/GPT-5.4)이 리뷰**하면 단일 모델의 사각지대를 보완
- 버그 조사가 막혔을 때 Codex에 **위임(rescue)** 하여 다른 시각으로 분석
- **리뷰 게이트**: Codex 리뷰 통과 전까지 변경사항 최종화를 차단하는 품질 게이트

### 설치

```bash
# 1. 마켓플레이스 추가
/plugin marketplace add openai/codex-plugin-cc

# 2. 플러그인 설치
/plugin install codex@openai-codex

# 3. 플러그인 리로드
/reload-plugins

# 4. 셋업 (Codex CLI 설치 여부 확인 + 인증)
/codex:setup
```

### 주요 커맨드

| 커맨드 | 설명 | 예시 |
|--------|------|------|
| `/codex:review` | 로컬 git 변경사항에 대한 표준 코드 리뷰 | `/codex:review --background` |
| `/codex:adversarial-review` | 도전적/적대적 관점의 심층 리뷰 | `/codex:adversarial-review` |
| `/codex:rescue` | 버그 조사/문제 해결을 Codex에 위임 | `/codex:rescue 이 메모리 누수 원인 찾아줘` |
| `/codex:status` | 백그라운드 작업 상태 조회 | `/codex:status` |
| `/codex:result` | 완료된 작업 결과 확인 | `/codex:result` |
| `/codex:cancel` | 진행 중인 작업 취소 | `/codex:cancel` |

### 리뷰 게이트 활성화

```bash
/codex:setup --enable-review-gate
```

활성화하면 Claude가 작업 완료 시 자동으로 Codex 리뷰를 트리거하고, 리뷰 통과 전까지 최종화를 차단합니다.

### adversarial-review vs review

| 항목 | `/codex:review` | `/codex:adversarial-review` |
|------|-----------------|---------------------------|
| 관점 | 표준 코드 리뷰 (버그, 스타일) | 도전적/적대적 관점 (설계 결정 의문 제기) |
| 초점 | 코드 품질, 정확성 | 가정 검증, 트레이드오프, 대안 탐색 |
| 커스텀 | 불가 (네이티브 리뷰 전용) | 포커스 텍스트 추가 가능 |

```bash
# 적대적 리뷰 (race condition 집중)
/codex:adversarial-review --background look for race conditions
```

### rescue 활용 예시

```bash
# 기본 실행 (포그라운드)
/codex:rescue 이 테스트가 왜 실패하는지 분석해줘

# 백그라운드 실행
/codex:rescue --background DB 커넥션 풀 고갈 원인 조사

# 이전 스레드 이어서
/codex:rescue --resume 앞에서 찾은 원인 기반으로 수정해줘

# 새 스레드로 시작
/codex:rescue --fresh 처음부터 다시 조사해줘

# 모델/노력 수준 지정
/codex:rescue --model spark --effort high 성능 병목 분석
```

### 내부 프롬프트 구조 (GPT-5.4 Prompting Skill)

Codex에 작업을 위임할 때 내부적으로 XML 태그 기반 프롬프트를 구성합니다:

```xml
<task>빌드 실패 원인 진단</task>
<compact_output_contract>
  1. 가장 가능성 높은 root cause
  2. 근거(evidence)
  3. 최소한의 안전한 다음 단계
</compact_output_contract>
<verification_loop>root cause가 근거와 일치하는지 검증</verification_loop>
```

---

## 2. Remote Control

> **진행 중인 세션을 모바일, 웹, 데스크탑 간에 이어서 사용**

### 사용법

```bash
# 클라우드 세션을 로컬 터미널로 가져오기
claude --teleport

# 로컬 세션을 폰이나 웹에서 제어
/remote-control
```

### 활용 시나리오

1. **퇴근길**: 터미널에서 작업하다가 `/remote-control` → 폰에서 진행상황 모니터링 및 추가 지시
2. **카페에서**: 웹 앱에서 작업하다가 `claude --teleport` → 터미널에서 이어서 작업
3. **권한 승인**: 훅에서 권한 요청이 오면 모바일에서 승인/거부 가능

### 설정 (권장)

`/config`에서 "Enable Remote Control for all sessions" 활성화하면 매번 `/remote-control` 입력 없이도 항상 원격 제어 가능

---

## 3. Loop

> **특정 작업을 주기적으로 자동 반복 실행 (최대 1주일)**

Boris Cherny는 이것을 **"가장 강력한 기능"** 이라고 평가했습니다.

### 사용법

```bash
/loop [간격] [실행할 커맨드/프롬프트]
```

- 간격 미지정 시 기본 10분
- 사용자가 자리를 비워도 Claude가 계속 작업 수행

### 실전 활용 예시

| 커맨드 | 용도 |
|--------|------|
| `/loop 5m /babysit` | 5분마다 코드 리뷰, 자동 리베이스, PR 관리 |
| `/loop 30m /slack-feedback` | 30분마다 Slack 피드백 기반 PR 자동 생성 |
| `/loop /post-merge-sweeper` | 놓친 코드 리뷰 코멘트 처리 PR 자동 생성 |
| `/loop 1h /pr-pruner` | 1시간마다 오래되거나 불필요한 PR 자동 종료 |
| `/loop 10m /codex:review` | 10분마다 변경사항 자동 리뷰 |

### 핵심 인사이트

> "이 기능들은 대부분 Claude를 혼자 돌아가게 만드는 것들"
> — Boris Cherny

---

## 4. Schedule

> **크론 스케줄 기반으로 원격 에이전트(트리거)를 자동 실행**

Loop가 **세션 내 반복**이라면, Schedule은 **세션 외부에서 정해진 시간에 자동 실행**되는 원격 에이전트입니다.

### 사용법

```bash
# 스케줄 생성/관리
/schedule

# 스케줄 목록 확인
/schedule list

# 특정 스케줄 즉시 실행
/schedule run <trigger-name>
```

### Loop vs Schedule 비교

| 항목 | `/loop` | `/schedule` |
|------|---------|-------------|
| 실행 위치 | 현재 세션 내부 | 원격 (세션 불필요) |
| 지속 기간 | 세션 유지 중 (최대 1주) | 영구 (삭제 전까지) |
| 트리거 | 시간 간격 (5m, 1h) | 크론 표현식 |
| 용도 | 실시간 모니터링/관리 | 정기 자동화 작업 |

### 실제 활용 사례

스케줄된 태스크는 `~/.claude/scheduled-tasks/` 디렉토리에 SKILL.md로 저장됩니다:

```
~/.claude/scheduled-tasks/
├── daily-economic-news-brief/   # 매일 경제 뉴스 자동 수집 → 마크다운/HTML 리포트
│   └── SKILL.md
└── ai/                          # 매일 AI/LLM 뉴스 자동 수집 → 영향도 분석
    └── SKILL.md
```

- 여러 소스에서 뉴스 수집 → 중요도 기반 큐레이션 → 마크다운+HTML 리포트 생성
- 매일 자동 실행되어 프로젝트 디렉토리에 날짜별 파일 저장

---

## 5. BTW

> **작업 중인 에이전트의 흐름을 끊지 않고 빠른 질문을 던지는 사이드 쿼리 기능**

### 사용법

Claude가 긴 작업을 수행 중일 때, 별도의 중단 없이 "btw..." 형태로 질문을 끼워넣을 수 있습니다.

### 활용 시나리오

- Claude가 리팩토링 중일 때: "btw, 이 함수의 원래 작성자가 누구야?"
- 빌드 대기 중일 때: "btw, 다음 스프린트 일정 알려줘"
- 에이전트가 이미 작업 중이므로 **흐름을 중단하지 않고 빠르게 답변** 받음

---

## 6. Batch

> **작업 범위를 분석한 후 수십~수천 개의 워크트리 에이전트에 분배하여 동시 처리**

### 개념

1. 전체 작업 범위를 먼저 파악
2. 독립적인 단위로 분해
3. 각 단위를 **별도의 워크트리(git worktree)** 에서 병렬 실행
4. 결과를 통합

### 활용 시나리오

- **대규모 코드 마이그레이션**: API v1 → v2 전환을 파일별로 병렬 처리
- **일괄 리팩토링**: 수백 개 파일의 패턴 일괄 변경
- **테스트 생성**: 모든 모듈에 대해 동시에 테스트 케이스 생성

### 관련 기능: Git Worktrees

```bash
# 새 워크트리 세션 시작
claude -w
```

- 같은 저장소에서 여러 작업을 병렬 수행할 때 필수
- Boris Cherny는 **동시에 수십 개의 Claude 인스턴스**를 이 기능으로 운영 중
- Claude Desktop 앱에서 worktree 체크박스 선택으로 간편 활성화

---

## 7. Harness 플러그인

> **에이전트 팀 & 스킬 아키텍트 — "하네스 구성해줘" 한마디로 전문 에이전트 팀을 자동 설계**

- 저자: [revfactory](https://github.com/revfactory/harness)
- 라이선스: Apache 2.0

### 핵심 컨셉

Harness는 **메타 스킬**입니다. 에이전트나 스킬을 직접 만들어주는 것이 아니라, **에이전트 팀 시스템을 설계하고 생성하는 도구**입니다.

```
"하네스 구성해줘" → 도메인 분석 → 팀 아키텍처 설계 → 에이전트 정의 생성 → 스킬 생성 → 통합 → 검증
```

### 설치

```bash
# 마켓플레이스 추가
/plugin marketplace add revfactory/harness

# 플러그인 설치
/plugin install harness@harness
```

### 사전 요구사항

에이전트 팀 기능 활성화 필요. 아래 중 하나의 방법으로 설정:

**방법 1: settings.json에 설정 (권장)**

```jsonc
// ~/.claude/settings.json (전역) 또는 프로젝트/.claude/settings.json (프로젝트)
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

**방법 2: 셸 환경변수로 설정**

```bash
# .zshrc 또는 .bashrc에 추가
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

**방법 3: Claude Code 내에서 설정**

```bash
/config
# → Environment Variables → CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = 1
```

### 6단계 워크플로우

| Phase | 내용 |
|-------|------|
| **Phase 0** | 현황 감사 — 기존 에이전트/스킬 확인, 신규/확장/유지보수 분기 |
| **Phase 1** | 도메인 분석 — 프로젝트 기술 스택, 작업 유형 파악 |
| **Phase 2** | 팀 아키텍처 설계 — 아키텍처 패턴 선택 |
| **Phase 3** | 에이전트 정의 생성 — `.claude/agents/{name}.md` |
| **Phase 4** | 스킬 생성 — `.claude/skills/{name}/SKILL.md` |
| **Phase 5** | 통합 및 오케스트레이션 |
| **Phase 6** | 검증 및 테스트 |

### 6가지 아키텍처 패턴

| 패턴 | 설명 | 적합한 상황 |
|------|------|-------------|
| **파이프라인** | A → B → C 순차 실행 | 단계별 의존성이 강한 작업 |
| **팬아웃/팬인** | 병렬 분산 → 결과 통합 | 독립적 작업을 동시 처리 |
| **전문가 풀** | 상황에 따라 전문가 선택 호출 | 다양한 전문성이 필요한 작업 |
| **생성-검증** | 생성 후 품질 검수 루프 | 품질이 중요한 산출물 |
| **감독자** | 중앙 에이전트가 동적 분배 | 작업량/난이도가 유동적 |
| **계층적 위임** | 상위→하위 재귀적 위임 | 대규모 복합 프로젝트 |

### 실행 모드

| 모드 | 도구 | 적합한 상황 |
|------|------|-------------|
| **에이전트 팀** (기본) | `TeamCreate` + `SendMessage` + `TaskCreate` | 2개 이상 에이전트, 협업 필요 |
| **서브 에이전트** | `Agent` 도구 직접 호출 | 단발성 작업, 에이전트 간 통신 불필요 |

에이전트 팀은 팀원 간 직접 통신(`SendMessage`)과 공유 작업 목록(`TaskCreate`)으로 자체 조율합니다.

### 산출물 구조

```
프로젝트/
├── .claude/
│   ├── agents/         # 에이전트 정의 파일
│   │   ├── analyst.md
│   │   ├── builder.md
│   │   └── qa.md
│   └── skills/         # 스킬 파일
│       ├── analyze/
│       │   └── SKILL.md
│       └── build/
│           ├── SKILL.md
│           └── references/
├── _workspace/          # 에이전트 간 산출물 전달 디렉토리
│   ├── 01_analyst_requirements.md
│   └── 02_designer_wireframes.md
└── CLAUDE.md            # 하네스 컨텍스트 등록 (다음 세션에서도 유지)
```

### CLAUDE.md 자동 등록

Harness는 Phase 5에서 **CLAUDE.md에 하네스 컨텍스트를 자동 등록**합니다. 이를 통해 새 세션에서도 에이전트 팀이 즉시 활성화됩니다:

```markdown
## 하네스: {도메인명}
**목표:** {한줄 목표}
**에이전트 팀:**
| 에이전트 | 역할 |
|---------|------|
| analyst | 요구사항 분석 |
| builder | 코드 구현 |
| qa      | 품질 검증 |

**실행 규칙:**
- 오케스트레이터 스킬로 {도메인} 작업 실행
- 모든 에이전트는 model: "opus" 사용
```

### 실전 프롬프트 예시

```
# 딥 리서치
리서치 하네스를 구성해줘. 웹 검색, 학술 자료, 커뮤니티 반응을
교차 검증 후 종합 보고서를 작성하는 팀.

# 풀스택 웹 개발
풀스택 웹사이트 개발 하네스를 구성해줘. 디자인, 프론트엔드(React/Next.js),
백엔드(API), QA 테스트를 파이프라인으로 조율하는 팀.

# 종합 코드 리뷰
종합 코드 리뷰 하네스를 구성해줘. 아키텍처, 보안, 성능, 스타일을
병렬로 감사하고 결과를 통합하는 팀.
```

### 효과 (A/B 테스트 연구)

| 지표 | Harness 미적용 | Harness 적용 | 개선 |
|------|:-:|:-:|:-:|
| 평균 품질 점수 | 49.5 | 79.3 | **+60%** |
| 승률 | — | — | **100%** (15/15) |
| 난이도별 개선 | Basic +23.8 | Advanced +29.6 | Expert **+36.2** |

> 과제 난이도가 높을수록 Harness의 개선 효과가 증가

---

## 8. Dev 플러그인

> **WBS 기반 TDD 개발 자동화 — 설계→TDD구현→테스트→리팩토링을 자동 수행하고, 팀 병렬 개발을 지원**

- 저자: [svisor](https://github.com/jongik-sv/dev-plugin)
- 라이선스: MIT

### 핵심 컨셉

PRD/TRD 문서에서 WBS를 자동 생성하고, 각 Task를 **DDTR 사이클**(Design → Dev/TDD → Test → Refactor)로 자동 수행합니다. tmux 기반 팀 병렬 개발도 지원합니다.

### 설치

```bash
# 마켓플레이스 추가
/plugin marketplace add jongik-sv/dev-plugin

# 플러그인 설치
/plugin install dev@dev-tools --scope user

# 설치 확인
/plugin list
```

### tmux / psmux 설치 (team-mode, dev-team 사용 시 필수)

`/team-mode`와 `/dev-team`은 tmux 세션 안에서 실행해야 합니다. tmux 없이 병렬 실행이 필요하면 `/agent-pool`을 사용하세요.

| 플랫폼 | 설치 명령 |
|--------|-----------|
| **macOS** | `brew install tmux` |
| **Ubuntu / Debian** | `sudo apt install tmux` |
| **Fedora / RHEL** | `sudo dnf install tmux` |
| **Arch Linux** | `sudo pacman -S tmux` |
| **Windows** | [psmux](https://github.com/psmux/psmux) — tmux 호환 Windows 구현 |

```bash
# 설치 확인
tmux -V

# 새 세션 시작 후 Claude Code 실행
tmux new-session -s dev
claude
```

### 3-Layer 아키텍처

```
┌─────────────────────────────────────────────┐
│  Layer 3: 팀 병렬 개발                        │
│  /dev-team WP-04 --team-size 5              │
│  (Layer 1 + Layer 2 조합)                     │
├─────────────────────────────────────────────┤
│  Layer 2: 개발 자동화 (WBS Task 단위)          │
│  /wbs  /dev  /dev-design  /dev-build        │
│  /dev-test  /dev-refactor                   │
├─────────────────────────────────────────────┤
│  Layer 1: 병렬 실행 엔진 (범용)               │
│  /agent-pool   /team-mode                   │
└─────────────────────────────────────────────┘
```

### 전체 스킬 목록 (10개)

| 레이어 | 스킬 | 설명 | 사용법 |
|--------|------|------|--------|
| L1 | `/agent-pool` | 서브에이전트 슬롯 풀 (tmux 불필요) | `/agent-pool [task-file] [--pool-size N]` |
| L1 | `/team-mode` | tmux pane 병렬 세션 | `/team-mode [manifest] [--team-size N]` |
| L2 | `/wbs` | PRD/TRD → WBS 생성 | `/wbs [--scale large\|medium]` |
| L2 | `/dev` | 전체 DDTR 사이클 오케스트레이터 | `/dev TSK-00-01` |
| L2 | `/dev-design` | 설계 단계 → design.md | `/dev-design TSK-00-01` |
| L2 | `/dev-build` | TDD 구현 (테스트 먼저) | `/dev-build TSK-00-01` |
| L2 | `/dev-test` | 테스트 실행 (실패 시 3회 재시도) | `/dev-test TSK-00-01` |
| L2 | `/dev-refactor` | 리팩토링 + 리그레션 확인 | `/dev-refactor TSK-00-01` |
| L3 | `/dev-team` | WP 단위 팀 병렬 개발 | `/dev-team WP-04 [--team-size 5]` |
| — | `/dev-help` | 전체 사용법 안내 | `/dev-help` |

### 워크플로우 예시

#### Step 1: WBS 생성

```bash
# docs/PRD.md, docs/TRD.md 준비 후
/wbs
```

결과: `docs/wbs.md` 생성 (WP → Task 계층구조 + 의존성 + 상태)

#### Step 2: 단일 Task 개발

```bash
# 전체 사이클 (설계 → TDD → 테스트 → 리팩토링)
/dev TSK-01-01

# 특정 단계만
/dev TSK-01-01 --only design
/dev TSK-01-01 --only build
```

#### Step 3: 팀 병렬 개발

```bash
# tmux 세션 내에서
/dev-team WP-04 --team-size 5
```

실행 구조:
```
팀리더 (현재 세션)
 ├─ [tmux window: WP-04]
 │   ├─ [pane 0] WP 리더 (스케줄링)
 │   ├─ [pane 1] 팀원1 (TSK-04-01)
 │   ├─ [pane 2] 팀원2 (TSK-04-02)
 │   └─ [pane 3] 팀원3 (TSK-04-03)
 │          ↓ 완료되면 다음 Task 자동 할당
```

#### 범용 병렬 실행 (WBS 없이)

```bash
# 서브에이전트 풀 (tmux 불필요)
/agent-pool tasks.md --pool-size 4

# tmux 기반 독립 세션
/team-mode manifest.md --team-size 3
```

### 에이전트 간 통신: 시그널 프로토콜

에이전트 간 상태 추적은 **시그널 파일** 기반입니다. `mv`를 사용한 원자적 전환:

| 상태 | 파일 | 시점 |
|------|------|------|
| 실행 중 | `{task-id}.running` | task 시작 직후 |
| 완료 | `{task-id}.done` | 성공 완료 시 |
| 실패 | `{task-id}.failed` | 실패 시 |

### Task 상태 흐름

```
[ ] 미착수 → [dd] 설계완료 → [im] 구현완료 → [xx] 전체완료
```

### 산출물 구조

```
docs/tasks/TSK-01-01/
├── design.md        # 설계 문서
├── test-report.md   # 테스트 결과
└── refactor.md      # 리팩토링 내역
```

### 필수 프로젝트 구조

```
docs/
├── PRD.md          # 제품 요구사항 정의서
├── TRD.md          # 기술 요구사항 정의서
└── wbs.md          # WBS (자동 생성)
```

---

## 정리: 기능별 핵심 요약

| 기능 | 핵심 가치 | 한줄 설명 |
|------|-----------|-----------|
| **Codex** | 크로스 모델 검증 | Claude 코드를 Codex가 리뷰, 또는 문제를 위임 |
| **Remote Control** | 기기 자유도 | 터미널↔모바일↔웹 세션 이동 |
| **Loop** | 자율 반복 | 5분~1주 간격으로 작업 자동 반복 |
| **Schedule** | 정기 자동화 | 크론 스케줄로 원격 에이전트 실행 |
| **BTW** | 멀티태스킹 | 작업 중 흐름 끊지 않는 사이드 쿼리 |
| **Batch** | 대규모 병렬 | 수십~수천 워크트리로 동시 처리 |
| **Harness** | 팀 설계 | 도메인 맞춤 에이전트 팀 자동 구축 |
| **Dev Plugin** | 개발 자동화 | WBS→TDD→테스트→리팩토링 전체 사이클 |

### Boris Cherny의 핵심 메시지

> Claude Code를 **"명령하는 도구"가 아닌 "위임하는 시스템"** 으로 사용하라.
> 이 기능들은 대부분 **Claude를 혼자 돌아가게 만드는 것들**이다.
