create table users (
  id uuid primary key default gen_random_uuid(),
  google_sub text not null unique,   -- Google이 주는 고유 사용자 번호
  email text not null,
  name text,
  created_at timestamptz not null default now()
);

-- 기존 Supabase 로그인 사용자를 같은 id로 옮겨온다
insert into users (id, google_sub, email, name)
select u.id,
       i.identity_data->>'sub',
       u.email,
       coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name')
from auth.users u
join auth.identities i on i.user_id = u.id and i.provider = 'google'
on conflict do nothing;

select id, email, google_sub from users;