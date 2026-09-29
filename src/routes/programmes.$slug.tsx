import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { getProgramByIdentifier } from "@/lib/content";

export const Route = createFileRoute("/programmes/$slug")({
  loader: async ({ params }) => {
    const program = await getProgramByIdentifier(params.slug);
    if (!program) throw notFound();
    return program;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.titre} — CUDIS` : "Programme introuvable — CUDIS" },
      {
        name: "description",
        content: loaderData?.description ?? "Ce programme n'est pas disponible.",
      },
      {
        property: "og:title",
        content: loaderData ? `${loaderData.titre} — CUDIS` : "Programme du CUDIS",
      },
      {
        property: "og:description",
        content: loaderData?.description ?? "Les programmes du CUDIS.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      ...(!loaderData ? [{ name: "robots", content: "noindex" }] : []),
    ],
  }),
  notFoundComponent: Missing,
  component: Page,
});

function Page() {
  const program = Route.useLoaderData();
  const { slug } = Route.useParams();
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
