import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Archive,
  ArchiveRestore,
  GripVertical,
  LogOut,
  MailOpen,
  Save,
  Trash2,
  Upload,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Settings2,
} from "lucide-react";

import { ImageCropUpload } from "@/components/admin/image-crop-upload";
import { extractAdminDocument, sanitizeAdminAiProposal, type AdminAiProposal } from "@/lib/admin-ai";
import { memberPortraitUrl } from "@/data/site";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ADMIN_ACCEPTED_MIME_TYPES,
  describeSupabaseError,
  getAdminSupabase,
  uploadAdminFile,
} from "@/lib/admin";
import type {
  ContactSubmission,
  AssistantKnowledge,
  Member,
  Partner,
  Program,
  ProgramStatus,
  Resource,
  ResourceType,
} from "@/lib/supabase";

type AdminSection = "members" | "programs" | "partners" | "resources" | "messages" | "assistant";

const STATUS_LABELS: Record<ProgramStatus, string> = {
  realise: "Réalisé",
  en_cours: "En cours",
  a_venir: "À venir",
};

const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  photo: "Photo",
  video: "Vidéo",
  audio: "Audio",
  document: "Document",
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ------------------------------------------------------------
// Panneau d'administration du CUDIS — /gestion
//
// - Connexion e-mail / mot de passe via Supabase Auth (pas
//   d'inscription publique ; comptes créés manuellement).
// - Route volontairement discrète (robots.txt, noindex) : couche
//   de confort uniquement, la sécurité vient des policies RLS.
// - Sobre et direct : conçu pour un usage non technique.
// ------------------------------------------------------------

export default function AdminPage() {
  const supabase = useMemo(() => getAdminSupabase(), []);
  const [session, setSession] = useState<{ email: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    fetch("/api/admin.php?action=session", { credentials: "same-origin" })
      .then(async (response) => response.ok ? await response.json() as { email: string } : null)
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
  }, [supabase]);

  if (!supabase) {
    return (
      <AdminShell>
        <p className="admin-alert">
          Administration inactive : configurez les variables Supabase publiques du site.
        </p>
      </AdminShell>
    );
  }
  if (loading)
    return (
      <AdminShell>
        <p>Chargement…</p>
      </AdminShell>
    );
  if (!session) {
    return (
      <AdminShell>
        <LoginForm onSignedIn={setSession} />
      </AdminShell>
    );
  }
  return <AdminDashboard supabase={supabase} session={session} />;
}

function AdminShell({ children }: { children: ReactNode }) {
  return (
    <section className="admin-page">
      <div className="admin-container">{children}</div>
    </section>
  );
}

function LoginForm({ onSignedIn }: { onSignedIn: (session: { email: string }) => void }) {
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSending(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin.php?action=login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Connexion impossible.");
      onSignedIn({ email: result.email });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Connexion impossible. Vérifiez vos identifiants.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="admin-login" onSubmit={submit}>
      <h1>Administration CUDIS</h1>
      <label>
        Email
        <Input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Mot de passe
        <Input name="password" type="password" autoComplete="current-password" required />
      </label>
      <Button type="submit" disabled={sending}>
        {sending ? "Connexion…" : "Se connecter"}
      </Button>
      {error && <p className="admin-error">{error}</p>}
    </form>
  );
}

