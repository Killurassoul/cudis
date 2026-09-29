import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { initials } from "@/data/site";
import { getMemberBySlug } from "@/lib/content";

export const Route = createFileRoute("/equipe/$slug")({
  loader: async ({ params }) => {
    const member = await getMemberBySlug(params.slug);
    if (!member) throw notFound();
    return member;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.nom} — CUDIS` : "Membre introuvable — CUDIS" },
      {
        name: "description",
        content: loaderData
          ? `${loaderData.nom}, ${loaderData.fonction} au sein du CUDIS.`
          : "Ce profil n'est pas disponible.",
      },
      {
        property: "og:title",
        content: loaderData ? `${loaderData.nom} — CUDIS` : "Membre du CUDIS",
      },
      {
        property: "og:description",
        content: loaderData?.fonction ?? "Profil d'un membre du CUDIS.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
      ...(!loaderData ? [{ name: "robots", content: "noindex" }] : []),
    ],
    links: loaderData ? [{ rel: "canonical", href: `/equipe/${loaderData.slug}` }] : [],
  }),
  notFoundComponent: Missing,
  component: Page,
});

function Page() {
  const member = Route.useLoaderData();
  return (
    <section className="profile-page islamic-pattern">
      <div className="page-container profile-grid">
        <div className="profile-portrait">
          {member.photo_url ? (
            <img src={member.photo_url} alt={`Photo de ${member.nom}`} />
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
