import { createClient } from "@supabase/supabase-js";

import { readEnv, requireEnv } from "./env";

export type ProgramStatus = "realise" | "en_cours" | "a_venir";
export type ResourceType = "photo" | "video" | "audio" | "document";

export type Member = {
  id: string;
  slug: string;
  nom: string;
  fonction: string;
  photo_url: string | null;
  ordre_affichage: number;
  bio: string | null;
  actif: boolean;
  created_at?: string;
  updated_at?: string;
};

export type Program = {
  id: string;
  titre: string;
  description: string;
  statut: ProgramStatus;
  date_debut: string | null;
  date_fin: string | null;
  created_at?: string;
  updated_at?: string;
};

export type Partner = {
  id: string;
  nom: string;
  logo_url: string | null;
  lien_externe: string | null;
  created_at?: string;
  updated_at?: string;
};

export type Resource = {
  id: string;
  type: ResourceType;
  titre: string;
  url_fichier: string | null;
  url_externe: string | null;
  date_publication: string;
  created_at?: string;
  updated_at?: string;
};

export type ContactSubmission = {
  id: string;
  nom: string;
  email: string;
  sujet: string;
  message: string;
  date_envoi: string;
  lu: boolean;
  archived_at: string | null;
};

export type AssistantKnowledge = {
  id: string;
  topic: string;
  content: string;
  active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

export function getSupabaseBrowserClient() {
  const url = requireEnv("VITE_SUPABASE_URL");
  const anonKey = requireEnv("VITE_SUPABASE_ANON_KEY");
  return createClient(url, anonKey);
}

export function hasSupabasePublicEnv() {
  return Boolean(readEnv("VITE_SUPABASE_URL") && readEnv("VITE_SUPABASE_ANON_KEY"));
}
