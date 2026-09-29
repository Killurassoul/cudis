import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { EmptyState, PageHero } from "@/components/site/page";
import { getPublicResourcesByType } from "@/lib/content";

export const Route = createFileRoute("/ressources/video")({
  loader: () => getPublicResourcesByType("video"),
  head: () => ({
    meta: [
      { title: "Vidéo — Ressources CUDIS" },
      { name: "description", content: "Interventions, conférences et reportages du CUDIS." },
      { property: "og:title", content: "Vidéo — CUDIS" },
      { property: "og:description", content: "Interventions, conférences et reportages du CUDIS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/ressources/video" }],
  }),
  component: Page,
});

// Extrait l'identifiant d'une URL YouTube pour l'intégration iframe.
function youtubeEmbedUrl(url: string): string | null {
  const match =
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/.exec(url);
  return match?.[1] ? `https://www.youtube-nocookie.com/embed/${match[1]}` : null;
}

function Page() {
  const videos = Route.useLoaderData();
  return (
    <>
      <PageHero
        eyebrow="Ressources"
        title="Vidéo"
        intro="Interventions, conférences et reportages du CUDIS."
      />
      <section className="section">
        <div className="page-container">
          {videos.length === 0 ? (
            <EmptyState
              kind="Vidéos"
              message="Les contenus officiels seront publiés dans cet espace."
            />
          ) : (
            <div className="video-list">
              {videos.map((video) => {
                const link = video.url_externe ?? video.url_fichier ?? "";
                const embed = youtubeEmbedUrl(link);
                return (
                  <article key={video.id} className="video-card">
                    {embed ? (
                      <iframe
                        src={embed}
                        title={video.titre}
                        loading="lazy"
                        allowFullScreen
                        referrerPolicy="strict-origin-when-cross-origin"
                      />
                    ) : (
                      <a href={link} target="_blank" rel="noreferrer" className="admin-file-link">
                        Regarder <ExternalLink />
                      </a>
                    )}
                    <h2>{video.titre}</h2>
                    {video.date_publication && <p>{video.date_publication}</p>}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
