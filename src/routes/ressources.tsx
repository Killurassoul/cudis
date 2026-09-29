import { Link } from "react-router-dom";
import { FileText, Headphones, Images, Video } from "lucide-react";
import { PageHero } from "@/components/site/page";
const items = [
  { to: "/ressources/galerie", label: "Galerie", icon: Images },
  { to: "/ressources/video", label: "Vidéo", icon: Video },
  { to: "/ressources/audio", label: "Audio", icon: Headphones },
  { to: "/ressources/documents", label: "Documents", icon: FileText },
] as const;
export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Médiathèque"
        title="Ressources"
        intro="Retrouvez ici les images, prises de parole et publications du CUDIS."
      />
      <section className="section">
        <div className="page-container resource-grid">
          {items.map(({ to, label, icon: Icon }) => (
            <Link to={to} key={to}>
              <Icon />
              <span>Explorer</span>
              <h2>{label}</h2>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
