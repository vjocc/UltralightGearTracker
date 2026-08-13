-- ============================================================================
-- Ultralight Gear Tracker — initial schema + RLS
-- Architect-approved design. Forward-only migration.
-- Order: (1) trigger fn, (2) categories, (3) gear_items, (4) wishlist_items,
-- (5) RLS enable + policies, (6) indexes.
-- ============================================================================

-- ----- 1) shared trigger function ------------------------------------------
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ----- 2) categories --------------------------------------------------------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  slug        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, slug)
);
create index categories_user_id_idx on public.categories (user_id);
create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.tg_set_updated_at();

-- ----- 3) gear_items --------------------------------------------------------
create table public.gear_items (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid()
                                  references auth.users(id) on delete cascade,
  name                text not null,
  category_id         uuid not null references public.categories(id) on delete restrict,
  weight_g            integer not null check (weight_g >= 0),
  price               numeric(10,2) check (price is null or price >= 0),
  excluded_from_base  boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index gear_items_user_id_idx     on public.gear_items (user_id);
create index gear_items_category_id_idx on public.gear_items (category_id);
create trigger gear_items_set_updated_at
  before update on public.gear_items
  for each row execute function public.tg_set_updated_at();

-- ----- 4) wishlist_items ----------------------------------------------------
create table public.wishlist_items (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid()
                              references auth.users(id) on delete cascade,
  name            text not null,
  category_id     uuid not null references public.categories(id) on delete restrict,
  retailer_url    text not null,
  current_price   numeric(10,2) check (current_price is null or current_price >= 0),
  last_checked_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index wishlist_items_user_id_idx     on public.wishlist_items (user_id);
create index wishlist_items_category_id_idx on public.wishlist_items (category_id);
create trigger wishlist_items_set_updated_at
  before update on public.wishlist_items
  for each row execute function public.tg_set_updated_at();

-- ----- 5) RLS enable + per-table policies -----------------------------------
alter table public.categories      enable row level security;
alter table public.gear_items      enable row level security;
alter table public.wishlist_items  enable row level security;

-- categories
create policy categories_select_own on public.categories
  for select using (auth.uid() = user_id);
create policy categories_insert_own on public.categories
  for insert with check (auth.uid() = user_id);
create policy categories_update_own on public.categories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy categories_delete_own on public.categories
  for delete using (auth.uid() = user_id);

-- gear_items
create policy gear_items_select_own on public.gear_items
  for select using (auth.uid() = user_id);
create policy gear_items_insert_own on public.gear_items
  for insert with check (auth.uid() = user_id);
create policy gear_items_update_own on public.gear_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy gear_items_delete_own on public.gear_items
  for delete using (auth.uid() = user_id);

-- wishlist_items
create policy wishlist_items_select_own on public.wishlist_items
  for select using (auth.uid() = user_id);
create policy wishlist_items_insert_own on public.wishlist_items
  for insert with check (auth.uid() = user_id);
create policy wishlist_items_update_own on public.wishlist_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy wishlist_items_delete_own on public.wishlist_items
  for delete using (auth.uid() = user_id);

-- Realtime intentionally NOT enabled. Opt-in per table later:
--   alter publication supabase_realtime add table public.gear_items;