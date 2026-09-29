import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { getProgramByIdentifier } from "@/lib/content";
import type { Program } from "@/lib/supabase";

export default function Page() {
  const { slug = "" } = useParams();
  const [program, setProgram] = useState<Program | null | undefined>(undefined);
  useEffect(() => {
    let active = true;
    void getProgramByIdentifier(slug).then((value) => { if (active) setProgram(value); });
    return () => { active = false; };
  }, [slug]);

  if (program === undefined) return <p className="section page-container" role="status">Chargement du programme…</p>;
  if (!program) return <Missing />;

  const period = program.date_debut
    ? `${program.date_debut}${program.date_fin ? ` → ${program.date_fin}` : ""}`
    : null;
  return (
    <>
      <section className="program-detail-hero islamic-pattern">
        <div className="page-container narrow">
          <ProgramStatusBadge statut={program.statut} />
          <h1>{program.titre}</h1>
        </div>
      </section>
      <section className="section">
        <article className="page-container narrow program-article">
          <p>{program.description}</p>
          {period && <p className="profile-note">Période : {period}</p>}
          <Link to="/programmes" className="back-link">
            <ArrowLeft />
            Retour aux programmes
          </Link>
        </article>
      </section>
    </>
  );
}

const STATUS_LABELS = {
  realise: "Réalisé",
  en_cours: "En cours",
  a_venir: "À venir",
} as const;

function ProgramStatusBadge({ statut }: { statut: "realise" | "en_cours" | "a_venir" }) {
  return <span className="program-status">{STATUS_LABELS[statut]}</span>;
}

function Missing() {
  return (
    <section className="section">
      <div className="page-container empty-state">
        <span>404</span>
        <h1>Programme introuvable</h1>
        <Link to="/programmes" className="text-link">
          Retour aux programmes
        </Link>
      </div>
    </section>
  );
}
