drop function if exists public.increment_work_download(text);
drop table if exists public.work_downloads;
drop table if exists public.work_download_targets;

create table if not exists public.work_download_targets (
  slug text primary key,
  label text not null,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.work_downloads (
  slug text primary key references public.work_download_targets(slug) on delete cascade,
  download_count bigint not null default 0 check (download_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.work_download_targets (slug, label)
values ('minecraft-obj-cubizer', 'Minecraft OBJ Cubizer')
on conflict (slug) do update
set
  label = excluded.label,
  is_public = true;

alter table public.work_download_targets enable row level security;
alter table public.work_downloads enable row level security;

drop policy if exists "Public can read download targets" on public.work_download_targets;
create policy "Public can read download targets"
on public.work_download_targets
for select
to anon, authenticated
using (is_public);

drop policy if exists "Public can read download counters" on public.work_downloads;
create policy "Public can read download counters"
on public.work_downloads
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.work_download_targets as target
    where target.slug = work_downloads.slug
      and target.is_public
  )
);

create or replace function public.increment_work_download(p_slug text)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_slug text := trim(p_slug);
  v_count bigint;
begin
  if v_slug is null or v_slug = '' then
    raise exception 'download slug is required';
  end if;

  if not exists (
    select 1
    from public.work_download_targets
    where slug = v_slug
      and is_public
  ) then
    raise exception 'unknown download target: %', v_slug;
  end if;

  insert into public.work_downloads (slug, download_count)
  values (v_slug, 1)
  on conflict (slug) do update
  set
    download_count = public.work_downloads.download_count + 1,
    updated_at = now()
  returning download_count into v_count;

  return v_count;
end;
$$;

grant usage on schema public to anon, authenticated;
grant select on public.work_download_targets to anon, authenticated;
grant select on public.work_downloads to anon, authenticated;

revoke insert, update, delete on public.work_download_targets from anon, authenticated;
revoke insert, update, delete on public.work_downloads from anon, authenticated;

revoke all on function public.increment_work_download(text) from public;
grant execute on function public.increment_work_download(text) to anon, authenticated;
