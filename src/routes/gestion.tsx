import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import {
  Archive,
  ArchiveRestore,
  GripVertical,
  LogOut,
  MailOpen,
  Save,
  Trash2,
  Upload,
} from "lucide-react";

import { ImageCropUpload } from "@/components/admin/image-crop-upload";
import { memberPortraitUrl } from "@/data/site";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ADMIN_ACCEPTED_MIME_TYPES,
  describeSupabaseError,
  getAdminSupabase,
  isAdminEmailAllowed,
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
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) =>
      setSession(nextSession),
    );
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  if (!supabase) {
    return (
      <AdminShell>
        <p className="admin-alert">
          Administration inactive : configurez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.
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
  if (!session || !isAdminEmailAllowed(session)) {
    return (
      <AdminShell>
        <LoginForm supabase={supabase} />
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

function LoginForm({ supabase }: { supabase: SupabaseClient }) {
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSending(true);
    const form = new FormData(event.currentTarget);
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    });
    if (authError) {
      setError("Connexion impossible. Vérifiez l'e-mail et le mot de passe.");
    } else if (!isAdminEmailAllowed(data.session)) {
      await supabase.auth.signOut();
      setError("Ce compte n'est pas autorisé à administrer le site.");
    }
    setSending(false);
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

function AdminDashboard({ supabase, session }: { supabase: SupabaseClient; session: Session }) {
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
          <p>{session.user.email}</p>
        </div>
        <Button variant="outline" onClick={() => void supabase.auth.signOut()}>
          <LogOut />
          Déconnexion
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
        <AssistantKnowledgeAdmin supabase={supabase} items={assistantKnowledge} run={run} />
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
      <label className="admin-upload">
        <Upload />
        {busy ? "Téléversement…" : "Téléverser un fichier"}
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
  run,
}: {
  supabase: SupabaseClient;
  items: AssistantKnowledge[];
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
  );
}
