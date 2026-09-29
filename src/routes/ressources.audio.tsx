import { createFileRoute } from "@tanstack/react-router";
import { EmptyState, PageHero } from "@/components/site/page";
import { getPublicResourcesByType } from "@/lib/content";

export const Route = createFileRoute("/ressources/audio")({
  loader: () => getPublicResourcesByType("audio"),
  head: () => ({
    meta: [
      { title: "Audio — Ressources CUDIS" },
      { name: "description", content: "Enregistrements et prises de parole du CUDIS." },
      { property: "og:title", content: "Audio — CUDIS" },
      { property: "og:description", content: "Enregistrements et prises de parole du CUDIS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/ressources/audio" }],
  }),
  component: Page,
});

function Page() {
  const audios = Route.useLoaderData();
  return (
    <>
      <PageHero
        eyebrow="Ressources"
        title="Audio"
        intro="Enregistrements et prises de parole du CUDIS."
      />
      <section className="section">
        <div className="page-container narrow">
          {audios.length === 0 ? (
            <EmptyState
              kind="Audios"
              message="Les contenus officiels seront publiés dans cet espace."
            />
          ) : (
            <div className="audio-list">
              {audios.map((audio) => (
                <article key={audio.id} className="audio-card">
                  <h2>{audio.titre}</h2>
                  {audio.url_fichier ? (
                    <audio controls preload="none" src={audio.url_fichier}>
                      Votre navigateur ne prend pas en charge l'audio.
                    </audio>
                  ) : (
                    <a href={audio.url_externe ?? "#"} target="_blank" rel="noreferrer">
                      Écouter
                    </a>
                  )}
                  {audio.date_publication && <p>{audio.date_publication}</p>}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
