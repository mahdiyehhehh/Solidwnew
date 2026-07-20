-- ==========================================================================
-- SolidW — Row Level Security Policies
-- Run AFTER 01_tables.sql. References is_admin() from 04_functions.sql —
-- if running files individually in order 01→02→03→04, run 04 first for
-- is_admin(), or paste all four files together in one editor run.
-- ==========================================================================

alter table plans enable row level security;
alter table profiles enable row level security;
alter table subscriptions enable row level security;
alter table businesses enable row level security;
alter table gallery_images enable row level security;
alter table services enable row level security;
alter table opening_hours enable row level security;
alter table reservations enable row level security;
alter table events enable row level security;

-- --------------------------------------------------------------------------
-- plans — public read (needed by planLimits.js, pricing page, upgrade flow)
-- --------------------------------------------------------------------------
create policy "plans_public_read" on plans
  for select
  using (true);

-- No insert/update/delete policies for anon/authenticated — plans are
-- managed directly in the SQL editor or via a future admin-only RPC.

-- --------------------------------------------------------------------------
-- profiles
-- --------------------------------------------------------------------------
create policy "profiles_select_own" on profiles
  for select
  using (auth.uid() = id or is_admin());

create policy "profiles_update_own" on profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id and plan_id = (select plan_id from profiles where id = auth.uid()));
  -- Users can update their own row but cannot self-upgrade plan_id directly;
  -- plan changes only happen via approve_subscription() (security definer).

create policy "profiles_admin_update" on profiles
  for update
  using (is_admin());

-- --------------------------------------------------------------------------
-- subscriptions
-- --------------------------------------------------------------------------
create policy "subscriptions_select_own_or_admin" on subscriptions
  for select
  using (auth.uid() = user_id or is_admin());

create policy "subscriptions_insert_own" on subscriptions
  for insert
  with check (auth.uid() = user_id and method = 'usdt_manual' and status = 'pending');
  -- Users can only create their own pending USDT upgrade requests.
  -- Approval/rejection happens exclusively via the admin RPCs, which bypass
  -- RLS as security definer functions — no update policy is needed here.

-- --------------------------------------------------------------------------
-- businesses
-- --------------------------------------------------------------------------
create policy "businesses_select_own" on businesses
  for select
  using (auth.uid() = owner_id or is_admin());

create policy "businesses_select_public" on businesses
  for select
  using (published = true);

create policy "businesses_insert_own" on businesses
  for insert
  with check (auth.uid() = owner_id);

create policy "businesses_update_own" on businesses
  for update
  using (auth.uid() = owner_id or is_admin());

create policy "businesses_delete_own" on businesses
  for delete
  using (auth.uid() = owner_id or is_admin());

-- --------------------------------------------------------------------------
-- gallery_images
-- --------------------------------------------------------------------------
create policy "gallery_select_own" on gallery_images
  for select
  using (
    exists (select 1 from businesses b where b.id = business_id and (b.owner_id = auth.uid() or is_admin()))
  );

create policy "gallery_select_public" on gallery_images
  for select
  using (
    exists (select 1 from businesses b where b.id = business_id and b.published = true)
  );

create policy "gallery_insert_own" on gallery_images
  for insert
  with check (
    exists (select 1 from businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

create policy "gallery_update_own" on gallery_images
  for update
  using (
    exists (select 1 from businesses b where b.id = business_id and (b.owner_id = auth.uid() or is_admin()))
  );

create policy "gallery_delete_own" on gallery_images
  for delete
  using (
    exists (select 1 from businesses b where b.id = business_id and (b.owner_id = auth.uid() or is_admin()))
  );

-- --------------------------------------------------------------------------
-- services
-- --------------------------------------------------------------------------
create policy "services_select_own" on services
  for select
  using (
    exists (select 1 from businesses b where b.id = business_id and (b.owner_id = auth.uid() or is_admin()))
  );

create policy "services_select_public" on services
  for select
  using (
    exists (select 1 from businesses b where b.id = business_id and b.published = true)
  );

create policy "services_insert_own" on services
  for insert
  with check (
    exists (select 1 from businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

create policy "services_update_own" on services
  for update
  using (
    exists (select 1 from businesses b where b.id = business_id and (b.owner_id = auth.uid() or is_admin()))
  );

create policy "services_delete_own" on services
  for delete
  using (
    exists (select 1 from businesses b where b.id = business_id and (b.owner_id = auth.uid() or is_admin()))
  );

-- --------------------------------------------------------------------------
-- opening_hours
-- --------------------------------------------------------------------------
create policy "hours_select_own" on opening_hours
  for select
  using (
    exists (select 1 from businesses b where b.id = business_id and (b.owner_id = auth.uid() or is_admin()))
  );

create policy "hours_select_public" on opening_hours
  for select
  using (
    exists (select 1 from businesses b where b.id = business_id and b.published = true)
  );

create policy "hours_insert_own" on opening_hours
  for insert
  with check (
    exists (select 1 from businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

create policy "hours_update_own" on opening_hours
  for update
  using (
    exists (select 1 from businesses b where b.id = business_id and (b.owner_id = auth.uid() or is_admin()))
  );

create policy "hours_delete_own" on opening_hours
  for delete
  using (
    exists (select 1 from businesses b where b.id = business_id and (b.owner_id = auth.uid() or is_admin()))
  );

-- --------------------------------------------------------------------------
-- reservations
-- --------------------------------------------------------------------------
create policy "reservations_select_own" on reservations
  for select
  using (
    exists (select 1 from businesses b where b.id = business_id and (b.owner_id = auth.uid() or is_admin()))
  );

-- Public (anon) can INSERT reservations only — this is the booking form
-- on /site. No public select/update/delete on reservations at all, so a
-- customer can never read or tamper with other customers' bookings.
create policy "reservations_insert_public" on reservations
  for insert
  with check (
    exists (select 1 from businesses b where b.id = business_id and b.published = true and b.accepting_bookings = true)
  );

create policy "reservations_update_own" on reservations
  for update
  using (
    exists (select 1 from businesses b where b.id = business_id and (b.owner_id = auth.uid() or is_admin()))
  );

create policy "reservations_delete_own" on reservations
  for delete
  using (
    exists (select 1 from businesses b where b.id = business_id and (b.owner_id = auth.uid() or is_admin()))
  );

-- --------------------------------------------------------------------------
-- events — write-only from the public side, read-only for the owner/admin
-- --------------------------------------------------------------------------
create policy "events_select_own" on events
  for select
  using (
    exists (select 1 from businesses b where b.id = business_id and (b.owner_id = auth.uid() or is_admin()))
  );

create policy "events_insert_public" on events
  for insert
  with check (
    exists (select 1 from businesses b where b.id = business_id and b.published = true)
  );