# 운영 Supabase 대조 및 이력 정리 — 2026-11-03

후속: [익명 RPC 권한 강화](SUPABASE_PERMISSIONS_20261103.md)를 운영에 적용해 현재 이력은 31건이며, 익명 실행은 학생 토큰 RPC 3개만 허용한다. 아래 30건과 권한 지문은 이력 정리 당시의 기록이다. 과거 일회성 정리 SQL은 새 권한 상태에서 의도적으로 중단된다.

운영 프로젝트 `wxhcualawzwybsllrkqm`의 마이그레이션 이력을 **6건 → 30건**으로 정리했다.
저장소 기능 기준선은 `882fe77e77c507d83bbf0cd188f609b628e364b5`이다.
누락 24건의 최종 효과를 검증한 뒤 이력만 등록했으며, 애플리케이션 DDL·학생 자료·함수 권한·Edge Function은 변경하지 않았다.

## 검증 방법과 범위

1. 운영 시스템 카탈로그에서 함수 정의·ACL, 컬럼, 제약조건, 인덱스, 트리거, RLS, 테이블 권한과 이력을 읽었다. 학생 응답 원문은 조회하지 않았다.
2. 독립된 PGlite 0.5.14 환경에서 초기 SQL 5개와 마이그레이션 30개를 순서대로 실행했다.
   초기 SQL 순서는 `schema.sql`, `observations_migration.sql`, `teacher_auth_migration.sql`, `observation_nullable_student_hotfix.sql`, `data_governance_migration.sql`이다.
   Auth 스키마와 역할은 시험용으로 대체하고 pgcrypto를 설치했다. 실제 Supabase 인증 성공이나 운영 부하를 재현한 시험은 아니다.
3. Supabase의 역할별 기본 함수 실행 권한을 시험 환경에도 재현했다. 운영 함수 전체의 명시적 ACL도 대조했다.
4. 최신 정의로 대체된 과거 함수는 **최종 상태**를 비교했다. 코칭 백업 마이그레이션이 이름을 바꿔 보존한 함수 4개도 포함했다.
5. 운영 PostgreSQL 17과 시험 엔진의 NOT NULL 카탈로그 표현 차이는 컬럼 nullable 속성으로 비교했다.
6. 운영에서 학생 ID 누락, 연결 가능한 응답/관찰의 학생 ID 미보정, 전출일과 활성 상태 충돌을 집계했다. 네 항목 모두 0건이었다.

| 대조 대상 | 결과 |
|---|---|
| 함수 62개 | 전체 정의, 인수/반환형, SECURITY DEFINER, search_path, 실행 권한 일치 |
| 저장소 테이블 13개 | 모두 존재, RLS 활성, anon/authenticated 직접 테이블 권한 없음 |
| 컬럼 138개 | 타입·NULL·identity 일치. 초기 survey_month 기본값 1건 차이는 아래 기록 |
| PK/FK/CHECK/UNIQUE 제약조건 65개 | 정의·검증 상태 일치 |
| 인덱스 33개 | 정의 일치 |
| 트리거 3개 | 정의·활성 상태 일치 |
| RLS 정책 | 없음. 테이블 직접 접근 차단 + 권한 검사 RPC 구조 |
| 마이그레이션 효과 | 30개 모두 최종 상태 확인. 과거 실행 시각이나 실행 경로를 증명하는 것은 아님 |

## 별도 발견 사항 — 이번에 변경하지 않음

- 운영에만 `ai_analysis_limit_overrides` 테이블(6개 컬럼, 제약조건 4개, PK 인덱스 1개)이 있다. RLS가 활성화되어 있고 anon/authenticated 직접 권한은 없다. 현재 함수 정의에서 이 테이블을 참조하지 않는다. 생성 이력이 저장소에 없으므로 후속 정리 대상으로 남긴다. 삭제하거나 임의 마이그레이션으로 소급 등록하지 않았다.
- `survey_responses.survey_month` 기본값은 초기 `schema.sql`에는 이번 달로 지정되어 있으나 운영에는 없다. NOT NULL은 일치하고 현재 제출 RPC는 설문 대상 월을 명시적으로 삽입한다. 30개 마이그레이션의 효과 누락은 아니지만 초기 스키마 차이는 남아 있다. 정리 SQL은 이 두 검토된 기본값만 허용한다.
- 익명 호출 가능한 SECURITY DEFINER 함수가 40개다. 학생 토큰 RPC 3개 외에도 교사용·레거시 함수 37개가 포함된다. 저장소 재현 결과도 동일하다. `REVOKE ... FROM PUBLIC`만으로 Supabase의 명시적 `anon` 기본 실행 권한이 제거되지 않는 것이 원인이다.
  함수 내부의 사용자/소유권 또는 기존 비밀값 검사가 있으므로 이 결과만으로 데이터 유출을 단정하지 않는다. 다만 교사용 함수의 익명 EXECUTE 제거는 별도 권한 강화가 필요하다.
