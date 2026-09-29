import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";

import { initials, memberPortraitUrl } from "@/data/site";
import type { Member, Program } from "@/lib/supabase";

const STATUS_LABELS: Record<Program["statut"], string> = {
  realise: "Réalisé",
  en_cours: "En cours",
  a_venir: "À venir",
};

// Les programmes en base sont adressés par UUID ; les programmes
// statiques de repli par leur identifiant lisible.
export function programRouteId(program: Pick<Program, "id">) {
  return program.id.startsWith("static-") ? program.id.slice("static-".length) : program.id;
}

export function MemberCard({ member }: { member: Member }) {
  const photoUrl = memberPortraitUrl(member.slug, member.photo_url);
  return (
    <article className="member-card">
      <Link to={`/equipe/${member.slug}`} aria-label={`Voir le profil de ${member.nom}`}>
        <div className="portrait-placeholder">
          {photoUrl ? (
            <img src={photoUrl} alt={`Photo de ${member.nom}`} />
          ) : (
            <span>{initials(member.nom)}</span>
          )}
        </div>
        <div className="member-copy">
          <p>{member.fonction}</p>
          <h2>{member.nom}</h2>
          <ArrowUpRight aria-hidden="true" />
        </div>
      </Link>
    </article>
  );
}

export function ProgramCard({ program }: { program: Program }) {
  return (
    <article className="program-card">
      <div className="program-status">{STATUS_LABELS[program.statut]}</div>
      <h2>{program.titre}</h2>
      <p>{program.description}</p>
      <Link to={`/programmes/${programRouteId(program)}`} className="text-link">
        Découvrir le programme
        <ArrowUpRight />
      </Link>
    </article>
  );
}
