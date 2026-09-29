import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { initials, memberPortraitUrl } from "@/data/site";
import { getMemberBySlug } from "@/lib/content";
import type { Member } from "@/lib/supabase";

export default function Page() {
  const { slug = "" } = useParams();
  const [member, setMember] = useState<Member | null | undefined>(undefined);
  useEffect(() => {
    let active = true;
    void getMemberBySlug(slug).then((value) => { if (active) setMember(value); });
    return () => { active = false; };
  }, [slug]);

  if (member === undefined) return <p className="section page-container" role="status">Chargement du profil…</p>;
  if (!member) return <Missing />;
  const photoUrl = memberPortraitUrl(member.slug, member.photo_url);

  return (
    <section className="profile-page islamic-pattern">
      <div className="page-container profile-grid">
        <div className="profile-portrait">
          {photoUrl ? (
            <img src={photoUrl} alt={`Photo de ${member.nom}`} />
          ) : (
            <span>{initials(member.nom)}</span>
          )}
        </div>
        <div className="profile-copy">
          <p className="eyebrow light">Membre du bureau</p>
          <h1>{member.nom}</h1>
          <p className="profile-role">{member.fonction}</p>
          <div className="gold-rule" />
          {member.bio ? (
            <p className="profile-note">{member.bio}</p>
          ) : (
            <p className="profile-note">La biographie de ce membre sera publiée prochainement.</p>
          )}
          <Link to="/equipe" className="back-link">
            <ArrowLeft />
            Retour à l'équipe
          </Link>
        </div>
      </div>
    </section>
  );
}

function Missing() {
  return (
    <section className="section">
      <div className="page-container empty-state">
        <span>404</span>
        <h1>Profil introuvable</h1>
        <p>Ce membre ne figure pas dans la liste du bureau.</p>
        <Link to="/equipe" className="text-link">
          Retour à l'équipe
        </Link>
      </div>
    </section>
  );
}
