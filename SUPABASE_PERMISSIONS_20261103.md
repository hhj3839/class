# 익명 RPC 권한 강화 — 2026-11-03

운영 프로젝트 `wxhcualawzwybsllrkqm`에
[`20261103095435_restrict_anonymous_rpc_execution.sql`](supabase/migrations/20261103095435_restrict_anonymous_rpc_execution.sql)을 적용했다.
운영 마이그레이션은 31건이며, 이번 파일 이름은 Supabase 적용 도구가 기록한 버전과 일치한다.

## 최종 접근 권한

익명으로 실행 가능한 public 스키마 함수는 42개에서 학생 토큰 RPC 3개로 줄었다.

| 함수 | anon | authenticated | 용도 |
|---|---|---|---|
| `get_roster_by_token(uuid)` | 허용 | 허용 | 참여 토큰에 해당하는 활성 학생 명단 |
| `get_survey_month_by_token(uuid)` | 허용 | 허용 | 교사가 지정한 설문 월 |
| `submit_response_by_token(uuid,integer,text,jsonb)` | 허용 | 허용 | 학생 확인·설문 제출·중복 재시도 |

나머지 59개 함수의 익명 실행은 차단되어 있다. 이번에 제거한 것은 교사용·레거시 SECURITY DEFINER 함수 37개와 트리거 함수 2개의 익명 권한이다.
초기 학생 RPC, 사용 중단 리뷰 RPC, 내부 백업 함수, 서버 전용 한도 함수의 차단 상태도 유지했다.

- public 스키마 함수의 PUBLIC/anon EXECUTE를 회수한 뒤 학생 RPC 3개만 명시적으로 허용했다.
- 현재 62개 함수의 본문·정의와 authenticated/service_role 실행 권한은 적용 전후 동일하다.
- 테이블의 RLS·권한과 학생 설문 데이터 처리 로직은 변경하지 않았다.
- 트리거 직접 실행 권한을 회수해도 제출 RPC 내부의 학생 ID 연결은 정상 작동함을 실제 anon 역할로 검증했다.
- postgres가 앞으로 만드는 함수의 기본 PUBLIC 실행 권한과 public 스키마의 anon 기본 실행 권한도 회수했다. 신규 앱 함수는 익명 공개가 필요한 경우 명시적으로 GRANT해야 한다.
- 기본 권한 변경은 앱 마이그레이션 소유자인 postgres에 적용했다. 기존 다른 스키마 함수나 Supabase 관리 역할의 기본 권한은 수정하지 않았다. 다른 소유자로 앱 함수를 배포하면 별도 권한 검증이 필요하다.
- 마이그레이션은 트랜잭션 안에서 학생 허용 목록과 PUBLIC 우회 권한 부재를 확인한다. 확인 실패 시 전체 변경이 중단된다. PostgREST 스키마 갱신도 요청한다.

## 검증 결과

| 검증 | 결과 |
|---|---|
| Node 전체 테스트 | 428개 통과 |
| 신규 DB 권한 회귀 시험 | 9개 통과(상위 시험 포함) |
| 학생 제출·입력·대상 월 브라우저 시험 | 8개 통과, 360/375·768·1440px |
| 운영 DB 실제 anon 역할 시험 | 명단·월·제출·동일 ID 재시도 성공 |
| 운영 DB 잘못된 입력 | 잘못된 학생·토큰·월 거절 |
| 운영 DB 차단 확인 | 교사·레거시·중단 RPC·서버 한도 RPC·응답 테이블 직접 조회 차단 |
| 운영 Pages 학생 화면 | 375px에서 가상 학생의 실제 제출 HTTP 200, 완료 화면 표시 |
| 실제 HTTP 중복 재시도 | HTTP 200, 같은 응답 ID 반환, 저장 행 1건 |
| 실제 익명 교사 RPC 호출 | HTTP 401 / SQLSTATE 42501 |
| 실제 저장 내용 | 가상 학생 ID·대상 월·시험 문구 일치 |
| 브라우저 임시 저장·오류 | 제출 후 임시 저장 삭제, JS 오류 0건 |
| 시험 자료 정리 | 검증용 학급·학생·응답 잔여 각각 0건 |

운영 SQL 시험은 [롤백형 스모크 테스트](supabase/tests/anonymous_rpc_permissions_smoke_test.sql)를 사용했다.
별도 합성 학급을 트랜잭션 안에서 만들고 `SET LOCAL ROLE anon`으로 호출한 뒤 ROLLBACK했다.
실제 교사 계정이나 학생 자료는 사용하지 않았다. CLI로 실행할 때는 `psql -v ON_ERROR_STOP=1`을 사용해 첫 오류에서 중단한다.

별도의 실제 웹 검증에서는 합성 학급 1개·가상 학생 2명을 잠시 생성하고 배포된 Pages의 학생 화면에서 응답 1건을 제출했다.
API 모의 응답이나 유료 AI는 사용하지 않았다. 저장 결과 확인 후 사용자 승인을 받아 그 학급과 소속 자료만 삭제했으며, 운영 조회로 잔여 0건을 확인했다.

SQL 회귀 시험은 전체 과거 마이그레이션을 독립 PGlite 환경에서 재현한다.
로그인 교사의 담당 학급 조회 성공·다른 교사 조회 차단, 권한/본문 보존, 미래 함수 기본 권한, 마이그레이션 재실행 안전성도 검사한다.
실행: `node --test tests/anonymous-rpc-permissions.test.js`.

## 보안 점검과 남은 범위

Supabase Advisor의 익명 SECURITY DEFINER 경고는 40개에서 학생 토큰 RPC 3개만 남았다.
이 3개는 로그인 없는 학생 설문에 필요한 공개 경로이며, 보안을 위해 제거할 대상이 아니다.
[경고 설명](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).

RLS 활성·정책 없음(INFO 14건)은 직접 테이블 접근을 막고 권한 검사 RPC를 사용하는 현재 구조다.
authenticated SECURITY DEFINER 경고 50건은 이번에 변경하지 않은 교사용 접근 경로를 포함한다.
유출 비밀번호 보호 비활성, 운영 전용 한도 테이블, 초기 월 기본값 차이는 별도 과제로 남는다.
전자의 설정 안내는 [Supabase 비밀번호 보안](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)을 참고한다.

롤백은 새 전진 마이그레이션으로 수행한다. 학생 RPC 문제가 확인되면 해당 학생 함수의 GRANT만 복구하며,
교사용 함수나 PUBLIC/anon 전체 권한을 다시 열지 않는다. 이 마이그레이션은 함수 본문과 자료를 변경하지 않아 데이터 복구는 필요 없다.

