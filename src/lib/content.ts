import type { SupabaseClient } from "@supabase/supabase-js";

import {
  members as staticMembers,
  partners as staticPartnerNames,
  programs as staticPrograms,
} from "@/data/site";
import {
  getSupabaseBrowserClient,
  getSupabaseServiceClient,
  hasSupabasePublicEnv,
  tryGetSupabaseServiceClient,
  type Member,
  type Partner,
  type Program,
  type Resource,
  type ResourceType,
} from "./supabase";

// ------------------------------------------------------------
// Contenu public du site.
//
// Priorité à la base Supabase (ce que l'admin publie fait foi) ;
// repli automatique sur les données statiques si la base est vide
// ou injoignable : le site ne casse jamais en production.
//
// Les tables publiques sont lisibles par la clé anon (policies RLS
// de lecture ouverte) : côté navigateur on utilise le client anon,
// côté serveur la service role. Aucune clé secrète n'atteint
// jamais le navigateur.
// ------------------------------------------------------------

const SUPABASE_TIMEOUT_MS = 4000;

function getPublicClient(): SupabaseClient | null {
  if (!hasSupabasePublicEnv()) return null;
  return typeof window === "undefined" ? tryGetSupabaseServiceClient() : getSupabaseBrowserClient();
}

async function querySupabase<T>(
  work: (
    client: SupabaseClient,
  ) => PromiseLike<{ data: T | null; error: { message: string } | null }>,
): Promise<T | null> {
  try {
    const client = getPublicClient();
    if (!client) return null;
    const result = await Promise.race([
      work(client),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), SUPABASE_TIMEOUT_MS)),
    ]);
    if (!result) return null;
    if (result.error) {
      console.error("Public content query failed:", result.error.message);
      return null;
    }
    return result.data;
  } catch (error) {
    console.error("Public content query threw:", error);
    return null;
  }
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ---------- Replis statiques (contenu validé du site) ----------

function staticMemberRows(): Member[] {
  return staticMembers.map((member, index) => ({
    id: `static-${member.slug}`,
    slug: member.slug,
    nom: member.name,
    fonction: member.role,
    photo_url: null,
    ordre_affichage: index + 1,
    bio: null,
    actif: true,
  }));
}

function staticProgramRows(): Program[] {
  const statusMap: Record<string, Program["statut"]> = {
    Réalisé: "realise",
    "En cours": "en_cours",
    "À venir": "a_venir",
  };
  return staticPrograms.map((program) => ({
    id: `static-${program.slug}`,
    titre: program.title,
    description: program.description,
    statut: statusMap[program.status] ?? "a_venir",
    date_debut: null,
    date_fin: null,
  }));
}

function staticPartnerRows(): Partner[] {
  return staticPartnerNames.map((name) => ({
    id: `static-${slugify(name)}`,
    nom: name,
    logo_url: null,
    lien_externe: null,
  }));
}

// ---------- Membres ----------

export async function getPublicMembers(): Promise<Member[]> {
  const rows = await querySupabase<Member[]>((client) =>
    client
      .from("members")
      .select("*")
      .eq("actif", true)
      .order("ordre_affichage", { ascending: true }),
  );
  if (rows && rows.length > 0) return rows;
  return staticMemberRows();
}

export async function getMemberBySlug(slug: string): Promise<Member | null> {
  const rows = await querySupabase<Member[]>((client) =>
    client.from("members").select("*").eq("slug", slug).eq("actif", true).limit(1),
  );
  const found = rows?.[0];
  if (found) return found;
  return staticMemberRows().find((member) => member.slug === slug) ?? null;
}

// ---------- Programmes ----------

export async function getPublicPrograms(): Promise<Program[]> {
  const rows = await querySupabase<Program[]>((client) =>
    client.from("programs").select("*").order("created_at", { ascending: false }),
  );
  if (rows && rows.length > 0) return rows;
  return staticProgramRows();
}

// Les programmes en base sont identifiés par UUID ; les programmes
// statiques de repli gardent des identifiants lisibles
// (ex. /programmes/projet-dahiras).
export async function getProgramByIdentifier(identifier: string): Promise<Program | null> {
  if (!identifier.startsWith("static-")) {
    const rows = await querySupabase<Program[]>((client) =>
      client.from("programs").select("*").eq("id", identifier).limit(1),
    );
    const found = rows?.[0];
    if (found) return found;
  }
  return staticProgramRows().find((program) => program.id === `static-${identifier}`) ?? null;
}

// ---------- Partenaires ----------

export async function getPublicPartners(): Promise<Partner[]> {
  const rows = await querySupabase<Partner[]>((client) =>
    client.from("partners").select("*").order("nom", { ascending: true }),
  );
  if (rows && rows.length > 0) return rows;
  return staticPartnerRows();
}

// ---------- Ressources ----------

export async function getPublicResourcesByType(type: ResourceType): Promise<Resource[]> {
  const rows = await querySupabase<Resource[]>((client) =>
    client
      .from("resources")
      .select("*")
      .eq("type", type)
      .order("date_publication", { ascending: false })
      .limit(200),
  );
  return rows ?? [];
}