function AdminDashboard({ supabase, session }: { supabase: SupabaseClient; session: { email: string } }) {
  const [section, setSection] = useState<AdminSection>("members");
  const [members, setMembers] = useState<Member[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [messages, setMessages] = useState<ContactSubmission[]>([]);
  const [assistantKnowledge, setAssistantKnowledge] = useState<AssistantKnowledge[]>([]);
  const [notice, setNotice] = useState("");
  const [loadError, setLoadError] = useState("");

  async function load() {
    setLoadError("");
    const [membersRes, programsRes, partnersRes, resourcesRes, messagesRes, knowledgeRes] = await Promise.all([
      supabase.from("members").select("*").order("ordre_affichage", { ascending: true }),
      supabase.from("programs").select("*").order("created_at", { ascending: false }),
      supabase.from("partners").select("*").order("nom", { ascending: true }),
      supabase.from("resources").select("*").order("date_publication", { ascending: false }),
      supabase.from("contact_submissions").select("*").order("date_envoi", { ascending: false }),
      supabase.from("assistant_knowledge").select("*").order("sort_order", { ascending: true }),
    ]);
    const firstError =
      membersRes.error ??
      programsRes.error ??
      partnersRes.error ??
      resourcesRes.error ??
      messagesRes.error;
    const loadFailure = firstError ?? knowledgeRes.error;
    if (loadFailure) {
      setLoadError(describeSupabaseError(loadFailure));
      return;
    }
    setMembers((membersRes.data ?? []) as Member[]);
    setPrograms((programsRes.data ?? []) as Program[]);
    setPartners((partnersRes.data ?? []) as Partner[]);
    setResources((resourcesRes.data ?? []) as Resource[]);
    setMessages((messagesRes.data ?? []) as ContactSubmission[]);
    setAssistantKnowledge((knowledgeRes.data ?? []) as AssistantKnowledge[]);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(
    action: () => PromiseLike<{ error: { message: string } | null }>,
    message = "Modifications enregistrées.",
  ) {
    setNotice("");
    setLoadError("");
    const { error } = await action();
    if (error) {
      setNotice("");
      setLoadError(describeSupabaseError(error));
      return false;
    }
    setNotice(message);
    await load();
    return true;
  }

  return (
    <AdminShell>
      <div className="admin-topbar">
        <div>
          <h1>Administration CUDIS</h1>
          <p>{session.email}</p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            if (import.meta.env.DEV) window.location.assign("/");
            else void fetch("/api/admin.php?action=logout", { method: "POST", credentials: "same-origin" }).then(() => window.location.reload());
          }}
        >
          <LogOut />
          {import.meta.env.DEV ? "Quitter l’admin" : "Déconnexion"}
        </Button>
      </div>
      <nav className="admin-tabs" aria-label="Sections d'administration">
        {(
          [
            ["members", "Membres"],
            ["programs", "Programmes"],
            ["partners", "Partenaires"],
            ["resources", "Ressources"],
            ["messages", "Messages"],
            ["assistant", "Chatbot IA"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={section === key ? "active" : ""}
            onClick={() => setSection(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      {loadError && <p className="admin-error">{loadError}</p>}
      {notice && <p className="admin-notice">{notice}</p>}
      {section === "members" && <MembersAdmin supabase={supabase} members={members} run={run} />}
      {section === "programs" && (
        <ProgramsAdmin supabase={supabase} programs={programs} run={run} />
      )}
      {section === "partners" && (
        <PartnersAdmin supabase={supabase} partners={partners} run={run} />
      )}
      {section === "resources" && (
        <ResourcesAdmin supabase={supabase} resources={resources} run={run} />
      )}
      {section === "messages" && (
        <MessagesAdmin supabase={supabase} messages={messages} run={run} />
      )}
      {section === "assistant" && (
        <AssistantKnowledgeAdmin
          supabase={supabase}
          items={assistantKnowledge}
          members={members}
          programs={programs}
          partners={partners}
          resources={resources}
          run={run}
        />
      )}
    </AdminShell>
  );
}

type RunAction = (
  action: () => PromiseLike<{ error: { message: string } | null }>,
  message?: string,
) => Promise<boolean>;

function List({
  title,
  toolbar,
  children,
}: {
  title: string;
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="admin-card admin-list">
      <div className="admin-list-head">
        <h2>{title}</h2>
        {toolbar}
      </div>
      {children}
    </section>
  );
}

// ---------------- Membres ----------------

function MembersAdmin({
  supabase,
  members,
  run,
}: {
  supabase: SupabaseClient;
  members: Member[];
  run: RunAction;
}) {
  const emptyForm = {
    slug: "",
    nom: "",
    fonction: "",
    photo_url: "",
    ordre_affichage: members.length + 1,
    bio: "",
    actif: true,
  };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  function edit(member: Member) {
    setEditingId(member.id);
    setForm({
      slug: member.slug,
      nom: member.nom,
      fonction: member.fonction,
      photo_url: member.photo_url ?? "",
      ordre_affichage: member.ordre_affichage,
      bio: member.bio ?? "",
      actif: member.actif,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...emptyForm, ordre_affichage: members.length + 1 });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const payload = {
      slug: form.slug || slugify(form.nom),
      nom: form.nom,
      fonction: form.fonction,
      photo_url: form.photo_url || null,
      ordre_affichage: Number(form.ordre_affichage) || members.length + 1,
      bio: form.bio || null,
      actif: form.actif,
    };
    const ok = await run(
      () =>
        editingId
          ? supabase.from("members").update(payload).eq("id", editingId)
          : supabase.from("members").insert(payload),
      editingId ? "Membre mis à jour." : "Membre ajouté.",
    );
    if (ok) resetForm();
  }

  // Réordonnancement par glisser-déposer : réécrit l'ordre complet.
  async function reorder(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) return;
    const reordered = [...members];
    const [moved] = reordered.splice(dragIndex, 1);
    if (!moved) return;
    reordered.splice(targetIndex, 0, moved);
    setDragIndex(null);
    await run(
      () =>
        supabase
          .from("members")
          .upsert(
            reordered.map((member, index) => ({ id: member.id, ordre_affichage: index + 1 })),
          ),
      "Ordre enregistré.",
    );
  }

  return (
    <div className="admin-grid">
      <form className="admin-card admin-form" onSubmit={submit}>
        <h2>{editingId ? "Modifier un membre" : "Ajouter un membre"}</h2>
        <label>
          Nom
          <Input
            value={form.nom}
            onChange={(e) => setForm({ ...form, nom: e.target.value })}
            required
          />
        </label>
        <label>
          Slug (URL)
          <Input
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder={slugify(form.nom)}
          />
        </label>
        <label>
          Fonction
          <Input
            value={form.fonction}
            onChange={(e) => setForm({ ...form, fonction: e.target.value })}
            required
          />
        </label>
        <label>
          Ordre d'affichage
          <Input
            type="number"
            min={1}
            value={form.ordre_affichage}
            onChange={(e) => setForm({ ...form, ordre_affichage: Number(e.target.value) })}
          />
        </label>
        <label>
          Bio (facultative)
          <Textarea
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            rows={5}
          />
        </label>
        <label className="admin-check">
          <input
            type="checkbox"
            checked={form.actif}
            onChange={(e) => setForm({ ...form, actif: e.target.checked })}
          />
          Visible sur le site
        </label>
        <ImageCropUpload
          bucket="member-photos"
          label="Photo"
          initialUrl={form.photo_url || null}
          onUploaded={(url) => setForm({ ...form, photo_url: url })}
        />
        <div className="admin-actions">
          <Button type="submit">
            <Save />
            {editingId ? "Enregistrer" : "Ajouter"}
          </Button>
          {editingId && (
            <Button type="button" variant="outline" onClick={resetForm}>
              Annuler
            </Button>
          )}
        </div>
      </form>
      <BulkMemberPhotos supabase={supabase} members={members} run={run} />
      <List
        title="Membres du bureau"
        toolbar={<span className="admin-hint">Glissez pour réordonner</span>}
      >
        {members.map((member, index) => (
          <article
            className="admin-row admin-row-draggable"
            key={member.id}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => void reorder(index)}
            onDragEnd={() => setDragIndex(null)}
          >
            <div>
              <span className="admin-drag-handle" aria-hidden="true">
                <GripVertical />
              </span>
              {memberPortraitUrl(member.slug, member.photo_url) && <img src={memberPortraitUrl(member.slug, member.photo_url) ?? ""} alt="" />}
              <strong>{member.nom}</strong>
              <span>
                {member.fonction}
                {member.actif ? "" : " · masqué"}
              </span>
            </div>
            <div className="admin-actions">
              <Button type="button" variant="outline" onClick={() => edit(member)}>
                Éditer
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  run(
                    () => supabase.from("members").delete().eq("id", member.id),
                    "Membre supprimé.",
                  )
                }
              >
                <Trash2 />
              </Button>
            </div>
          </article>
        ))}
      </List>
    </div>
  );
}

// ---------------- Programmes ----------------

function ProgramsAdmin({
  supabase,
  programs,
  run,
}: {
  supabase: SupabaseClient;
  programs: Program[];
  run: RunAction;
}) {
  const emptyForm = {
    titre: "",
    description: "",
    statut: "a_venir" as ProgramStatus,
    date_debut: "",
    date_fin: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ProgramStatus | "all">("all");
  const visible = programs.filter((program) => filter === "all" || program.statut === filter);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const payload = {
      ...form,
      date_debut: form.date_debut || null,
      date_fin: form.date_fin || null,
    };
    const ok = await run(
      () =>
        editingId
          ? supabase.from("programs").update(payload).eq("id", editingId)
          : supabase.from("programs").insert(payload),
      editingId ? "Programme mis à jour." : "Programme ajouté.",
    );
    if (ok) {
      setForm(emptyForm);
      setEditingId(null);
    }
  }

  return (
    <div className="admin-grid">
      <form className="admin-card admin-form" onSubmit={submit}>
        <h2>{editingId ? "Modifier un programme" : "Ajouter un programme"}</h2>
        <label>
          Titre
          <Input
            value={form.titre}
            onChange={(e) => setForm({ ...form, titre: e.target.value })}
            required
          />
        </label>
        <label>
          Statut
          <select
            value={form.statut}
            onChange={(e) => setForm({ ...form, statut: e.target.value as ProgramStatus })}
          >
            <option value="realise">Réalisé</option>
            <option value="en_cours">En cours</option>
            <option value="a_venir">À venir</option>
          </select>
        </label>
        <label>
          Description
          <Textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={6}
            required
          />
        </label>
        <label>
          Date de début
          <Input
            type="date"
            value={form.date_debut}
            onChange={(e) => setForm({ ...form, date_debut: e.target.value })}
          />
        </label>
        <label>
          Date de fin (facultative)
          <Input
            type="date"
            value={form.date_fin}
            onChange={(e) => setForm({ ...form, date_fin: e.target.value })}
          />
        </label>
        <div className="admin-actions">
          <Button type="submit">
            <Save />
            {editingId ? "Enregistrer" : "Ajouter"}
          </Button>
          {editingId && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setForm(emptyForm);
                setEditingId(null);
              }}
            >
              Annuler
            </Button>
          )}
        </div>
      </form>
      <List
        title="Programmes"
        toolbar={
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as ProgramStatus | "all")}
            aria-label="Filtrer par statut"
          >
            <option value="all">Tous</option>
            <option value="realise">Réalisés</option>
            <option value="en_cours">En cours</option>
            <option value="a_venir">À venir</option>
          </select>
        }
      >
        {visible.map((program) => (
          <article className="admin-row" key={program.id}>
            <div>
              <strong>{program.titre}</strong>
              <span>{STATUS_LABELS[program.statut]}</span>
            </div>
            <div className="admin-actions">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingId(program.id);
                  setForm({
                    titre: program.titre,
                    description: program.description,
                    statut: program.statut,
                    date_debut: program.date_debut ?? "",
                    date_fin: program.date_fin ?? "",
                  });
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                Éditer
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  run(
                    () => supabase.from("programs").delete().eq("id", program.id),
                    "Programme supprimé.",
                  )
                }
              >
                <Trash2 />
              </Button>
            </div>
          </article>
        ))}
      </List>
    </div>
  );
}

