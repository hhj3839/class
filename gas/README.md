# Google Apps Script 백엔드 연결

1. 교사 소유 Google Spreadsheet를 새로 만듭니다.
2. `확장 프로그램 > Apps Script`를 열고 `Code.gs`의 내용을 붙여넣습니다.
3. `setupClass` 함수를 한 번 실행하고 권한을 승인합니다.
4. 생성된 `Roster` 시트에 `class_id`, `number`, `name`, `access_code`, `active`를 입력합니다.
5. 실행 로그에 표시된 `TEACHER_SECRET`을 안전하게 보관합니다.
6. `배포 > 새 배포 > 웹 앱`에서 실행 사용자는 본인, 액세스 권한은 링크가 있는 모든 사용자로 설정합니다.
7. 생성된 `/exec` URL과 비밀키를 우리반 이음의 `학급 설정`에 저장합니다.

Apps Script URL과 교사용 비밀키를 학생에게 직접 공유하지 마세요. 학생 참여 링크에는 API URL이 포함되지만 교사용 비밀키는 포함되지 않습니다.
