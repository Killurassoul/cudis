import { createFileRoute } from "@tanstack/react-router";
import { Eye, Scale, ShieldCheck } from "lucide-react";
import { FacebookEmbed } from "@/components/site/facebook-embed";
import { PageHero, SectionHeading } from "@/components/site/page";
import { aboutText, missionText } from "@/data/site";
export const Route = createFileRoute("/le-cadre")({
  head: () => ({
    meta: [
      { title: "Le Cadre — CUDIS" },
      {
        name: "description",
        content:
          "Découvrez l’histoire, la mission et les principes du Cadre Unitaire de l’Islam au Sénégal.",
      },
      { property: "og:title", content: "Le Cadre — CUDIS" },
      {
        property: "og:description",
        content:
          "Une volonté commune de préserver la cohésion sociale, la paix et la tolérance religieuse au Sénégal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/le-cadre" }],
  }),
  component: Page,
});
function Page() {
  return (
    <>
      <PageHero
        eyebrow="L’institution"
        title="Le Cadre"
        intro="Une volonté commune de préserver la cohésion sociale et le modèle sénégalais de paix et de tolérance."
      />
      <section className="section">
        <div className="page-container story-grid">
          <div>
            <SectionHeading eyebrow="Qui sommes-nous" title="Une unité au-delà des appartenances" />
          </div>
          <p className="lead-copy">{aboutText}</p>
        </div>
      </section>
      <section className="section section-dark islamic-pattern">
        <div className="page-container mission-grid">
          <SectionHeading
            eyebrow="Ce que nous faisons"
            title="Préserver un héritage de tolérance"
          />
          <blockquote>{missionText}</blockquote>
        </div>
      </section>
      <section className="section section-alt">
        <div className="page-container">
          <SectionHeading
            eyebrow="Principes d’action"
            title="Ce qui nous rassemble"
            align="center"
          />
          <div className="values-grid">
            <article>
              <ShieldCheck />
              <h3>Paix</h3>
              <p>Préserver le modèle sénégalais de coexistence et de stabilité.</p>
            </article>
            <article>
              <Eye />
              <h3>Clarté</h3>
              <p>Apporter une réponse doctrinale face à l’obscurantisme.</p>
            </article>
            <article>
              <Scale />
              <h3>Cohésion</h3>
              <p>Consolider le contrat social sénégalais par le dialogue.</p>
            </article>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="page-container facebook-grid">
          <SectionHeading
            eyebrow="Au quotidien"
            title="Nos dernières actualités"
            intro="Suivez les activités et communications publiques du CUDIS."
          />
          <FacebookEmbed />
        </div>
      </section>
    </>
  );
}
