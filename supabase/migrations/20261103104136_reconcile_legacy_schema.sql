-- Record the retired production-only table without deleting its historical row.
-- No application function reads this table; it must not re-enable AI limits.
-- Forward-only reconciliation. Existing migrations and baseline SQL stay immutable.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

create table if not exists public.ai_analysis_limit_overrides (
  teacher_id uuid not null references auth.users(id) on delete cascade,
  class_id text not null references public.classes(class_id) on delete cascade,
  monthly_limit integer not null check(monthly_limit >= 10 and monthly_limit <= 100),
  expires_at timestamptz not null,
  reason text not null,
  created_at timestamptz not null default now(),
  primary key(teacher_id,class_id)
);
alter table public.ai_analysis_limit_overrides enable row level security;
revoke all on public.ai_analysis_limit_overrides from public,anon,authenticated;
grant all on public.ai_analysis_limit_overrides to service_role;
comment on table public.ai_analysis_limit_overrides is
  'Retired AI limit override history. Preserved for provenance; unused by current application functions. No anonymous or teacher table access.';

-- Survey month comes from the selected class month, not the insertion date.
-- Match production: missing survey_month must fail the existing NOT NULL constraint.
alter table public.survey_responses alter column survey_month drop default;

commit;