// ---------------- Partenaires ----------------

function PartnersAdmin({
  supabase,
  partners,
  run,
}: {
  supabase: SupabaseClient;
  partners: Partner[];
  run: RunAction;
}) {
  const emptyForm = { nom: "", logo_url: "", lien_externe: "" };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const payload = {
      nom: form.nom,
      logo_url: form.logo_url || null,
      lien_externe: form.lien_externe || null,
    };
    const ok = await run(
      () =>
        editingId
          ? supabase.from("partners").update(payload).eq("id", editingId)
          : supabase.from("partners").insert(payload),
      editingId ? "Partenaire mis à jour." : "Partenaire ajouté.",
    );
    if (ok) {
      setForm(emptyForm);
      setEditingId(null);
    }
  }

  return (
    <div className="admin-grid">
      <form className="admin-card admin-form" onSubmit={submit}>
        <h2>{editingId ? "Modifier un partenaire" : "Ajouter un partenaire"}</h2>
        <label>
          Nom
          <Input
            value={form.nom}
            onChange={(e) => setForm({ ...form, nom: e.target.value })}
            required
          />
        </label>
        <label>
          Lien externe (facultatif)
          <Input
            value={form.lien_externe}
            onChange={(e) => setForm({ ...form, lien_externe: e.target.value })}
            placeholder="https://…"
          />
        </label>
        <ImageCropUpload
          bucket="partner-logos"
          label="Logo"
          initialUrl={form.logo_url || null}
          onUploaded={(url) => setForm({ ...form, logo_url: url })}
        />
        <div className="admin-actions">
          <Button type="submit">
            <Save />
            {editingId ? "Enregistrer" : "Ajouter"}
          </Button>
          {editingId && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setForm(emptyForm);
                setEditingId(null);
              }}
            >
              Annuler
            </Button>
          )}
        </div>
      </form>
      <List title="Partenaires">
        {partners.map((partner) => (
          <article className="admin-row" key={partner.id}>
            <div>
              {partner.logo_url && <img src={partner.logo_url} alt="" />}
              <strong>{partner.nom}</strong>
              <span>{partner.lien_externe ?? ""}</span>
            </div>
            <div className="admin-actions">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingId(partner.id);
                  setForm({
                    nom: partner.nom,
                    logo_url: partner.logo_url ?? "",
                    lien_externe: partner.lien_externe ?? "",
                  });
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                Éditer
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  run(
                    () => supabase.from("partners").delete().eq("id", partner.id),
                    "Partenaire supprimé.",
                  )
                }
              >
                <Trash2 />
              </Button>
            </div>
          </article>
        ))}
      </List>
    </div>
  );
}

// ---------------- Ressources ----------------

