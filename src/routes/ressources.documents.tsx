import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { EmptyState, PageHero } from "@/components/site/page";
import { getPublicResourcesByType } from "@/lib/content";

export const Route = createFileRoute("/ressources/documents")({
  loader: () => getPublicResourcesByType("document"),
  head: () => ({
    meta: [
      { title: "Documents — Ressources CUDIS" },
      { name: "description", content: "Communiqués et publications institutionnelles du CUDIS." },
      { property: "og:title", content: "Documents — CUDIS" },
      {
        property: "og:description",
        content: "Communiqués et publications institutionnelles du CUDIS.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/ressources/documents" }],
  }),
  component: Page,
});

function Page() {
  const documents = Route.useLoaderData();
  return (
    <>
      <PageHero
        eyebrow="Ressources"
        title="Documents"
        intro="Communiqués et publications institutionnelles du CUDIS."
      />
      <section className="section">
        <div className="page-container narrow">
          {documents.length === 0 ? (
            <EmptyState
              kind="Documents"
              message="Les contenus officiels seront publiés dans cet espace."
            />
          ) : (
            <div className="document-list">
              {documents.map((doc) => (
                <a
                  key={doc.id}
                  className="document-card"
                  href={doc.url_fichier ?? doc.url_externe ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                >
                  <FileText />
                  <div>
                    <h2>{doc.titre}</h2>
                    <p>{doc.date_publication}</p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
