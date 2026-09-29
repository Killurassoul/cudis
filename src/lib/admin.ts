import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { hasSupabasePublicEnv } from "./supabase";

// ------------------------------------------------------------
// Socle commun du panneau /gestion :
// - session PHP sécurisée côté OVH, indépendante de Supabase Auth
// - proxy same-origin afin de garder la clé de service côté serveur
// - upload Storage avec validation MIME + taille (10 Mo max)
// ------------------------------------------------------------

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 Mo

export function getAdminSupabase(): SupabaseClient | null {
  if (!hasSupabasePublicEnv()) return null;
  const url = import.meta.env["VITE_SUPABASE_URL"] as string;
  const anonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"] as string;
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: adminProxyFetch },
  });
}

async function adminProxyFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init);
  const target = new URL(request.url);
  const configured = new URL(import.meta.env["VITE_SUPABASE_URL"] as string);
  const allowedPath = target.pathname.startsWith("/rest/v1/") || target.pathname.startsWith("/storage/v1/object/");
  if (target.origin !== configured.origin || !allowedPath) {
    throw new Error("Action non autorisée via le proxy d’administration.");
  }
  const headers = new Headers({
    "X-Admin-Target-Method": request.method,
    "X-Admin-Target-Path": `${target.pathname}${target.search}`,
  });
  for (const name of ["content-type", "prefer", "accept", "range", "content-range", "x-upsert", "cache-control"]) {
    const value = request.headers.get(name);
    if (value) headers.set(`X-Admin-${name}`, value);
  }
  const body = ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer();
  const proxyInit: RequestInit = {
    method: "POST",
    headers,
    credentials: "same-origin",
  };
  if (body !== undefined) proxyInit.body = body;
  return fetch("/api/admin.php?action=proxy", proxyInit);
}

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
};

export const ADMIN_ACCEPTED_MIME_TYPES = Object.keys(EXTENSION_BY_MIME);

// Certains navigateurs envoient un type vide ou générique (notamment
// pour les .docx) : on retombe alors sur l'extension du nom de fichier.
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "pdf", "docx", "txt"]);

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
    return { error: "Type de fichier non autorisé (acceptés : JPG, PNG, WEBP, PDF, DOCX, TXT)." };
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
