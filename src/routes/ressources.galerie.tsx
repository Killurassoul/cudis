import { createFileRoute } from "@tanstack/react-router";
import { EmptyState, PageHero } from "@/components/site/page";
import { getPublicResourcesByType } from "@/lib/content";

export const Route = createFileRoute("/ressources/galerie")({
  loader: () => getPublicResourcesByType("photo"),
  head: () => ({
    meta: [
      { title: "Galerie — Ressources CUDIS" },
      { name: "description", content: "Photographies des activités et rencontres du CUDIS." },
      { property: "og:title", content: "Galerie — CUDIS" },
      {
        property: "og:description",
        content: "Photographies des activités et rencontres du CUDIS.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/ressources/galerie" }],
  }),
  component: Page,
});

function Page() {
  const photos = Route.useLoaderData();
  return (
    <>
      <PageHero
        eyebrow="Ressources"
        title="Galerie"
        intro="Photographies des activités et rencontres du CUDIS."
      />
      <section className="section">
        <div className="page-container">
          {photos.length === 0 ? (
            <EmptyState
              kind="Images"
              message="Les contenus officiels seront publiés dans cet espace."
            />
          ) : (
            <div className="gallery-grid">
              {photos.map((photo) => (
                <a
                  key={photo.id}
                  href={photo.url_fichier ?? photo.url_externe ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="gallery-item"
                >
                  <img
                    src={photo.url_fichier ?? photo.url_externe ?? ""}
                    alt={photo.titre}
                    loading="lazy"
                  />
                  <span>{photo.titre}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
