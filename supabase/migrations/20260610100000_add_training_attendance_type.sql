-- 근태유형에 '교육(training)' 추가
-- attendance.type CHECK 제약을 재생성하여 'training' 값을 허용한다.

alter table public.attendance drop constraint if exists attendance_type_check;

alter table public.attendance add constraint attendance_type_check
  check (type in (
    'present', 'annual_leave', 'half_day_am', 'half_day_pm',
    'sick_leave', 'business_trip', 'late', 'early_leave', 'absence',
    'training'
  ));
