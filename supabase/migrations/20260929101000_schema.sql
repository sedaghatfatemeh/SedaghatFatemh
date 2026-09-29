begin;
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_fa text not null,
  title_en text not null,
  description_fa text not null,
  description_en text not null,
  tech_stack text[] not null default '{}',
  project_url text,
  github_url text,
  featured boolean not null default false,
  published boolean not null default false,
  sort_order integer not null default 0,
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_slug_format_chk check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint projects_title_fa_len_chk check (char_length(btrim(title_fa)) between 2 and 160),
  constraint projects_title_en_len_chk check (char_length(btrim(title_en)) between 2 and 160),
  constraint projects_description_fa_len_chk check (char_length(btrim(description_fa)) between 10 and 4000),
  constraint projects_description_en_len_chk check (char_length(btrim(description_en)) between 10 and 4000),
  constraint projects_sort_order_chk check (sort_order between -100000 and 100000),
  constraint projects_project_url_chk check (project_url is null or project_url ~* '^https?://'),
  constraint projects_github_url_chk check (github_url is null or github_url ~* '^https?://')
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text,
  message text not null,
  locale text not null default 'fa',
  source text not null default 'landing',
  user_agent text,
  ip_hash text,
  request_id uuid not null,
  created_at timestamptz not null default now(),
  constraint contact_name_len_chk check (char_length(btrim(name)) between 2 and 100),
  constraint contact_email_len_chk check (char_length(btrim(email)) between 3 and 254),
  constraint contact_email_format_chk check (email ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'),
  constraint contact_subject_len_chk check (subject is null or char_length(subject) <= 200),
  constraint contact_message_len_chk check (char_length(btrim(message)) between 10 and 3000),
  constraint contact_locale_chk check (locale in ('fa','en')),
  constraint contact_source_chk check (source in ('landing')),
  constraint contact_ip_hash_len_chk check (ip_hash is null or char_length(ip_hash) = 64)
);

create table if not exists public.contact_rate_limits (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint contact_rate_count_chk check (request_count >= 0)
);

create index if not exists projects_public_listing_idx on public.projects (featured desc, sort_order asc, published_at desc) where published = true;
create index if not exists projects_updated_at_idx on public.projects (updated_at desc);
create index if not exists contact_messages_created_at_idx on public.contact_messages (created_at desc);
create index if not exists contact_messages_email_created_at_idx on public.contact_messages (email, created_at desc);
create index if not exists contact_rate_limits_updated_at_idx on public.contact_rate_limits (updated_at);
commit;