function FileUpload({ bucket, onUploaded }: { bucket: string; onUploaded: (url: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const supabase = getAdminSupabase();

  async function upload(file: File) {
    if (!supabase) return;
    setBusy(true);
    setError("");
    const result = await uploadAdminFile(supabase, bucket, file);
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    onUploaded(result.url);
  }

  return (
    <div className="admin-upload-block">
      <label className={`admin-upload admin-dropzone ${dragging ? "is-dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file) void upload(file); }}>
        <UploadCloud />
        <span>{busy ? "Téléversement…" : "Déposez un fichier ici ou cliquez pour parcourir"}</span>
        <small>JPG, PNG, WEBP, PDF, DOCX ou TXT · 10 Mo maximum</small>
        <input
          type="file"
          accept={ADMIN_ACCEPTED_MIME_TYPES.join(",")}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.target.value = "";
          }}
        />
      </label>
      {error && <p className="admin-error">{error}</p>}
    </div>
  );
}

function ResourcesAdmin({
  supabase,
  resources,
  run,
}: {
  supabase: SupabaseClient;
  resources: Resource[];
  run: RunAction;
}) {
  const emptyForm = {
    type: "document" as ResourceType,
    titre: "",
    url_fichier: "",
    url_externe: "",
    date_publication: new Date().toISOString().slice(0, 10),
  };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const payload = {
      type: form.type,
      titre: form.titre,
      url_fichier: form.url_fichier || null,
      url_externe: form.url_externe || null,
      date_publication: form.date_publication,
    };
    const ok = await run(
      () =>
        editingId
          ? supabase.from("resources").update(payload).eq("id", editingId)
          : supabase.from("resources").insert(payload),
      editingId ? "Ressource mise à jour." : "Ressource ajoutée.",
    );
    if (ok) {
      setForm(emptyForm);
      setEditingId(null);
    }
  }

  return (
    <div className="admin-grid">
      <BulkResources supabase={supabase} run={run} />
      <form className="admin-card admin-form" onSubmit={submit}>
        <h2>{editingId ? "Modifier une ressource" : "Ajouter une ressource"}</h2>
        <label>
          Type
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as ResourceType })}
          >
            {Object.entries(RESOURCE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Titre
          <Input
            value={form.titre}
            onChange={(e) => setForm({ ...form, titre: e.target.value })}
            required
          />
        </label>
        <label>
          Lien externe (YouTube, audio hébergé…)
          <Input
            value={form.url_externe}
            onChange={(e) => setForm({ ...form, url_externe: e.target.value })}
            placeholder="https://youtube.com/…"
          />
        </label>
        <FileUpload
          bucket="resources"
          onUploaded={(url) => setForm({ ...form, url_fichier: url })}
        />
        {form.url_fichier && (
          <a className="admin-file-link" href={form.url_fichier} target="_blank" rel="noreferrer">
            Fichier téléversé
          </a>
        )}
        <label>
          Date de publication
          <Input
            type="date"
            value={form.date_publication}
            onChange={(e) => setForm({ ...form, date_publication: e.target.value })}
            required
          />
        </label>
        <div className="admin-actions">
          <Button type="submit">
            <Save />
            {editingId ? "Enregistrer" : "Ajouter"}
          </Button>
          {editingId && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setForm(emptyForm);
                setEditingId(null);
              }}
            >
              Annuler
            </Button>
          )}
        </div>
      </form>
      <List title="Ressources">
        {resources.map((resource) => (
          <article className="admin-row" key={resource.id}>
            <div>
              <strong>{resource.titre}</strong>
              <span>
                {RESOURCE_TYPE_LABELS[resource.type]} · {resource.date_publication}
                {resource.url_externe ? " · lien externe" : ""}
              </span>
            </div>
            <div className="admin-actions">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingId(resource.id);
                  setForm({
                    type: resource.type,
                    titre: resource.titre,
                    url_fichier: resource.url_fichier ?? "",
                    url_externe: resource.url_externe ?? "",
                    date_publication: resource.date_publication,
                  });
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                Éditer
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  run(
                    () => supabase.from("resources").delete().eq("id", resource.id),
                    "Ressource supprimée.",
                  )
                }
              >
                <Trash2 />
              </Button>
            </div>
          </article>
        ))}
      </List>
    </div>
  );
}

type UploadLine = { name: string; state: "sending" | "done" | "error"; message: string | undefined };

function DropFiles({ accept, multiple, onFiles, hint }: { accept: string; multiple?: boolean; onFiles: (files: File[]) => void; hint: string }) {
  const [dragging, setDragging] = useState(false);
  return (
    <label className={`admin-upload admin-dropzone ${dragging ? "is-dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); onFiles(Array.from(event.dataTransfer.files)); }}>
      <UploadCloud />
      <span>Déposez vos fichiers ici ou cliquez pour parcourir</span>
      <small>{hint}</small>
      <input type="file" accept={accept} multiple={multiple} onChange={(event) => { onFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
    </label>
  );
}

function UploadResults({ items }: { items: UploadLine[] }) {
  if (!items.length) return null;
  return <ul className="admin-upload-results">{items.map((item, index) => <li key={`${item.name}-${index}`} className={item.state}>
    {item.state === "done" ? <CheckCircle2 /> : item.state === "error" ? <AlertCircle /> : <span className="admin-spinner" />}
    <span><strong>{item.name}</strong>{item.message && <small>{item.message}</small>}</span>
  </li>)}</ul>;
}

async function makeSquarePortrait(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 800;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Conversion image impossible.");
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 800, 800);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.88));
  if (!blob) throw new Error("Conversion image impossible.");
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp" });
}

function BulkMemberPhotos({ supabase, members, run }: { supabase: SupabaseClient; members: Member[]; run: RunAction }) {
  const [items, setItems] = useState<UploadLine[]>([]);
  const [busy, setBusy] = useState(false);
  async function process(files: File[]) {
    const images = files.filter((file) => file.type.startsWith("image/"));
    const initialItems: UploadLine[] = files.filter((file) => !file.type.startsWith("image/")).map((file) => ({ name: file.name, state: "error", message: "Fichier image attendu." }));
    initialItems.push(...images.map((file) => ({ name: file.name, state: "sending" as const, message: undefined })));
    setItems(initialItems);
    setBusy(true);
    for (const file of images) {
      const key = slugify(file.name.replace(/\.[^.]+$/, ""));
      const member = members.find((candidate) => key === slugify(candidate.nom) || key === slugify(candidate.slug) || key.includes(slugify(candidate.nom)) || key.includes(slugify(candidate.slug)));
      const updateLine = (state: UploadLine["state"], message?: string) => setItems((current) => current.map((line) => line.name === file.name ? { ...line, state, message } : line));
      if (!member) { updateLine("error", "Aucun membre correspondant. Nommez l’image avec le nom ou le slug du membre."); continue; }
      try {
        const converted = await makeSquarePortrait(file);
        const uploaded = await uploadAdminFile(supabase, "member-photos", converted);
        if ("error" in uploaded) throw new Error(uploaded.error);
        const { error } = await supabase.from("members").update({ photo_url: uploaded.url }).eq("id", member.id);
        if (error) throw new Error(describeSupabaseError(error));
        updateLine("done", `Portrait associé à ${member.nom}.`);
      } catch (error) { updateLine("error", error instanceof Error ? error.message : "Envoi impossible."); }
    }
    setBusy(false);
    await run(() => Promise.resolve({ error: null }), "Import des portraits terminé.");
  }
  return <section className="admin-card admin-bulk-upload">
    <div><h2>Portraits en lot</h2><p>Déposez plusieurs photos : elles seront recadrées automatiquement et associées grâce au nom du fichier (ex. <code>Aminata-Diop.jpg</code>).</p></div>
    <DropFiles accept="image/jpeg,image/png,image/webp" multiple onFiles={(files) => void process(files)} hint="JPG, PNG ou WEBP · 10 Mo par image · nom du fichier = nom ou slug du membre" />
    {busy && <p className="admin-hint">Import en cours… vous pouvez suivre chaque fichier ci-dessous.</p>}
    <UploadResults items={items} />
  </section>;
}

function inferResourceType(file: File): ResourceType {
  if (file.type.startsWith("image/")) return "photo";
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "mp3" || extension === "wav" || extension === "m4a") return "audio";
  if (extension === "mp4" || extension === "webm" || extension === "mov") return "video";
  return "document";
}

function BulkResources({ supabase, run }: { supabase: SupabaseClient; run: RunAction }) {
  const [items, setItems] = useState<UploadLine[]>([]);
  const [busy, setBusy] = useState(false);
  async function process(files: File[]) {
    setItems(files.map((file) => ({ name: file.name, state: "sending", message: undefined })));
    setBusy(true);
    for (const file of files) {
      const updateLine = (state: UploadLine["state"], message?: string) => setItems((current) => current.map((line) => line.name === file.name ? { ...line, state, message } : line));
      try {
        const uploaded = await uploadAdminFile(supabase, "resources", file);
        if ("error" in uploaded) throw new Error(uploaded.error);
        const title = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
        const { error } = await supabase.from("resources").insert({ type: inferResourceType(file), titre: title, url_fichier: uploaded.url, url_externe: null, date_publication: new Date().toISOString().slice(0, 10) });
        if (error) throw new Error(describeSupabaseError(error));
        updateLine("done", "Fiche créée et publiée dans les ressources.");
      } catch (error) { updateLine("error", error instanceof Error ? error.message : "Envoi impossible."); }
    }
    setBusy(false);
    await run(() => Promise.resolve({ error: null }), "Import des ressources terminé.");
  }
  return <section className="admin-card admin-bulk-upload admin-bulk-wide">
    <div><h2>Ajouter plusieurs ressources</h2><p>Chaque fichier crée automatiquement une ressource. Le titre vient du nom de fichier et le type est détecté automatiquement.</p></div>
    <DropFiles accept={ADMIN_ACCEPTED_MIME_TYPES.join(",")} multiple onFiles={(files) => void process(files)} hint="Images, PDF ou DOCX · 10 Mo par fichier" />
    {busy && <p className="admin-hint">Import en cours…</p>}
    <UploadResults items={items} />
  </section>;
}

// ---------------- Messages (pas de suppression : archivage) ----------------

function MessagesAdmin({
  supabase,
  messages,
  run,
}: {
  supabase: SupabaseClient;
  messages: ContactSubmission[];
  run: RunAction;
}) {
  const [showArchived, setShowArchived] = useState(false);
  const visible = messages.filter((message) =>
    showArchived ? message.archived_at !== null : message.archived_at === null,
  );
  const unreadCount = messages.filter(
    (message) => !message.lu && message.archived_at === null,
  ).length;

  return (
    <List
      title={showArchived ? "Messages archivés" : "Messages reçus"}
      toolbar={
        <div className="admin-toolbar">
          {!showArchived && unreadCount > 0 && (
            <span className="admin-badge">
              {unreadCount} non lu{unreadCount > 1 ? "s" : ""}
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowArchived((value) => !value)}
          >
            {showArchived ? (
              <>
                <ArchiveRestore />
                Boîte de réception
              </>
            ) : (
              <>
                <Archive />
                Archives
              </>
            )}
          </Button>
        </div>
      }
    >
      {visible.length === 0 && (
        <p className="admin-empty">
          {showArchived ? "Aucun message archivé." : "Aucun message pour le moment."}
        </p>
      )}
      {visible.map((message) => (
        <article
          className={message.lu || showArchived ? "admin-message" : "admin-message unread"}
          key={message.id}
        >
          <div className="admin-message-head">
            <strong>{message.sujet}</strong>
            <span>{new Date(message.date_envoi).toLocaleString("fr-FR")}</span>
          </div>
          <p>{message.message}</p>
          <address>
            {message.nom} · <a href={`mailto:${message.email}`}>{message.email}</a>
          </address>
          <div className="admin-actions">
            {!message.lu && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  run(
                    () =>
                      supabase
                        .from("contact_submissions")
                        .update({ lu: true })
                        .eq("id", message.id),
                    "Message marqué comme lu.",
                  )
                }
              >
                <MailOpen />
                Marquer comme lu
              </Button>
            )}
            {message.archived_at === null ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  run(
                    () =>
                      supabase
                        .from("contact_submissions")
                        .update({ archived_at: new Date().toISOString() })
                        .eq("id", message.id),
                    "Message archivé.",
                  )
                }
              >
                <Archive />
                Archiver
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  run(
                    () =>
                      supabase
                        .from("contact_submissions")
                        .update({ archived_at: null })
                        .eq("id", message.id),
                    "Message restauré.",
                  )
                }
              >
                <ArchiveRestore />
                Restaurer
              </Button>
            )}
          </div>
        </article>
      ))}
    </List>
  );
}

