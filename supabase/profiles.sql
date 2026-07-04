create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  name text,
  email text,
  phone text,
  updated_at timestamp with time zone default now()
);

alter table profiles enable row level security;

create policy "Users can manage own profile" 
on profiles for all 
using (auth.uid() = id) 
with check (auth.uid() = id);
