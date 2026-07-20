-- ==========================================================================
-- SolidW — Helper Functions & Triggers
-- Run this LAST (after 01, 02, 03). Some functions here are referenced by
-- policies in 02_policies.sql, so if you're doing a from-scratch run in the
-- Supabase SQL editor, execute this file's `is_admin()` / plan-limit
-- functions before 02_policies.sql, or simply run all four files in one
-- pasted block — Postgres resolves the order within a single transaction.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- is_admin() — checks the JWT email against a hardcoded admin email.
-- IMPORTANT: replace 'you@example.com' with the same value as
-- assets/js/config.js ADMIN_EMAIL before running in production.
-- --------------------------------------------------------------------------
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (auth.jwt() ->> 'email') = 'you@example.com',
    false
  );
$$;

-- --------------------------------------------------------------------------
-- handle_new_user() — auto-creates a profiles row when a new auth.users
-- row is inserted (i.e. right after sign-up). Defaults new users to 'free'.
-- --------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, plan_id, status)
  values (new.id, new.email, 'free', 'active')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- --------------------------------------------------------------------------
-- generate_unique_slug(base_name) — used by the dashboard when a business
-- is first created, called via RPC from business.js so slug collisions are
-- resolved server-side rather than relying purely on client-side slugify().
-- --------------------------------------------------------------------------
create or replace function generate_unique_slug(base_name text)
returns text
language plpgsql
as $$
declare
  candidate text;
  suffix integer := 0;
  base_slug text;
begin
  base_slug := lower(regexp_replace(trim(base_name), '[^a-zA-Z0-9\s-]', '', 'g'));
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  if base_slug = '' then
    base_slug := 'business';
  end if;

  candidate := base_slug;
  while exists (select 1 from businesses where slug = candidate) loop
    suffix := suffix + 1;
    candidate := base_slug || '-' || suffix;
  end loop;

  return candidate;
end;
$$;

-- --------------------------------------------------------------------------
-- check_business_limit() — trigger enforcing plans.max_businesses at the
-- database level as a defense-in-depth backstop to planLimits.js (which
-- checks client-side before showing the "create business" UI at all).
-- --------------------------------------------------------------------------
create or replace function check_business_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id text;
  v_max integer;
  v_count integer;
begin
  select plan_id into v_plan_id from profiles where id = new.owner_id;
  select max_businesses into v_max from plans where id = v_plan_id;

  if v_max is not null and v_max > 0 then
    select count(*) into v_count from businesses where owner_id = new.owner_id;
    if v_count >= v_max then
      raise exception 'Business limit reached for current plan (%).', v_plan_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_business_limit on businesses;
create trigger trg_check_business_limit
  before insert on businesses
  for each row execute function check_business_limit();

-- --------------------------------------------------------------------------
-- check_gallery_limit() — same pattern for plans.max_gallery_images.
-- --------------------------------------------------------------------------
create or replace function check_gallery_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_plan_id text;
  v_max integer;
  v_count integer;
begin
  select owner_id into v_owner from businesses where id = new.business_id;
  select plan_id into v_plan_id from profiles where id = v_owner;
  select max_gallery_images into v_max from plans where id = v_plan_id;

  if v_max is not null and v_max > 0 then
    select count(*) into v_count from gallery_images where business_id = new.business_id;
    if v_count >= v_max then
      raise exception 'Gallery image limit reached for current plan (%).', v_plan_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_gallery_limit on gallery_images;
create trigger trg_check_gallery_limit
  before insert on gallery_images
  for each row execute function check_gallery_limit();

-- --------------------------------------------------------------------------
-- check_booking_limit() — enforces plans.max_bookings_per_day OR the
-- business-level override (businesses.max_bookings_per_day), whichever
-- is set. Business-level override takes precedence when non-null.
-- --------------------------------------------------------------------------
create or replace function check_booking_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_plan_id text;
  v_plan_max integer;
  v_biz_max integer;
  v_effective_max integer;
  v_count integer;
begin
  select owner_id, max_bookings_per_day into v_owner, v_biz_max
    from businesses where id = new.business_id;
  select plan_id into v_plan_id from profiles where id = v_owner;
  select max_bookings_per_day into v_plan_max from plans where id = v_plan_id;

  v_effective_max := coalesce(v_biz_max, v_plan_max);

  if v_effective_max is not null and v_effective_max > 0 then
    select count(*) into v_count
      from reservations
      where business_id = new.business_id
        and date = new.date
        and status != 'cancelled';
    if v_count >= v_effective_max then
      raise exception 'Booking limit reached for this business on % (limit %).', new.date, v_effective_max;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_booking_limit on reservations;
create trigger trg_check_booking_limit
  before insert on reservations
  for each row execute function check_booking_limit();

-- --------------------------------------------------------------------------
-- approve_subscription(subscription_id) — admin-only RPC used by
-- admin/users.js to approve a pending USDT upgrade request. Updates both
-- subscriptions and profiles.plan_id atomically.
-- --------------------------------------------------------------------------
create or replace function approve_subscription(p_subscription_id uuid, p_period_days integer default 30)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_plan_id text;
begin
  if not is_admin() then
    raise exception 'Only admin may approve subscriptions.';
  end if;

  select user_id, plan_id into v_user_id, v_plan_id
    from subscriptions where id = p_subscription_id;

  if v_user_id is null then
    raise exception 'Subscription not found.';
  end if;

  update subscriptions
    set status = 'approved',
        reviewed_at = now(),
        reviewed_by = (select id from profiles where email = (auth.jwt() ->> 'email')),
        period_start = now(),
        period_end = now() + (p_period_days || ' days')::interval
    where id = p_subscription_id;

  update profiles set plan_id = v_plan_id where id = v_user_id;
end;
$$;

-- --------------------------------------------------------------------------
-- reject_subscription(subscription_id) — admin-only RPC counterpart.
-- --------------------------------------------------------------------------
create or replace function reject_subscription(p_subscription_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Only admin may reject subscriptions.';
  end if;

  update subscriptions
    set status = 'rejected',
        reviewed_at = now(),
        reviewed_by = (select id from profiles where email = (auth.jwt() ->> 'email'))
    where id = p_subscription_id;
end;
$$;

-- --------------------------------------------------------------------------
-- admin_set_business_status / suspend/unsuspend user — small admin RPCs
-- --------------------------------------------------------------------------
create or replace function admin_set_user_status(p_user_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Only admin may change user status.';
  end if;
  if p_status not in ('active', 'suspended') then
    raise exception 'Invalid status.';
  end if;
  update profiles set status = p_status where id = p_user_id;
end;
$$;