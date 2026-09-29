import { Link } from "@tanstack/react-router";

const logoAlt = "Cadre Unitaire de l'Islam au Senegal";

export function Brand({ large = false }: { large?: boolean }) {
  const mark = (
    <span className={large ? "brand-mark brand-mark-large" : "brand-mark"} aria-label={logoAlt}>
      <img src="/cudis-logo.png" alt={logoAlt} loading={large ? "eager" : "lazy"} />
    </span>
  );

  return large ? (
    mark
  ) : (
    <Link to="/" aria-label="Accueil du CUDIS">
      {mark}
    </Link>
  );
}
