-- 기존 auth.users의 이름을 profiles에 동기화 (잘못된 이름 수정)
UPDATE public.profiles p
SET name = coalesce(
  u.raw_user_meta_data ->> 'name',
  u.raw_user_meta_data ->> 'full_name',
  p.name
)
FROM auth.users u
WHERE p.id = u.id;

-- donseok75@gmail.com은 admin + active 보장
UPDATE public.profiles
SET system_role = 'admin', account_status = 'active'
WHERE email = 'donseok75@gmail.com';
