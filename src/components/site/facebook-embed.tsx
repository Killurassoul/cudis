import { useState } from "react";
import { Facebook } from "lucide-react";

export function FacebookEmbed({ compact = false }: { compact?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const href = encodeURIComponent("https://www.facebook.com/CadreUnitaireIslam");
  const src = compact
    ? `https://www.facebook.com/plugins/like.php?href=${href}&width=260&layout=button_count&action=like&size=small&share=true&height=28&appId`
    : `https://www.facebook.com/plugins/page.php?href=${href}&tabs=timeline&width=500&height=500&small_header=true&adapt_container_width=true&hide_cover=false&show_facepile=true&appId`;
  return (
    <div className={compact ? "facebook-compact" : "facebook-frame"}>
      {!loaded && (
        <div className="facebook-fallback">
          <Facebook />
          <span>Les actualités Facebook peuvent être masquées par votre navigateur.</span>
        </div>
      )}
      <iframe
        title={compact ? "Aimer la page Facebook du CUDIS" : "Actualités Facebook du CUDIS"}
        src={src}
        width={compact ? "260" : "500"}
        height={compact ? "28" : "500"}
        loading="lazy"
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
        onLoad={() => setLoaded(true)}
        className={loaded ? "facebook-iframe is-loaded" : "facebook-iframe"}
      />
    </div>
  );
}
