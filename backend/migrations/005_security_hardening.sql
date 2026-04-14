alter table if exists email_logs
  drop constraint if exists email_logs_status_check;

alter table if exists email_logs
  add constraint email_logs_status_check
  check (status in ('pending', 'sent', 'failed', 'processing'));
