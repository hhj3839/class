# 우리반 이음

현재 파일럿 기준 버전과 현장 검증 항목은 [RELEASE_v1.1_RC2.md](RELEASE_v1.1_RC2.md)에서 확인할 수 있습니다. 이전 기준은 [RC1 문서](RELEASE_v1.1_RC1.md)에 보존되어 있습니다.

학생의 월별 자기평가와 교우관계 응답을 바탕으로 담임교사가 지원 신호, 관계 변화, 관찰 포인트를 근거와 함께 확인하는 반응형 웹 MVP입니다.

## 실행

별도의 설치 과정이 없습니다. `index.html`을 브라우저에서 열거나 로컬 서버로 실행하세요.

```powershell
python -m http.server 4173
```

브라우저에서 `http://127.0.0.1:4173`에 접속합니다.

## 구현 범위

- 교사 로그인과 담당 학급별 Supabase 권한
- 실제 월별 학급 추세, 학생 상세 추세, 누적 관계망과 관찰 포인트
- 월별 제출 현황, 응답 정정·분석 제외, 감사 로그
- 사실·해석·면담·후속조치를 구분한 관찰 기록
- 서버 측 AI 분석 캐시, 월 10회 새 분석 제한, 교사 오류 표시·숨김
- 이름·설문 원문 포함 여부를 선택하는 PDF·인쇄 보고서
- 권한 검사와 감사 로그가 적용된 JSON 백업·복구
- 모바일·태블릿·PC 반응형 화면

## 안전 원칙

학생 화면은 공개 키로 명단 조회와 새 응답 제출만 할 수 있으며, 기존 응답은 조회할 수 없습니다. 교사 자료는 로그인한 담당 교사만 권한 함수를 통해 접근합니다. 응답은 제출 횟수와 기간 제한 없이 누적되며 `survey_month`로 설문 기준 월을 구분합니다. 백업과 이름·원문 포함 보고서는 개인정보 파일이므로 교사용 암호화 저장 공간에만 보관해야 합니다.

## 1·2차 DB 적용 순서

Supabase SQL Editor에서 다음 파일을 순서대로 실행합니다.

1. `supabase/migrations/20260720150000_stable_student_ids.sql`
2. `supabase/migrations/20260720170000_ai_reports_backup.sql`
3. `supabase/migrations/20260720190000_secure_participation_pilot.sql`
4. `supabase/migrations/20260720235900_pilot_evidence_metrics.sql`
5. `supabase/migrations/20260720235930_ai_analysis_limit_10.sql`

그 다음 `supabase/functions/analyze-class/index.ts`를 Edge Function `analyze-class`로 다시 배포합니다. v1.1 함수는 AI 근거를 응답 ID·문항 경로와 연결하고 서버에서 허용된 참조인지 검증합니다. `OPENAI_API_KEY`는 Edge Function 비밀값에만 저장하며 저장소나 브라우저 코드에 넣지 않습니다.

3차 마이그레이션을 적용하면 기존 `?class=학급ID` 학생 링크는 차단됩니다. 설문 관리에서 새 `?join=임의토큰` 링크나 QR을 다시 배포해야 합니다. 학생 작성 중 내용은 해당 학생 탭의 `sessionStorage`에 최대 12시간만 임시 저장되고, 제출 성공 시 즉시 삭제됩니다.