function AssistantKnowledgeAdmin({
  supabase,
  items,
  members,
  programs,
  partners,
  resources,
  run,
}: {
  supabase: SupabaseClient;
  items: AssistantKnowledge[];
  members: Member[];
  programs: Program[];
  partners: Partner[];
  resources: Resource[];
  run: RunAction;
}) {
  const emptyForm = { topic: "", content: "", active: true, sort_order: items.length + 1 };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      topic: form.topic.trim(),
      content: form.content.trim(),
      active: form.active,
      sort_order: Number(form.sort_order),
    };
    const saved = await run(
      () => editingId
        ? supabase.from("assistant_knowledge").update(payload).eq("id", editingId)
        : supabase.from("assistant_knowledge").insert(payload),
      editingId ? "Information du chatbot modifiée." : "Information ajoutée au chatbot.",
    );
    if (saved) {
      setEditingId(null);
      setForm({ ...emptyForm, sort_order: items.length + 2 });
    }
  }

  return (
    <div className="admin-ai-layout">
      <AdminAiTools supabase={supabase} items={items} members={members} programs={programs} partners={partners} resources={resources} run={run} />
      <div className="admin-grid">
      <form className="admin-card admin-form" onSubmit={submit}>
        <h2>{editingId ? "Modifier une information" : "Ajouter une information au chatbot"}</h2>
        <label>
          Sujet
          <Input value={form.topic} onChange={(event) => setForm({ ...form, topic: event.target.value })} maxLength={120} required />
        </label>
        <label>
          Contenu que l’assistant peut utiliser
          <Textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} rows={7} maxLength={5000} required />
        </label>
        <label>
          Ordre d’affichage
          <Input type="number" min={0} value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: Number(event.target.value) })} />
        </label>
        <label className="admin-check">
          <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
          Utiliser cette information dans les réponses
        </label>
        <div className="admin-actions">
          <Button type="submit"><Save />{editingId ? "Enregistrer" : "Ajouter"}</Button>
          {editingId && <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Annuler</Button>}
        </div>
      </form>
      <List title={`Base de connaissance (${items.length})`}>
        {items.length === 0 ? <p className="admin-empty">Aucune information ajoutée.</p> : items.map((item) => (
          <article className="admin-row" key={item.id}>
            <div>
              <strong>{item.topic}</strong>
              <p>{item.content}</p>
              <small>{item.active ? "Utilisée par le chatbot" : "Désactivée"} · ordre {item.sort_order}</small>
            </div>
            <div className="admin-actions">
              <Button type="button" variant="outline" size="sm" onClick={() => { setEditingId(item.id); setForm({ topic: item.topic, content: item.content, active: item.active, sort_order: item.sort_order }); }}>Modifier</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => void run(() => supabase.from("assistant_knowledge").update({ active: !item.active }).eq("id", item.id), item.active ? "Information désactivée." : "Information activée.")}>{item.active ? "Désactiver" : "Activer"}</Button>
              <Button type="button" variant="destructive" size="sm" onClick={() => void run(() => supabase.from("assistant_knowledge").delete().eq("id", item.id), "Information supprimée.")}><Trash2 />Supprimer</Button>
            </div>
          </article>
        ))}
      </List>
      </div>
    </div>
  );
}

