import { clientIp, corsHeaders, createServiceClient, hashIp, json } from "../_shared/cors.ts";

const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  const raw = await request.json().catch(() => null);
  if (!raw || typeof raw !== "object") return json({ error: "Formulaire invalide." }, 400);
  if (clean(raw.website, 200)) return json({ ok: true });

  const nom = clean(raw.name, 100);
  const email = clean(raw.email, 255).toLowerCase();
  const sujet = clean(raw.subject, 150);
  const message = clean(raw.message, 2000);
  if (nom.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || sujet.length < 3 || message.length < 10) {
    return json({ error: "Vérifiez les champs du formulaire." }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const secretKey = Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !secretKey) return json({ error: "Service de contact momentanément indisponible." }, 503);
  const supabase = createServiceClient(url, secretKey);
  const { data: id, error } = await supabase.rpc("submit_contact_message", {
    p_nom: nom,
    p_email: email,
    p_sujet: sujet,
    p_message: message,
    p_ip_hash: await hashIp(clientIp(request)),
    p_user_agent: request.headers.get("user-agent") ?? "",
  });
  if (error) {
    console.error("Contact insert failed", error.message);
    return json({ error: "Votre message n’a pas pu être enregistré." }, 503);
  }
  if (!id) return json({ error: "Limite de 5 messages par heure atteinte." }, 429);

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (resendKey) {
    try {
      const mail = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: Deno.env.get("CONTACT_EMAIL_FROM") ?? "CUDIS <notifications@cudis.com>",
          to: (Deno.env.get("CONTACT_EMAIL_TO") ?? "contact@cudis.com").split(",").map((item) => item.trim()),
          reply_to: email,
          subject: `Nouveau message CUDIS : ${sujet}`,
          text: `Nom : ${nom}\nE-mail : ${email}\nSujet : ${sujet}\n\n${message}`,
        }),
      });
      if (!mail.ok) console.error("Contact notification failed", mail.status);
    } catch {
      console.error("Contact notification could not be sent");
    }
  }
  return json({ ok: true });
});
