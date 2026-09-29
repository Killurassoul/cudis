import { EmptyState, PageHero } from "@/components/site/page";
import { getPublicResourcesByType } from "@/lib/content";
import { useAsyncValue } from "@/lib/use-async-value";

const loadAudio = () => getPublicResourcesByType("audio");

export default function Page() {
  const audios = useAsyncValue("audio", loadAudio, []);
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
