import { FormEvent, useRef, useState } from "react";
import { Bot, LoaderCircle, MessageCircle, Send, X } from "lucide-react";

type Message = { role: "assistant" | "user"; text: string };

export function PublicAssistant() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "As-salaam aleykoum ! Je peux vous renseigner sur le CUDIS, ses membres et ses programmes.",
    },
  ]);
  const listRef = useRef<HTMLDivElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = question.trim();
    if (!text || sending) return;
    setQuestion("");
    setMessages((current) => [...current, { role: "user", text }]);
    setSending(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      const data = (await response.json()) as { answer?: string; error?: string };
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text:
            data.answer ??
            (response.status === 503
              ? "L’assistant sera bientôt disponible. Vous pouvez nous écrire depuis la page Contact."
              : data.error ?? "Je n’ai pas pu répondre. Réessayez dans un instant."),
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        { role: "assistant", text: "Connexion interrompue. Merci de réessayer." },
      ]);
    } finally {
      setSending(false);
      requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }));
    }
  }

  return (
    <aside className="public-assistant" aria-label="Assistant du CUDIS">
      {open && (
        <section className="assistant-panel" aria-label="Conversation avec l’assistant">
          <header className="assistant-header">
            <span className="assistant-avatar"><Bot size={20} /></span>
            <div><strong>Assistant CUDIS</strong><small>Informations sur le CUDIS</small></div>
            <button type="button" className="assistant-close" onClick={() => setOpen(false)} aria-label="Fermer"><X size={19} /></button>
          </header>
          <div className="assistant-messages" ref={listRef} aria-live="polite">
            {messages.map((message, index) => (
              <p className={`assistant-message assistant-message-${message.role}`} key={`${index}-${message.role}`}>{message.text}</p>
            ))}
            {sending && <p className="assistant-message assistant-message-assistant assistant-thinking"><LoaderCircle size={15} /> Réponse en cours…</p>}
          </div>
          <form className="assistant-form" onSubmit={submit}>
            <input value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={800} placeholder="Posez votre question…" aria-label="Votre question" />
            <button type="submit" disabled={!question.trim() || sending} aria-label="Envoyer"><Send size={18} /></button>
          </form>
          <p className="assistant-note">Les réponses sont générées par IA et peuvent contenir des erreurs.</p>
        </section>
      )}
      <button type="button" className="assistant-launcher" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? "Fermer l’assistant" : "Ouvrir l’assistant du CUDIS"}>
        {open ? <X size={22} /> : <><MessageCircle size={21} /><span>Une question ?</span></>}
      </button>
    </aside>
  );
}