type AiProvider = "gemini" | "openai" | "anthropic";
type AiSettings = { provider: AiProvider; model: string; configured: boolean };

const AI_DEFAULT_MODELS: Record<AiProvider, string> = {
  gemini: "gemini-3.6-flash",
  openai: "gpt-4.1-mini",
  anthropic: "claude-haiku-4-5-20251001",
};

async function adminAiRequest<T>(action: "ai-settings" | "ai-assist", data?: Record<string, unknown>, method: "GET" | "POST" = "POST"): Promise<T> {
  const response = await fetch(`/api/admin.php?action=${action}`, {
    method,
    credentials: "same-origin",
    ...(method === "POST" ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(data ?? {}) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Requête IA impossible.");
  return result as T;
}

function AdminAiTools({
  supabase, items, members, programs, partners, resources, run,
}: {
  supabase: SupabaseClient;
  items: AssistantKnowledge[];
  members: Member[];
  programs: Program[];
  partners: Partner[];
  resources: Resource[];
  run: RunAction;
}) {
  const [settings, setSettings] = useState<AiSettings>({ provider: "gemini", model: AI_DEFAULT_MODELS.gemini, configured: false });
  const [apiKey, setApiKey] = useState("");
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsNotice, setSettingsNotice] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [documentBusy, setDocumentBusy] = useState(false);
  const [documentError, setDocumentError] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentDraft, setDocumentDraft] = useState<{ topic: string; content: string } | null>(null);
  const [command, setCommand] = useState("");
  const [commandBusy, setCommandBusy] = useState(false);
  const [commandError, setCommandError] = useState("");
  const [clarification, setClarification] = useState("");
  const [proposal, setProposal] = useState<AdminAiProposal | null>(null);

  useEffect(() => {
    void adminAiRequest<AiSettings>("ai-settings", undefined, "GET").then(setSettings).catch((error) => setSettingsError(error instanceof Error ? error.message : "Paramètres IA indisponibles."));
  }, []);

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSettingsBusy(true);
    setSettingsError("");
    setSettingsNotice("");
    try {
      const saved = await adminAiRequest<AiSettings>("ai-settings", { provider: settings.provider, model: settings.model, apiKey });
      setSettings(saved);
      setApiKey("");
      setSettingsNotice("Réglages IA enregistrés côté serveur.");
    } catch (error) { setSettingsError(error instanceof Error ? error.message : "Enregistrement impossible."); }
    finally { setSettingsBusy(false); }
  }

  async function testConnection() {
    setSettingsBusy(true);
    setSettingsError("");
    setSettingsNotice("");
    try {
      const result = await adminAiRequest<{ ok: boolean }>("ai-assist", { purpose: "test" });
      if (!result.ok) throw new Error("Le test IA n’a pas été confirmé.");
      setSettingsNotice("Connexion au fournisseur IA réussie.");
    } catch (error) { setSettingsError(error instanceof Error ? error.message : "Test impossible."); }
    finally { setSettingsBusy(false); }
  }

  async function prepareDocument(file: File) {
    setDocumentFile(file);
    setDocumentDraft(null);
    setDocumentError("");
    setDocumentBusy(true);
    try {
      const text = await extractAdminDocument(file);
      if (text.trim().length < 20) throw new Error("Aucun texte exploitable n’a été trouvé. Le PDF est peut-être un scan : utilisez un document texte ou OCRisez-le d’abord.");
      const draft = await adminAiRequest<{ topic: string; content: string }>("ai-assist", { purpose: "knowledge", content: text });
      if (!draft.topic || !draft.content) throw new Error("L’IA n’a pas pu proposer une fiche exploitable.");
      setDocumentDraft(draft);
    } catch (error) { setDocumentError(error instanceof Error ? error.message : "Analyse du document impossible."); }
    finally { setDocumentBusy(false); }
  }

  async function publishDocument() {
    if (!documentFile || !documentDraft) return;
    const saved = await run(async () => {
      const upload = await uploadAdminFile(supabase, "resources", documentFile);
      if ("error" in upload) return { error: { message: upload.error } };
      const resource = await supabase.from("resources").insert({ type: "document", titre: documentDraft.topic, url_fichier: upload.url, url_externe: null, date_publication: new Date().toISOString().slice(0, 10) });
      if (resource.error) return { error: resource.error };
      const knowledge = await supabase.from("assistant_knowledge").insert({ topic: documentDraft.topic, content: documentDraft.content, active: true, sort_order: items.length + 1 });
      return { error: knowledge.error };
    }, "Document ajouté aux ressources et fiche activée pour le chatbot.");
    if (saved) { setDocumentDraft(null); setDocumentFile(null); }
  }

  async function suggestAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCommandBusy(true);
    setCommandError("");
    setClarification("");
    setProposal(null);
    const context = [
      ...members.map((item) => ({ entity: "members", id: item.id, nom: item.nom, slug: item.slug, fonction: item.fonction })),
      ...programs.map((item) => ({ entity: "programs", id: item.id, titre: item.titre, statut: item.statut })),
      ...partners.map((item) => ({ entity: "partners", id: item.id, nom: item.nom })),
      ...resources.map((item) => ({ entity: "resources", id: item.id, titre: item.titre, type: item.type })),
      ...items.map((item) => ({ entity: "assistant_knowledge", id: item.id, topic: item.topic })),
    ];
    try {
      const result = await adminAiRequest<{ proposal?: unknown; needs_clarification?: string }>("ai-assist", { purpose: "action", command, context });
      if (result.needs_clarification) setClarification(result.needs_clarification);
      else if (result.proposal) {
        const ids = {
          members: members.map((item) => item.id),
          programs: programs.map((item) => item.id),
          partners: partners.map((item) => item.id),
          resources: resources.map((item) => item.id),
          assistant_knowledge: items.map((item) => item.id),
        };
        setProposal(sanitizeAdminAiProposal(result.proposal, ids));
      } else throw new Error("Aucune proposition reçue.");
    } catch (error) { setCommandError(error instanceof Error ? error.message : "Proposition impossible."); }
    finally { setCommandBusy(false); }
  }

  async function applyProposal() {
    if (!proposal) return;
    const record = { ...proposal.record };
    const isCreate = proposal.action === "create";
    const textField = (field: string) => typeof record[field] === "string" ? String(record[field]).trim() : "";
    const hasValidLink = (value: string) => {
      try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:"; }
      catch { return false; }
    };
    try {
      if (proposal.entity === "members") {
        if (isCreate && (!textField("nom") || !textField("fonction"))) throw new Error("Pour créer un membre, il faut son nom et sa fonction.");
        if (isCreate && !textField("slug")) record["slug"] = slugify(textField("nom"));
        if (isCreate && !textField("slug")) throw new Error("Le nom ne permet pas de générer un slug.");
        if (isCreate && record["ordre_affichage"] === undefined) record["ordre_affichage"] = members.length + 1;
      } else if (proposal.entity === "programs") {
        if (isCreate && (!textField("titre") || !textField("description"))) throw new Error("Pour créer un programme, il faut son titre et sa description.");
        if (record["statut"] !== undefined && !["realise", "en_cours", "a_venir"].includes(String(record["statut"]))) throw new Error("Le statut du programme est invalide.");
        if (isCreate && record["statut"] === undefined) record["statut"] = "a_venir";
      } else if (proposal.entity === "partners") {
        if (isCreate && !textField("nom")) throw new Error("Pour créer un partenaire, il faut son nom.");
        if (record["lien_externe"] && !hasValidLink(String(record["lien_externe"]))) throw new Error("Le lien du partenaire doit commencer par http:// ou https://.");
      } else if (proposal.entity === "resources") {
        if (isCreate && (!textField("titre") || !["photo", "video", "audio", "document"].includes(String(record["type"])))) throw new Error("La ressource doit avoir un titre et un type valide.");
        if (isCreate && !record["url_fichier"] && !record["url_externe"]) throw new Error("Ajoutez un lien de fichier ou un lien externe à la ressource.");
        if (record["url_externe"] && !hasValidLink(String(record["url_externe"]))) throw new Error("Le lien de la ressource doit commencer par http:// ou https://.");
        if (isCreate && record["date_publication"] === undefined) record["date_publication"] = new Date().toISOString().slice(0, 10);
      } else if (proposal.entity === "assistant_knowledge") {
        if (isCreate && (!textField("topic") || !textField("content"))) throw new Error("Il faut un sujet et un contenu pour la fiche chatbot.");
        if (isCreate && record["active"] === undefined) record["active"] = true;
        if (isCreate && record["sort_order"] === undefined) record["sort_order"] = items.length + 1;
      }
    } catch (error) {
      setCommandError(error instanceof Error ? error.message : "La proposition doit être complétée.");
      return;
    }
    const client = supabase as any;
    const query = proposal.action === "create"
      ? client.from(proposal.entity).insert(record)
      : proposal.action === "update"
        ? client.from(proposal.entity).update(record).eq("id", proposal.target_id)
        : client.from(proposal.entity).delete().eq("id", proposal.target_id);
    const success = await run(() => query, proposal.action === "delete" ? "Élément supprimé." : proposal.action === "update" ? "Modification appliquée." : "Élément ajouté.");
    if (success) { setProposal(null); setCommand(""); }
  }

  return <section className="admin-ai-tools">
    <div className="admin-card admin-ai-intro"><Sparkles /><div><h2>Assistant IA d’administration</h2><p>Configurez votre fournisseur, transformez des documents en fiches et préparez des actions sur le site. Chaque modification reste à valider avant application.</p></div></div>

    <form className="admin-card admin-ai-card" onSubmit={saveSettings}>
      <div className="admin-ai-card-heading"><Settings2 /><div><h3>Configuration IA</h3><p>La clé est conservée hors du dossier public et n’est jamais renvoyée à l’interface.</p></div></div>
      <div className="admin-ai-settings-grid">
        <label>Fournisseur<select value={settings.provider} onChange={(event) => { const provider = event.target.value as AiProvider; setSettings({ ...settings, provider, model: AI_DEFAULT_MODELS[provider] }); }}><option value="gemini">Google Gemini</option><option value="openai">OpenAI</option><option value="anthropic">Anthropic Claude</option></select></label>
        <label>Modèle<Input value={settings.model} onChange={(event) => setSettings({ ...settings, model: event.target.value })} required /></label>
        <label className="admin-ai-key">Clé API {settings.configured && <small>Une clé est enregistrée. Laissez vide pour la conserver.</small>}<Input value={apiKey} onChange={(event) => setApiKey(event.target.value)} type="password" autoComplete="new-password" placeholder={settings.configured ? "Clé enregistrée" : "Collez la clé API ici"} /></label>
      </div>
      <div className="admin-actions"><Button type="submit" disabled={settingsBusy}><Save />{settingsBusy ? "Enregistrement…" : "Enregistrer"}</Button><Button type="button" variant="outline" disabled={settingsBusy || !settings.configured} onClick={() => void testConnection()}>Tester la connexion</Button><span className={settings.configured ? "admin-ai-status ready" : "admin-ai-status"}>{settings.configured ? "Clé configurée" : "Clé à configurer"}</span></div>
      {settingsNotice && <p className="admin-notice">{settingsNotice}</p>}{settingsError && <p className="admin-error">{settingsError}</p>}
    </form>

    <div className="admin-grid admin-ai-workflows">
      <section className="admin-card admin-ai-card"><div className="admin-ai-card-heading"><UploadCloud /><div><h3>Analyser un document</h3><p>PDF, DOCX ou TXT. L’IA extrait une fiche à valider, et le document sera ajouté aux ressources lors de la publication.</p></div></div>
        <DropFiles accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onFiles={(files) => { if (files[0]) void prepareDocument(files[0]); }} hint="10 Mo maximum · le texte d’un PDF scanné nécessite une reconnaissance OCR" />
        {documentFile && <p className="admin-hint">Document sélectionné : {documentFile.name}</p>}{documentBusy && <p className="admin-hint">Extraction et préparation de la fiche…</p>}{documentError && <p className="admin-error">{documentError}</p>}
        {documentDraft && <div className="admin-ai-preview"><h4>Aperçu de la fiche proposée</h4><label>Sujet<Input value={documentDraft.topic} onChange={(event) => setDocumentDraft({ ...documentDraft, topic: event.target.value })} maxLength={120} /></label><label>Contenu<Textarea value={documentDraft.content} onChange={(event) => setDocumentDraft({ ...documentDraft, content: event.target.value })} rows={6} maxLength={5000} /></label><Button type="button" onClick={() => void publishDocument()}><Save />Publier le document et activer la fiche</Button></div>}
      </section>

      <form className="admin-card admin-ai-card" onSubmit={suggestAction}><div className="admin-ai-card-heading"><Sparkles /><div><h3>Demander une action sur le site</h3><p>Exemples : « ajoute le programme X avec cette description », « supprime le partenaire Y ». L’IA propose, vous confirmez.</p></div></div>
        <label>Votre demande<Textarea value={command} onChange={(event) => setCommand(event.target.value)} rows={4} maxLength={1500} required placeholder="Décrivez ce que vous voulez ajouter, modifier ou supprimer…" /></label>
        <Button type="submit" disabled={commandBusy || !settings.configured}><Sparkles />{commandBusy ? "Préparation…" : "Préparer une action"}</Button>
        {!settings.configured && <p className="admin-hint">Enregistrez une clé API pour utiliser l’assistant.</p>}{commandError && <p className="admin-error">{commandError}</p>}{clarification && <p className="admin-notice">Précision nécessaire : {clarification}</p>}
        {proposal && <div className="admin-ai-preview"><h4>Confirmation requise</h4><p>{proposal.summary}</p><p><strong>{proposal.action}</strong> · {proposal.entity}{proposal.target_id ? ` · cible ${proposal.target_id}` : ""}</p>{proposal.action !== "delete" && <pre>{JSON.stringify(proposal.record, null, 2)}</pre>}<div className="admin-actions"><Button type="button" variant={proposal.action === "delete" ? "destructive" : "default"} onClick={() => void applyProposal()}>{proposal.action === "delete" ? "Confirmer la suppression" : "Confirmer et appliquer"}</Button><Button type="button" variant="outline" onClick={() => setProposal(null)}>Annuler</Button></div></div>}
      </form>
    </div>
  </section>;
}
