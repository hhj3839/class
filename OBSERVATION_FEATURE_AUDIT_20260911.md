# 교사 관찰 기능 연결 점검

## 현재 확인한 사실

주요 메뉴에는 관찰 기록 버튼이 없다. 그러나 내부 관찰 화면·입력 폼·DB 함수는 남아 있으며 다른 화면과 연결돼 있다. 실제 사용자가 기록을 작성했는지, 어느 교사가 작성했는지는 조회하지 않았다.

| 연결 | 근거 | 이번 처리 |
|---|---|---|
| 내부 관찰 화면·직접 기록 폼 | index.html의 view-observations, observationDialog | 보존. 전체 제거 여부 확인 중 |
| 응답 근거에서 관찰 과제 저장 | app.js의 saveObservation, persistObservation | 보존 |
| 학생 확인 이력 | student-support-timeline.js의 studentSupportItems | 관찰 기록 연결 보존 |
| 변화 살펴보기 확인 상태 | student-calendar.js의 observationMonthState | 선택 학년도 3월~다음 해 2월 안에서 표시 |
| 학생 코칭 AI 참고 | student-coaching/coaching.mjs의 buildEvidence | 실제 관찰 사실·면담 내용 최대 6건 참고 연결 보존 |
| 코칭 적용 결과 | student_coaching_feedback | observations와 별도 테이블. 화면 저장 기능 보존, 학생 PDF에서는 제외 |
| 학생 PDF | buildStudentOverviewPdfReport, buildCompactCoachingPdf | 한눈에 보기+학생 코칭으로 변경. 관찰 표·교사 적용 기록·관찰 근거 라벨 제외 |
| 학년 말 PDF·백업·보존 | yearEndReportContent 및 백업/정리 SQL | 변경·삭제하지 않음 |

## 해석상 주의

- UI에서 메뉴가 안 보인다는 것과 기능·자료 연결이 없는 것은 다르다. 남아 있는 연결 때문에 이전 학생 PDF에 교사 관찰 항목이 표시됐다.
- PDF에서 관찰 항목을 뺀 것은 AI 입력에서 관찰 자료를 제거한 것과 다르다. 저장된 코칭의 서술에는 생성 당시 관찰 자료가 반영돼 있을 수 있다.
- 학급 AI의 ‘관찰 포인트’는 AI의 확인 제안이다. 교사가 실제 관찰해 저장한 사실과 구분해야 한다.
- 운영 자료·테이블·기존 기록은 삭제하지 않았다. 앱 전체 기능과 AI 입력 제거는 별도 범위 선택 후 처리한다.
