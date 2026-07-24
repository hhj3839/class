-- 화면에서 제거한 월별 담임 확인 기록은 보존하되 새 조회·저장을 중단합니다.
-- 기존 자료를 삭제하지 않아 필요할 때 별도 검토 후 정리할 수 있습니다.
revoke execute on function public.teacher_get_student_review_cycles_auth(text) from authenticated;
revoke execute on function public.teacher_upsert_student_review_cycle_auth(text,uuid,date,text,text,date) from authenticated;

comment on table public.student_monthly_review_cycles is
  'v1.2.1-prepilot.3에서 사용 중단. 기존 기록 보존용이며 교사 화면에서는 조회하거나 저장하지 않음.';
