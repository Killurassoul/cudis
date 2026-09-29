-- ============================================================
-- CUDIS — Backend Supabase complet
-- Coller en une seule fois dans le SQL Editor de Supabase.
-- Idempotent : peut être réexécuté sans erreur.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. Types énumérés
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'program_status') then
    create type public.program_status as enum ('realise', 'en_cours', 'a_venir');
  end if;
  if not exists (select 1 from pg_type where typname = 'resource_type') then
    create type public.resource_type as enum ('photo', 'video', 'audio', 'document');
  end if;
end
$$;

-- ------------------------------------------------------------
-- 2. Tables
-- ------------------------------------------------------------

create table if not exists public.members (
  id            uuid        primary key default gen_random_uuid(),
  slug          text        not null unique,
  nom           text        not null,
  fonction      text        not null,
  photo_url     text,
  ordre_affichage integer   not null default 0,
  bio           text,
  actif         boolean     not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.programs (
  id          uuid        primary key default gen_random_uuid(),
  titre       text        not null,
  description text        not null,
  statut      public.program_status not null default 'a_venir',
  date_debut  date,
  date_fin    date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint programs_dates_check check (date_fin is null or date_debut is null or date_fin >= date_debut)
);

create table if not exists public.partners (
  id           uuid        primary key default gen_random_uuid(),
  nom          text        not null,
  logo_url     text,
  lien_externe text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.resources (
  id               uuid        primary key default gen_random_uuid(),
  type             public.resource_type not null,
  titre            text        not null,
  url_fichier      text,
  url_externe      text,
  date_publication date        not null default current_date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint resources_url_check check (url_fichier is not null or url_externe is not null)
);

create table if not exists public.contact_submissions (
  id         uuid        primary key default gen_random_uuid(),
  nom        text        not null,
  email      text        not null,
  sujet      text        not null,
  message    text        not null,
  ip_hash    text,
  user_agent text,
  lu         boolean     not null default false,
  archived_at timestamptz,
  date_envoi timestamptz not null default now()
);

create table if not exists public.assistant_usage (
  id         bigint      generated always as identity primary key,
  ip_hash    text,
  provider   text        not null,
  model      text        not null,
  success    boolean     not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. Index
-- ------------------------------------------------------------
create index if not exists members_ordre_idx          on public.members (ordre_affichage);
create index if not exists members_actif_idx          on public.members (actif, ordre_affichage);
create index if not exists programs_statut_idx        on public.programs (statut, created_at desc);
create index if not exists resources_type_idx         on public.resources (type, date_publication desc);
create index if not exists contact_date_idx           on public.contact_submissions (date_envoi desc);
create index if not exists contact_ip_idx             on public.contact_submissions (ip_hash);
create index if not exists assistant_usage_created_idx on public.assistant_usage (created_at desc);
create index if not exists assistant_usage_ip_idx     on public.assistant_usage (ip_hash);

-- ------------------------------------------------------------
-- 4. Trigger updated_at automatique
-- ------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists members_touch_updated_at  on public.members;
create trigger members_touch_updated_at
  before update on public.members
  for each row execute function public.touch_updated_at();

drop trigger if exists programs_touch_updated_at on public.programs;
create trigger programs_touch_updated_at
  before update on public.programs
  for each row execute function public.touch_updated_at();

drop trigger if exists partners_touch_updated_at on public.partners;
create trigger partners_touch_updated_at
  before update on public.partners
  for each row execute function public.touch_updated_at();

drop trigger if exists resources_touch_updated_at on public.resources;
create trigger resources_touch_updated_at
  before update on public.resources
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- 5. Table admin_emails + fonction is_cudis_admin
--    Approche sans ALTER ROLE (pas de droits superuser requis).
--    Ajouter les admins avec : INSERT INTO public.admin_emails (email) VALUES ('ton@email.com');
-- ------------------------------------------------------------
create table if not exists public.admin_emails (
  email text primary key
);

-- Insérer ton e-mail admin ici (modifie avant d'exécuter)
insert into public.admin_emails (email) values
  ('Rassoulgye@gmail.com')
on conflict do nothing;

create or replace function public.is_cudis_admin()
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_emails
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ------------------------------------------------------------
-- 6. Row Level Security
-- ------------------------------------------------------------

-- admin_emails (lecture réservée à la fonction interne, pas au public)
alter table public.admin_emails enable row level security;
-- Aucune policy publique : seule la fonction security definer peut lire

-- members
alter table public.members enable row level security;
drop policy if exists "Lecture publique des membres"   on public.members;
create policy "Lecture publique des membres"
  on public.members for select using (true);
drop policy if exists "Ecriture admin des membres"     on public.members;
create policy "Ecriture admin des membres"
  on public.members for all to authenticated
  using (public.is_cudis_admin())
  with check (public.is_cudis_admin());

-- programs
alter table public.programs enable row level security;
drop policy if exists "Lecture publique des programmes" on public.programs;
create policy "Lecture publique des programmes"
  on public.programs for select using (true);
drop policy if exists "Ecriture admin des programmes"   on public.programs;
create policy "Ecriture admin des programmes"
  on public.programs for all to authenticated
  using (public.is_cudis_admin())
  with check (public.is_cudis_admin());

-- partners
alter table public.partners enable row level security;
drop policy if exists "Lecture publique des partenaires" on public.partners;
create policy "Lecture publique des partenaires"
  on public.partners for select using (true);
drop policy if exists "Ecriture admin des partenaires"   on public.partners;
create policy "Ecriture admin des partenaires"
  on public.partners for all to authenticated
  using (public.is_cudis_admin())
  with check (public.is_cudis_admin());

-- resources
alter table public.resources enable row level security;
drop policy if exists "Lecture publique des ressources" on public.resources;
create policy "Lecture publique des ressources"
  on public.resources for select using (true);
drop policy if exists "Ecriture admin des ressources"   on public.resources;
create policy "Ecriture admin des ressources"
  on public.resources for all to authenticated
  using (public.is_cudis_admin())
  with check (public.is_cudis_admin());

-- contact_submissions (lecture/update admin, insert réservé au service role)
alter table public.contact_submissions enable row level security;
drop policy if exists "Admin lit les messages"     on public.contact_submissions;
create policy "Admin lit les messages"
  on public.contact_submissions for select to authenticated
  using (public.is_cudis_admin());
drop policy if exists "Admin archive les messages" on public.contact_submissions;
create policy "Admin archive les messages"
  on public.contact_submissions for update to authenticated
  using (public.is_cudis_admin())
  with check (public.is_cudis_admin());

-- assistant_usage (insert service role, select admin)
alter table public.assistant_usage enable row level security;
drop policy if exists "Admin consulte l'usage IA" on public.assistant_usage;
create policy "Admin consulte l'usage IA"
  on public.assistant_usage for select to authenticated
  using (public.is_cudis_admin());

-- ------------------------------------------------------------
-- 7. Storage — buckets + policies (syntaxe compatible Supabase)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('member-photos',  'member-photos',  true, 10485760,
   array['image/jpeg','image/png','image/webp','image/gif']),
  ('partner-logos',  'partner-logos',  true, 10485760,
   array['image/jpeg','image/png','image/webp','image/svg+xml']),
  ('resources',      'resources',      true, 10485760,
   array['image/jpeg','image/png','image/webp','video/mp4','audio/mpeg','audio/mp4','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

-- member-photos
drop policy if exists "Lecture publique member-photos"  on storage.objects;
create policy "Lecture publique member-photos"
  on storage.objects for select
  using (bucket_id = 'member-photos');

drop policy if exists "Upload admin member-photos"      on storage.objects;
create policy "Upload admin member-photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'member-photos' and public.is_cudis_admin());

drop policy if exists "Update admin member-photos"      on storage.objects;
create policy "Update admin member-photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'member-photos' and public.is_cudis_admin());

drop policy if exists "Delete admin member-photos"      on storage.objects;
create policy "Delete admin member-photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'member-photos' and public.is_cudis_admin());

-- partner-logos
drop policy if exists "Lecture publique partner-logos"  on storage.objects;
create policy "Lecture publique partner-logos"
  on storage.objects for select
  using (bucket_id = 'partner-logos');

drop policy if exists "Upload admin partner-logos"      on storage.objects;
create policy "Upload admin partner-logos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'partner-logos' and public.is_cudis_admin());

drop policy if exists "Update admin partner-logos"      on storage.objects;
create policy "Update admin partner-logos"
  on storage.objects for update to authenticated
  using (bucket_id = 'partner-logos' and public.is_cudis_admin());

drop policy if exists "Delete admin partner-logos"      on storage.objects;
create policy "Delete admin partner-logos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'partner-logos' and public.is_cudis_admin());

-- resources
drop policy if exists "Lecture publique resources"      on storage.objects;
create policy "Lecture publique resources"
  on storage.objects for select
  using (bucket_id = 'resources');

drop policy if exists "Upload admin resources"          on storage.objects;
create policy "Upload admin resources"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'resources' and public.is_cudis_admin());

drop policy if exists "Update admin resources"          on storage.objects;
create policy "Update admin resources"
  on storage.objects for update to authenticated
  using (bucket_id = 'resources' and public.is_cudis_admin());

drop policy if exists "Delete admin resources"          on storage.objects;
create policy "Delete admin resources"
  on storage.objects for delete to authenticated
  using (bucket_id = 'resources' and public.is_cudis_admin());

-- ------------------------------------------------------------
-- 8. Données de départ (idempotent)
-- ------------------------------------------------------------
insert into public.members (slug, nom, fonction, ordre_affichage, actif) values
  ('cheikh-tidiane-sy',          'Cheikh Tidiane SY',          'Président',                                           1,  true),
  ('serigne-bou-mohamed-kounta', 'Serigne Bou Mouhamed Kounta','Vice-président',                                      2,  true),
  ('cheikh-ahmed-saloum-dieng',  'Cheikh Ahmed Saloum Dieng',  'Vice-président',                                      3,  true),
  ('ouztaz-makhtar-kebe',        'Ouztaz Makhtar Kébé',        'Vice-président chargé de la communication',           4,  true),
  ('cherif-mballo',              'Cherif Mballo',              'Vice-président chargé des relations avec les institutions', 5, true),
  ('abdou-aziz-mbacke-majalis',  'Abdou Aziz Mbacké Majalis',  'Vice-président chargé des projets',                   6,  true),
  ('djibril-laye-diop',          'Djibril Laye Diop',          'Vice-président chargé de la médiation',               7,  true),
  ('dr-abdoullah-lam',           'Dr Abdoullah Lam',           'Vice-président chargé de la mobilisation',            8,  true),
  ('pr-malamine-kourouma',       'Pr Malamine Kourouma',       'Vice-président chargé de la commission scientifique',  9,  true),
  ('mame-cheikh-mbacke',         'Mame Cheikh Mbacké',         'Vice-président chargé des familles religieuses',      10, true),
  ('dr-cheikh-gueye',            'Dr Cheikh Guèye',            'Secrétaire général',                                  11, true),
  ('dr-mamarame-seck',           'Dr Mamarame Seck',           'Secrétaire général adjoint',                          12, true),
  ('pr-fatou-sarr-sow',          'Pr Fatou Sarr Sow',          'Trésorière générale',                                 13, true),
  ('dr-moustapha-mbengue',       'Dr Moustapha Mbengue',       'Trésorier général adjoint',                           14, true),
  ('serigne-sam-bousso',         'Serigne Sam Bousso',         'Membre du bureau',                                    15, true),
  ('dr-mamadou-dia',             'Dr Mamadou Dia',             'Membre du bureau',                                    16, true)
on conflict (slug) do nothing;

insert into public.programs (titre, description, statut)
select v.titre, v.description, v.statut::public.program_status
from (values
  (
    'Projet Dahiras',
    'Former sur deux ans plus de 20 000 dahiras et associations islamiques à travers le pays pour en faire des espaces d''éducation spirituelle, civique et économique, avec les femmes rurales et les jeunes en priorité.',
    'en_cours'
  ),
  (
    'Lutte contre la haine et la désinformation',
    'Campagne de lutte contre la haine et la désinformation sur les réseaux sociaux, menée en partenariat avec Meta.',
    'realise'
  ),
  (
    'Semaine nationale du vivre-ensemble',
    'Manifestations culturelles, scientifiques et religieuses à travers le pays.',
    'a_venir'
  )
) as v(titre, description, statut)
where not exists (select 1 from public.programs limit 1);

insert into public.partners (nom) values
  ('OSIWA'),
  ('Commission Scientifique Layène'),
  ('RIS'),
  ('GSI'),
  ('UCAD'),
  ('AIS')
on conflict do nothing;
