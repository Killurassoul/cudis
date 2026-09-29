import type { Session, SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseBrowserClient, hasSupabasePublicEnv } from "./supabase";

// ------------------------------------------------------------
// Socle commun du panneau /gestion :
// - session Supabase Auth (pas d'inscription publique)
// - liste blanche d'e-mails (couche de confort ; la vraie
//   autorisation reste les policies RLS côté base)
// - upload Storage avec validation MIME + taille (10 Mo max)
// ------------------------------------------------------------

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 Mo

function readAdminEmails(): string[] {
  const raw =
    typeof import.meta !== "undefined" ? import.meta.env?.["VITE_ADMIN_EMAILS"] : undefined;
  return String(raw ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);
}

export function isAdminEmailAllowed(session: Session | null): boolean {
  const allowed = readAdminEmails();
  const email = session?.user.email?.toLowerCase() ?? "";
  if (allowed.length === 0) return email.length > 0; // pas de liste définie : la RLS fait foi
  return allowed.includes(email);
}

export function getAdminSupabase(): SupabaseClient | null {
  return hasSupabasePublicEnv() ? getSupabaseBrowserClient() : null;
}

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

export const ADMIN_ACCEPTED_MIME_TYPES = Object.keys(EXTENSION_BY_MIME);

// Certains navigateurs envoient un type vide ou générique (notamment
// pour les .docx) : on retombe alors sur l'extension du nom de fichier.
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "pdf", "docx"]);

function extensionFromName(name: string): string | undefined {
  const match = /\.([a-z0-9]{2,5})$/i.exec(name);
  return match?.[1]?.toLowerCase();
}

function resolveExtension(mime: string, name: string): string | undefined {
  return EXTENSION_BY_MIME[mime] ?? extensionFromName(name);
}

export type UploadResult = { url: string } | { error: string };

export async function uploadAdminFile(
  supabase: SupabaseClient,
  bucket: string,
  file: File,
): Promise<UploadResult> {
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: "Fichier trop volumineux (maximum 10 Mo)." };
  }
  const extension = resolveExtension(file.type, file.name);
  if (!extension || !ALLOWED_EXTENSIONS.has(extension)) {
    return { error: "Type de fichier non autorisé (acceptés : JPG, PNG, WEBP, PDF, DOCX)." };
  }

  const path = `${new Date().getFullYear()}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: false,
    ...(file.type ? { contentType: file.type } : {}),
  });
  if (error) return { error: "Téléversement refusé par le serveur." };

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl };
}

export function describeSupabaseError(error: unknown): string {
  const message = (error as { message?: string } | null)?.message ?? "";
  if (/row-level security/i.test(message)) {
    return "Action refusée : votre compte n'a pas les droits d'administration (liste app.admin_emails).";
  }
  return message.length > 0 ? message : "Opération impossible.";
}
