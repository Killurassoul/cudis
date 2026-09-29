import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { readEnv } from "@/lib/env";
import { callAssistantProvider, resolveAssistantProvider } from "@/lib/ai-providers";
import { tryGetSupabaseServiceClient } from "@/lib/supabase";
import { checkRateLimit, getClientIp, json, sha256 } from "@/lib/server-utils";

// ------------------------------------------------------------
// Assistant conversationnel du site CUDIS.
//
// DÉSACTIVÉ PAR DÉFAUT : la route ne répond que si
// ENABLE_AI_ASSISTANT=true. Le périmètre du modèle est strictement
// limité au contenu public du site (mission, membres, programmes,
// contacts) — rien d'autre, pas d'accès internet, pas de mémoire.
// Chaque appel est journalisé dans assistant_usage (métadonnées
// uniquement, jamais le contenu des conversations).
// ------------------------------------------------------------

const assistantSchema = z.object({
  question: z.string().trim().min(3).max(800),
});

const PER_IP_LIMIT = 10; // messages / heure / IP
const RATE_WINDOW_MS = 60 * 60 * 1000;

async function buildSystemPrompt(): Promise<string> {
  // Le périmètre vient de la base : ce que l'admin publie est ce que
  // l'assistant connaît. Rien d'autre n'est envoyé au modèle.
  const mission =
    "L'objectif du CUDIS est la consolidation du contrat social sénégalais et la préservation du modèle islamique sénégalais connu pour sa tolérance.";
  const history =
    "Le Cadre Unitaire de l'Islam au Sénégal regroupe les comités scientifiques des confréries soufies et des mouvements islamiques réformistes du pays.";
  const memberLines: string[] = [];
  const programLines: string[] = [];

  try {
    const supabase = tryGetSupabaseServiceClient();
    if (!supabase) throw new Error("Supabase indisponible");
    const [membersResult, programsResult] = await Promise.all([
      supabase
        .from("members")
        .select("nom, fonction, actif")
        .eq("actif", true)
        .order("ordre_affichage"),
      supabase
        .from("programs")
        .select("titre, description, statut")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    if (membersResult.data) {
      for (const member of membersResult.data as Array<{ nom: string; fonction: string }>) {
        memberLines.push(`- ${member.nom} : ${member.fonction}`);
      }
    }
    if (programsResult.data) {
      const statutLabel: Record<string, string> = {
        realise: "réalisé",
        en_cours: "en cours",
        a_venir: "à venir",
      };
      for (const program of programsResult.data as Array<{
        titre: string;
        description: string;
        statut: string;
      }>) {
        programLines.push(
          `- ${program.titre} (${statutLabel[program.statut] ?? program.statut}) : ${program.description}`,
        );
      }
    }
  } catch (error) {
    // Dégradation maîtrisée : sans base, on répond quand même avec
    // le socle de contenu statique.
    console.error("Assistant context query failed", error);
  }

  if (memberLines.length === 0) {
    memberLines.push("- Bureau non publié pour le moment.");
  }
  if (programLines.length === 0) {
    programLines.push("- Aucun programme publié pour le moment.");
  }

  return [
    "Tu es l'assistant conversationnel officiel du site du CUDIS, Cadre Unitaire de l'Islam au Sénégal.",
    "Tu réponds UNIQUEMENT à partir des informations ci-dessous, en français, sur un ton sobre et respectueux.",
    "N'invente aucune information. Si l'information demandée n'est pas dans ce document, dis que tu ne peux pas y répondre",
    "et invite poliment la personne à écrire via le formulaire de contact du site ou la page Facebook du CUDIS.",
    "Refuse poliment toute question hors du périmètre du CUDIS (politique, autres organisations, conseils personnels, etc.).",
    "Réponds en quelques phrases au maximum.",
    "",
    "== PÉRIMÈTRE AUTORISÉ =:",
    "",
    "Mission :",
    mission,
    "",
    "Historique :",
    history,
    "",
    "Membres du bureau :",
    ...memberLines,
    "",
    "Programmes :",
    ...programLines,
    "",
    "Coordonnées :",
    "- Adresse : Liberté 6, SCAT Urbam, derrière le Restaurant Pentola, Immeuble GSI, 2e étage, Dakar.",
    "- E-mail : contact@cudis.com",
    "- Facebook : facebook.com/CadreUnitaireIslam",
    "- X (Twitter) : @Islam_Senegal",
  ].join("\n");
}

export const Route = createFileRoute("/api/assistant")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (readEnv("ENABLE_AI_ASSISTANT") !== "true") {
          return json({ error: "Assistant désactivé." }, { status: 503 });
        }

        const provider = resolveAssistantProvider(readEnv);
        if (!provider) {
          return json({ error: "Configuration de l'assistant incomplète." }, { status: 500 });
        }

        const ip = getClientIp(request);
        const rate = checkRateLimit(`assistant:${ip}`, PER_IP_LIMIT, RATE_WINDOW_MS);
        if (!rate.allowed) {
          return json(
            { error: "Limite de messages atteinte. Merci de réessayer plus tard." },
            { status: 429 },
          );
        }

        const payload = await request.json().catch(() => null);
        const parsed = assistantSchema.safeParse(payload);
        if (!parsed.success) return json({ error: "Question invalide." }, { status: 400 });

        const ipHash = await sha256(ip);
        const supabase = tryGetSupabaseServiceClient();
        if (!supabase) {
          console.error("Configuration serveur Supabase absente (SUPABASE_SERVICE_ROLE_KEY).");
          return json({ error: "L'assistant est momentanément indisponible." }, { status: 503 });
        }

        let success = false;
        try {
          const [systemPrompt] = await Promise.all([buildSystemPrompt()]);
          const result = await callAssistantProvider(provider, systemPrompt, parsed.data.question);
          success = true;
          return json({ answer: result.answer });
        } catch (error) {
          console.error("Assistant provider failed", error);
          return json({ error: "L'assistant est momentanément indisponible." }, { status: 502 });
        } finally {
          // Journalisation volontairement minimale : métadonnées
          // d'appel uniquement (coût, fiabilité), jamais le contenu.
          try {
            await supabase.from("assistant_usage").insert({
              ip_hash: ipHash,
              provider: provider.id,
              model: provider.model,
              success,
            });
          } catch (logError) {
            console.error("assistant_usage insert failed", logError);
          }
        }
      },
    },
  },
});