- 사용 중단된 월별 리뷰 RPC 2개는 authenticated 호출이 차단되어 있지만 anon 실행 권한은 남아 있다. 초기 학급 ID 기반 학생 RPC 2개와 코칭 전 백업용 내부 함수 4개는 anon/authenticated 모두 차단되어 있다.
- 보안 Advisor는 유출 비밀번호 보호 비활성도 보고했다. 이번 DB 이력 정리에서 Auth 설정을 바꾸지 않았다.
  참고: [익명 SECURITY DEFINER 경고](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [비밀번호 보호](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## 실제 수행한 이력 정리

[이력 정리 SQL](supabase/audit/20261103_reconcile_history.sql)은 마이그레이션 폴더 밖에 둔 일회성 관리 작업이다.
공식 [migration repair](https://supabase.com/docs/reference/cli/supabase-migration-repair)와 같이 추적 테이블만 수정한다.

- 트랜잭션과 이력 테이블 잠금 안에서 함수·컬럼·제약·인덱스·트리거·RLS/테이블 권한 지문을 다시 확인했다.
- 원래 이력 6건의 존재, 예상 버전·이름, 데이터 불변조건을 확인했다.
- 누락 24건만 `INSERT ... ON CONFLICT DO NOTHING`으로 등록했다.
- 신규 행의 `statements`는 NULL이다. 원래 SQL을 이번에 실행했다고 기록하지 않는다.
- 사후 조회: 버전·이름 30건이 로컬 파일과 정확히 일치하고, 기존 6건의 이름과 statements는 그대로 보존됨을 확인했다.
- 사후 카탈로그 지문은 작업 전과 동일했다. Edge Function 재배포와 AI 생성은 수행하지 않았다.

| 버전 | 이름 | 처리 |
|---|---|---|
| `20260720090000` | `secure_teacher_context` | 기존 이력 유지 |
| `20260720150000` | `stable_student_ids` | 이력 보완 |
| `20260720170000` | `ai_reports_backup` | 이력 보완 |
| `20260720190000` | `secure_participation_pilot` | 이력 보완 |
| `20260720210000` | `safe_cross_class_restore` | 이력 보완 |
| `20260720230000` | `teacher_self_service_class` | 이력 보완 |
| `20260720233000` | `observation_feedback_loop` | 이력 보완 |
| `20260720234500` | `observation_soft_delete` | 이력 보완 |
| `20260720235900` | `pilot_evidence_metrics` | 이력 보완 |
| `20260720235930` | `ai_analysis_limit_10` | 이력 보완 |
| `20260720235945` | `ai_analysis_failure_recovery` | 이력 보완 |
| `20260720235960` | `idempotent_student_submissions` | 이력 보완 |
| `20260720235970` | `safety_signal_inbox` | 이력 보완 |
| `20260721090000` | `link_signals_to_observations` | 이력 보완 |
| `20260722090000` | `signal_review_metrics` | 이력 보완 |
| `20260722170000` | `relationship_ai_analysis` | 이력 보완 |
| `20260723180000` | `remove_ai_analysis_limits` | 이력 보완 |
| `20260723190000` | `year_end_cleanup` | 이력 보완 |
| `20260723223000` | `update_year_end_cleanup_messages` | 이력 보완 |
| `20260724140000` | `student_monthly_review_cycles` | 이력 보완 |
| `20260724153000` | `disable_student_monthly_review_rpcs` | 이력 보완 |
| `20260828090000` | `roll_demo_months_forward` | 이력 보완 |
| `20260909120000` | `student_transfer_status` | 기존 이력 유지 |
| `20260909150000` | `student_coaching_cards` | 기존 이력 유지 |
| `20260909160000` | `student_coaching_limit_100` | 기존 이력 유지 |
| `20260911150000` | `coaching_backup_retention` | 기존 이력 유지 |
| `20260912100000` | `student_survey_only_coaching` | 기존 이력 유지 |
| `20260915120000` | `guest_lab_quota` | 이력 보완 |
| `20260915140000` | `preserve_demo_ai_history` | 이력 보완 |
| `20261005100000` | `survey_target_month` | 이력 보완 |

과거 10회 한도 설정처럼 후속 마이그레이션이 대체한 동작은 현재 적용되어야 할 기능으로 되살리지 않았다.
이번 정리는 최종 상태에 근거한 이력 조정이며, 각 SQL 파일의 과거 실제 실행 여부를 소급 증명하지 않는다.

## 회귀 검증과 재실행

`npm test`: 419개 통과. 추가된 이력 정리 시험 9개(상위 시험 포함)는 다음을 검증한다.

- 30개 SQL 재현과 전체 카탈로그 지문 일치.
- 기존 이력 누락·이름 충돌, 함수 권한 변경, 인덱스 누락, NULL 제약 변경, RLS 해제 시 쓰기 차단.
- 기존 이력 6개 보존, 누락 24개 등록, 재실행 시 변경 없음.

재현 명령: `node --test tests/migration-reconciliation.test.js`.
시험은 임시 메모리 DB만 사용한다. PGlite는 개발 의존성이며 웹사이트에 로드되지 않는다.

SQL은 감사 당시 상태에 고정되어 있다. 이후 기능이 변경되면 지문 검사에서 중단되는 것이 정상이다.
실패할 때 가드를 제거하거나 과거 마이그레이션을 일괄 재실행하지 않는다.
이력 정리를 되돌려야 한다면 새 배포를 먼저 중단하고, 이번에 보완한 24개 버전의 이름과 NULL statements를 확인한 뒤 해당 이력 행만 되돌리는 별도 검토가 필요하다. 애플리케이션 SQL을 역실행할 필요는 없다.

향후 새 스키마·권한 변경은 새 마이그레이션으로 배포한다. 보존된 운영 전용 테이블과 초기 기본값 차이, 교사용 익명 실행 권한은 이번 이력 정리와 구분하여 관리한다.

