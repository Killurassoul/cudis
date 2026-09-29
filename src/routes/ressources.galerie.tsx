import { EmptyState, PageHero } from "@/components/site/page";
import { getPublicResourcesByType } from "@/lib/content";
import { useAsyncValue } from "@/lib/use-async-value";

const loadPhotos = () => getPublicResourcesByType("photo");

export default function Page() {
  const photos = useAsyncValue("photos", loadPhotos, []);
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
