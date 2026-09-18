-- جدول الملفات الشخصية (بيتربط تلقائياً مع auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  email text not null,
  phone text,
  role text default 'user' check (role in ('user','admin')),
  balance numeric default 0,
  subscription_end timestamptz,
  banned boolean default false,
  created_at timestamptz default now()
);

-- جدول الإيداعات
create table public.deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  user_name text,
  user_email text,
  method text check (method in ('vodafone','binance','crypto')),
  amount numeric not null,
  tx_id text,
  phone text,
  screenshot_url text,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz default now(),
  processed_at timestamptz
);

-- جدول التوصيات
create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  entry text,
  target1 text,
  target2 text,
  target3 text,
  stop_loss text,
  notes text,
  hidden boolean default false,
  created_at timestamptz default now()
);

-- جدول كلمة اليوم
create table public.words (
  id uuid primary key default gen_random_uuid(),
  word text not null,
  hint text,
  hidden boolean default false,
  created_at timestamptz default now()
);

-- تفعيل RLS
alter table public.profiles enable row level security;
alter table public.deposits enable row level security;
alter table public.recommendations enable row level security;
alter table public.words enable row level security;

-- سياسات profiles
create policy "Users see own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Anyone authenticated sees all profiles" on public.profiles for select using (auth.role() = 'authenticated');

-- سياسات deposits
create policy "Users see own deposits" on public.deposits for select using (auth.uid() = user_id);
create policy "Users insert own deposits" on public.deposits for insert with check (auth.uid() = user_id);
create policy "Authenticated read all deposits" on public.deposits for select using (auth.role() = 'authenticated');
create policy "Authenticated update deposits" on public.deposits for update using (auth.role() = 'authenticated');

-- سياسات recommendations
create policy "Anyone read visible recos" on public.recommendations for select using (true);
create policy "Authenticated insert recos" on public.recommendations for insert with check (auth.role() = 'authenticated');
create policy "Authenticated update recos" on public.recommendations for update using (auth.role() = 'authenticated');
create policy "Authenticated delete recos" on public.recommendations for delete using (auth.role() = 'authenticated');

-- سياسات words
create policy "Anyone read visible words" on public.words for select using (true);
create policy "Authenticated insert words" on public.words for insert with check (auth.role() = 'authenticated');
create policy "Authenticated update words" on public.words for update using (auth.role() = 'authenticated');
create policy "Authenticated delete words" on public.words for delete using (auth.role() = 'authenticated');

-- Trigger: يملأ profiles تلقائياً عند التسجيل
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, email, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'phone', ''),
    case when new.email = 'swlyd3393@gmail.com' then 'admin' else 'user' end
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- جدول إشعارات (اختياري لكن مفيد)
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text,
  body text,
  type text default 'general',
  created_at timestamptz default now()
);
alter table public.notifications enable row level security;
create policy "Anyone read notifications" on public.notifications for select using (true);
create policy "Auth insert notifications" on public.notifications for insert with check (auth.role() = 'authenticated');

-- Storage bucket للقطات الشاشة
insert into storage.buckets (id, name, public) values ('proofs', 'proofs', true)
on conflict do nothing;

create policy "Anyone upload proofs" on storage.objects for insert with check (bucket_id = 'proofs');
create policy "Anyone read proofs" on storage.objects for select using (bucket_id = 'proofs');
