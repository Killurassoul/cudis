import { FileText } from "lucide-react";
import { EmptyState, PageHero } from "@/components/site/page";
import { getPublicResourcesByType } from "@/lib/content";
import { useAsyncValue } from "@/lib/use-async-value";

const loadDocuments = () => getPublicResourcesByType("document");

export default function Page() {
  const documents = useAsyncValue("documents", loadDocuments, []);
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
