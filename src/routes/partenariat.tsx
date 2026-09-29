import { createFileRoute } from "@tanstack/react-router";
import { PageHero, SectionHeading } from "@/components/site/page";
import { getPublicPartners } from "@/lib/content";

export const Route = createFileRoute("/partenariat")({
  loader: () => getPublicPartners(),
  head: () => ({
    meta: [
      { title: "Partenariat — CUDIS" },
      {
        name: "description",
        content: "Les organisations partenaires du Cadre Unitaire de l'Islam au Sénégal.",
      },
      { property: "og:title", content: "Nos partenaires — CUDIS" },
      {
        property: "og:description",
        content: "Les institutions qui accompagnent l'action du CUDIS.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/partenariat" }],
  }),
  component: Page,
});

function Page() {
  const partners = Route.useLoaderData();
  return (
    <>
      <PageHero
        eyebrow="Coopération"
        title="Nos partenaires"
        intro="Des collaborations institutionnelles au service de la paix et de la cohésion sociale."
      />
      <section className="section">
        <div className="page-container">
          <SectionHeading
            eyebrow="Un engagement partagé"
            title="Construire ensemble"
            align="center"
          />
          {partners.length === 0 ? (
            <div className="empty-state">
              <span>Partenariats</span>
              <h2>Contenus à venir</h2>
              <p>Les partenaires officiels seront présentés dans cet espace.</p>
            </div>
          ) : (
            <div className="partner-grid">
              {partners.map((partner) => {
                const content = (
                  <>
                    {partner.logo_url ? (
                      <img
                        src={partner.logo_url}
                        alt={`Logo de ${partner.nom}`}
                        className="partner-logo"
                      />
                    ) : (
                      <span aria-hidden="true">
                        {partner.nom
                          .split(" ")
                          .map((word) => word[0])
                          .join("")
                          .slice(0, 3)}
                      </span>
                    )}
                    <h2>{partner.nom}</h2>
                    <p>{partner.logo_url ? "Partenaire" : "Logo à venir"}</p>
                  </>
                );
                return partner.lien_externe ? (
                  <a
                    className="partner-slot"
                    key={partner.id}
                    href={partner.lien_externe}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {content}
                  </a>
                ) : (
                  <div className="partner-slot" key={partner.id}>
                    {content}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
