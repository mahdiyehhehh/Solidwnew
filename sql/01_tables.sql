-- ==========================================================================
-- SolidW — Database Schema
-- Run this FIRST in the Supabase SQL Editor, before 02/03/04.
-- ==========================================================================

create extension if not exists "uuid-ossp";

-- --------------------------------------------------------------------------
-- plans — relational plan definitions (free/pro today, extensible later)
-- --------------------------------------------------------------------------
create table if not exists plans (
  id text primary key,                    -- 'free' | 'pro' | future slugs
  name text not null,
  max_businesses integer,                 -- null/0 = unlimited
  max_gallery_images integer,             -- null/0 = unlimited
  max_bookings_per_day integer,           -- null/0 = unlimited
  features jsonb not null default '{}'::jsonb,
  price_usdt numeric(10,2),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into plans (id, name, max_businesses, max_gallery_images, max_bookings_per_day, features, price_usdt, sort_order)
values
  ('free', 'Free', 1, 6, 5, '{"analytics": false, "custom_domain": false}'::jsonb, 0, 0),
  ('pro', 'Pro', null, null, null, '{"analytics": true, "custom_domain": true}'::jsonb, 15.00, 1)
on conflict (id) do nothing;

-- --------------------------------------------------------------------------
-- profiles — one row per auth.users, mirrors plan + status
-- --------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  plan_id text not null default 'free' references plans(id),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- subscriptions — audit log of every plan change / upgrade request
-- --------------------------------------------------------------------------
create table if not exists subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  plan_id text not null references plans(id),
  method text not null default 'usdt_manual' check (method in ('usdt_manual', 'stripe', 'admin_grant')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  period_start timestamptz,
  period_end timestamptz,
  proof_note text,          -- e.g. tx hash / wallet reference the user submits
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- businesses
-- --------------------------------------------------------------------------
create table if not exists businesses (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  slug text not null unique,
  name text not null,
  category text,
  description text,
  address text,
  phone text,
  whatsapp text,
  telegram text,
  website text,
  logo_url text,
  cover_url text,
  timezone text not null default 'UTC',
  appointment_duration_min integer not null default 30,
  buffer_min integer not null default 0,
  max_bookings_per_day integer,           -- overrides plan default if set
  accepting_bookings boolean not null default true,
  custom_domain text,
  locale text not null default 'en',
  notification_channels jsonb not null default '{}'::jsonb,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_businesses_owner on businesses(owner_id);
create index if not exists idx_businesses_slug on businesses(slug);

-- --------------------------------------------------------------------------
-- gallery_images
-- --------------------------------------------------------------------------
create table if not exists gallery_images (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_gallery_business on gallery_images(business_id);

-- --------------------------------------------------------------------------
-- services
-- --------------------------------------------------------------------------
create table if not exists services (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  price numeric(10,2) not null default 0,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_services_business on services(business_id);

-- --------------------------------------------------------------------------
-- opening_hours — one row per day_of_week (0=Sunday .. 6=Saturday)
-- --------------------------------------------------------------------------
create table if not exists opening_hours (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  open_time time,
  close_time time,
  closed boolean not null default false,
  unique (business_id, day_of_week)
);

create index if not exists idx_hours_business on opening_hours(business_id);

-- --------------------------------------------------------------------------
-- reservations
-- --------------------------------------------------------------------------
create table if not exists reservations (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  customer_name text not null,
  phone text not null,
  date date not null,
  time time not null,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'completed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_reservations_business on reservations(business_id);
create index if not exists idx_reservations_date on reservations(business_id, date);

-- --------------------------------------------------------------------------
-- events — lightweight analytics log
-- --------------------------------------------------------------------------
create table if not exists events (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  event_type text not null check (event_type in ('page_view', 'whatsapp_click', 'telegram_click', 'reservation_submit')),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_events_business on events(business_id);
create index if not exists idx_events_type on events(business_id, event_type);

-- --------------------------------------------------------------------------
-- staff, reviews — intentionally NOT created yet (see project plan notes).
-- Adding them later follows the same business_id FK + RLS pattern used above.
-- --------------------------------------------------------------------------