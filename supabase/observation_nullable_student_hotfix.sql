-- 학생을 아직 지정하지 않은 학급 관찰 기록도 저장할 수 있게 합니다.
alter table public.observations alter column student_number drop not null;
