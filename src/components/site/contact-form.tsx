import { useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getSupabaseBrowserClient, hasSupabasePublicEnv } from "@/lib/supabase";

const schema = z.object({
  name: z.string().trim().min(2, "Veuillez renseigner votre nom.").max(100),
  email: z.string().trim().email("Saisissez une adresse e-mail valide.").max(255),
  subject: z.string().trim().min(3, "Veuillez préciser le sujet.").max(150),
  message: z
    .string()
    .trim()
    .min(10, "Votre message doit contenir au moins 10 caractères.")
    .max(2000),
  website: z.string().max(0).optional(),
});
type Fields = z.infer<typeof schema>;

export function ContactForm() {
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [state, setState] = useState<"idle" | "sending" | "success" | "error">("idle");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form)) as Fields;
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const next: Partial<Record<keyof Fields, string>> = {};
      parsed.error.issues.forEach((issue) => {
        const key = issue.path[0] as keyof Fields;
        if (!next[key]) next[key] = issue.message;
      });
      setErrors(next);
      return;
    }
    setErrors({});
    setState("sending");
    try {
      if (!hasSupabasePublicEnv()) throw new Error("Supabase is not configured");
      const { error } = await getSupabaseBrowserClient().functions.invoke("contact", {
        body: parsed.data,
      });
      if (error) throw error;
      setState("success");
      form.reset();
    } catch {
      setState("error");
    }
  }
  return (
    <form className="contact-form" onSubmit={submit} noValidate>
      <div className="form-grid">
        <Field label="Nom complet" name="name" error={errors.name} />
        <Field label="Adresse e-mail" name="email" type="email" error={errors.email} />
      </div>
      <label className="honeypot-field" htmlFor="website">
        Site web
        <Input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <Field label="Sujet" name="subject" error={errors.subject} />
      <label className="field-label" htmlFor="message">
        Message
        <Textarea
          id="message"
          name="message"
          rows={7}
          maxLength={2000}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? "message-error" : undefined}
        />
        {errors.message && (
          <span id="message-error" className="field-error">
            {errors.message}
          </span>
        )}
      </label>
      <div className="form-submit">
        <Button variant="gold" size="lg" type="submit" disabled={state === "sending"}>
          {state === "sending" ? (
            "Envoi en cours…"
          ) : (
            <>
              <Send />
              Envoyer le message
            </>
          )}
        </Button>
        {state === "success" && (
          <p className="form-success" role="status">
            Votre message a bien été envoyé.
          </p>
        )}
        {state === "error" && (
          <p className="form-error" role="alert">
            Le service d’envoi n’est pas encore disponible. Réessayez ultérieurement ou écrivez à
            contact@cudis.com.
          </p>
        )}
      </div>
    </form>
  );
}
function Field({
  label,
  name,
  type = "text",
  error,
}: {
  label: string;
  name: keyof Fields;
  type?: string;
  error?: string | undefined;
}) {
  const errorId = `${name}-error`;
  return (
    <label className="field-label" htmlFor={name}>
      {label}
      <Input
        id={name}
        name={name}
        type={type}
        maxLength={name === "subject" ? 150 : name === "email" ? 255 : 100}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      {error && (
        <span id={errorId} className="field-error">
          {error}
        </span>
      )}
    </label>
  );
}
