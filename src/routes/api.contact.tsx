import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { readEnv } from "@/lib/env";
import { tryGetSupabaseServiceClient } from "@/lib/supabase";
import { checkRateLimit, getClientIp, json, sha256 } from "@/lib/server-utils";

// ------------------------------------------------------------
// Formulaire de contact — route exclusivement serveur.
// 1) validation + sanitation des champs
// 2) honeypot + rate limit par IP (anti-spam basique)
// 3) insertion dans contact_submissions (service role)
// 4) notification e-mail via Resend (le message reste enregistré
//    même si l'e-mail échoue — jamais de perte silencieuse)
// ------------------------------------------------------------

const contactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  subject: z.string().trim().min(3).max(150),
  message: z.string().trim().min(10).max(2000),
  website: z.string().max(0).optional().or(z.literal("")), // honeypot : doit rester vide
});

// Supprime tout caractère de contrôle (anti-injection d'en-têtes e-mail
// et anti-payload binaire) — sert de ceinture de sécurité derrière la
// validation zod, jamais de remplacement.
function sanitizeText(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
}

const RESEND_TIMEOUT_MS = 8000;

async function sendResendEmail(payload: {
  from: string;
  to: string[];
  replyTo: string;
  subject: string;
  text: string;
}): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RESEND_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${readEnv("RESEND_API_KEY")}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: payload.from,
        to: payload.to,
        reply_to: payload.replyTo,
        subject: payload.subject,
        text: payload.text,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(`Resend failed (${response.status}): ${detail}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

function parseEmailList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export const Route = createFileRoute("/api/contact")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = getClientIp(request);
        const rate = checkRateLimit(`contact:${ip}`, 5, 60 * 60 * 1000);
        if (!rate.allowed) {
          return json(
            { error: "Trop de messages envoyés. Merci de réessayer plus tard." },
            { status: 429 },
          );
        }

        const payload = await request.json().catch(() => null);
        const parsed = contactSchema.safeParse(payload);
        if (!parsed.success) return json({ error: "Champs invalides." }, { status: 400 });

        // Honeypot rempli = bot : on répond OK sans rien enregistrer.
        if (parsed.data.website) return json({ ok: true });

        const submission = {
          nom: sanitizeText(parsed.data.name),
          email: sanitizeText(parsed.data.email.toLowerCase()),
          sujet: sanitizeText(parsed.data.subject),
          message: sanitizeText(parsed.data.message),
        };

        const supabase = tryGetSupabaseServiceClient();
        if (!supabase) {
          console.error("Configuration serveur Supabase absente (SUPABASE_SERVICE_ROLE_KEY).");
          return json(
            { error: "Le service de contact n'est pas disponible pour le moment." },
            { status: 503 },
          );
        }

        const ipHash = await sha256(ip);
        const { error } = await supabase.from("contact_submissions").insert({
          nom: submission.nom,
          email: submission.email,
          sujet: submission.sujet,
          message: submission.message,
          ip_hash: ipHash,
          user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
        });

        if (error) {
          console.error("contact_submissions insert failed", error);
          return json({ error: "Impossible d'enregistrer le message." }, { status: 500 });
        }

        const resendKey = readEnv("RESEND_API_KEY");
        if (resendKey) {
          const recipients = parseEmailList(readEnv("CONTACT_EMAIL_TO"));
          if (recipients.length > 0) {
            await sendResendEmail({
              from: readEnv("CONTACT_EMAIL_FROM") ?? "CUDIS <notifications@cudis.com>",
              to: recipients,
              replyTo: submission.email,
              subject: `[CUDIS] ${submission.sujet}`,
              text: [
                `Nom : ${submission.nom}`,
                `E-mail : ${submission.email}`,
                `Sujet : ${submission.sujet}`,
                "",
                submission.message,
              ].join("\n"),
            });
          } else {
            console.error("CONTACT_EMAIL_TO vide : notification e-mail ignorée.");
          }
        }

        return json({ ok: true });
      },
    },
  },
});
