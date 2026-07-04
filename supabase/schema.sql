create extension if not exists pgcrypto;

create table if not exists app_users (
  id text primary key,
  name text not null,
  email text not null unique,
  password_hash text not null,
  salt text not null,
  role text not null check (role in ('admin', 'staff')),
  department text not null default 'Operations',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists app_users_single_admin_idx
  on app_users ((role))
  where role = 'admin' and is_active = true;

create table if not exists transactions (
  id text primary key,
  transaction_id text not null unique,
  channel text not null check (channel in ('JazzCash', 'Easypaisa', 'Bank Transfer')),
  uploader_id text not null references app_users(id),
  uploader_name text not null,
  date text not null,
  time text not null,
  amount text not null default '',
  sender text not null default '',
  receiver text not null default '',
  receipt_name text not null,
  status text not null check (status in ('approved', 'review', 'duplicate_blocked')),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists activity_logs (
  id text primary key,
  text text not null,
  tone text not null check (tone in ('neutral', 'success', 'warning')),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists processed_upload_cache (
  file_hash text primary key,
  channel text not null,
  receipt_name text not null,
  transaction_id text not null,
  amount text not null,
  date text not null,
  time text not null,
  sender text not null,
  receiver text not null,
  extraction_source text not null,
  created_at timestamptz not null default timezone('utc', now())
);
