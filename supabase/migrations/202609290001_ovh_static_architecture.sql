-- CUDIS: OVH static frontend, Supabase Edge Functions, editable AI knowledge.
-- Safe to re-run. Keep all provider keys in Supabase Function Secrets.

create table if not exists public.assistant_knowledge (
  id uuid primary key default gen_random_uuid(),
  topic text not null unique,
  content text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assistant_knowledge_topic_check check (length(trim(topic)) between 1 and 120),
  constraint assistant_knowledge_content_check check (length(trim(content)) between 1 and 5000)
);

create index if not exists assistant_knowledge_active_order_idx
  on public.assistant_knowledge (active, sort_order);

drop trigger if exists assistant_knowledge_touch_updated_at on public.assistant_knowledge;
create trigger assistant_knowledge_touch_updated_at
  before update on public.assistant_knowledge
  for each row execute function public.touch_updated_at();

alter table public.assistant_knowledge enable row level security;
drop policy if exists "Lecture des connaissances actives du chatbot" on public.assistant_knowledge;
create policy "Lecture des connaissances actives du chatbot"
  on public.assistant_knowledge for select to anon, authenticated
  using (active or public.is_cudis_admin());
drop policy if exists "Administration des connaissances du chatbot" on public.assistant_knowledge;
create policy "Administration des connaissances du chatbot"
  on public.assistant_knowledge for all to authenticated
  using (public.is_cudis_admin())
  with check (public.is_cudis_admin());

grant select on public.assistant_knowledge to anon, authenticated;
grant insert, update, delete on public.assistant_knowledge to authenticated;

insert into public.assistant_knowledge (topic, content, sort_order) values
  ('Mission', 'Le CUDIS œuvre à la consolidation du contrat social sénégalais et à la préservation du modèle islamique sénégalais connu pour sa tolérance.', 10),
  ('Présentation', 'Le Cadre Unitaire de l’Islam au Sénégal regroupe les comités scientifiques des confréries soufies et des mouvements islamiques réformistes du pays.', 20),
  ('Coordonnées', 'Adresse : Liberté 6, SCAT Urbam, derrière le Restaurant Pentola, Immeuble GSI, 2e étage, Dakar. E-mail : contact@cudis.com. Facebook : facebook.com/CadreUnitaireIslam. X : @Islam_Senegal.', 30)
on conflict (topic) do nothing;

-- Atomic quota reservations prevent concurrent requests from exceeding limits.
create or replace function public.reserve_assistant_usage(
  p_ip_hash text,
  p_provider text,
  p_model text
) returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count bigint;
  v_id bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_ip_hash));
  select count(*) into v_count
  from public.assistant_usage
  where ip_hash = p_ip_hash
    and created_at > pg_catalog.now() - interval '1 hour';
  if v_count >= 10 then
    return null;
  end if;
  insert into public.assistant_usage (ip_hash, provider, model, success)
  values (p_ip_hash, p_provider, p_model, false)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.reserve_assistant_usage(text, text, text) from public, anon, authenticated;
grant execute on function public.reserve_assistant_usage(text, text, text) to service_role;

create or replace function public.submit_contact_message(
  p_nom text,
  p_email text,
  p_sujet text,
  p_message text,
  p_ip_hash text,
  p_user_agent text
) returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count bigint;
  v_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('contact:' || p_ip_hash));
  select count(*) into v_count
  from public.contact_submissions
  where ip_hash = p_ip_hash
    and date_envoi > pg_catalog.now() - interval '1 hour';
  if v_count >= 5 then
    return null;
  end if;
  insert into public.contact_submissions (nom, email, sujet, message, ip_hash, user_agent)
  values (p_nom, p_email, p_sujet, p_message, p_ip_hash, left(p_user_agent, 500))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.submit_contact_message(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_contact_message(text, text, text, text, text, text) to service_role;
