-- Seed: two test users + a couple of gear rows.
-- Pre-req: create alice@test.local and bob@test.local (password 'password')
-- in Supabase Studio → Authentication → Users → Add user, OR via
-- auth.admin.createUser() before running this seed.
-- Idempotent: uses ON CONFLICT DO NOTHING so re-running does not duplicate.

insert into public.categories (user_id, name, slug)
select id, 'Shelter', 'shelter'
  from auth.users where email = 'alice@test.local'
  on conflict (user_id, slug) do nothing;

insert into public.categories (user_id, name, slug)
select id, 'Sleep', 'sleep'
  from auth.users where email = 'alice@test.local'
  on conflict (user_id, slug) do nothing;

insert into public.categories (user_id, name, slug)
select id, 'Shelter', 'shelter'
  from auth.users where email = 'bob@test.local'
  on conflict (user_id, slug) do nothing;

-- One gear row for Alice to prove the JOIN + RLS pipeline.
insert into public.gear_items (user_id, category_id, name, weight_g, price)
select u.id, c.id, 'Tarp', 320, 180.00
  from auth.users u
  join public.categories c on c.user_id = u.id
 where u.email = 'alice@test.local'
   and c.slug = 'shelter'
   and not exists (
     select 1 from public.gear_items g
      where g.user_id = u.id and g.name = 'Tarp'
   );