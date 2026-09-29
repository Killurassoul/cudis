import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Brand } from "./brand";

const nav = [
  ["/le-cadre", "Le Cadre"],
  ["/equipe", "Équipe"],
  ["/programmes", "Programmes"],
  ["/partenariat", "Partenariat"],
  ["/ressources", "Ressources"],
  ["/contact", "Contact"],
] as const;

export function Header() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <header className="site-header">
      <div className="page-container header-inner">
        <Brand />
        <nav className="desktop-nav" aria-label="Navigation principale">
          {nav.map(([to, label]) => (
            <Link
              key={to}
              to={to}
              className={pathname.startsWith(to) ? "nav-link nav-link-active" : "nav-link"}
            >
              {label}
            </Link>
          ))}
        </nav>
        <Button
          variant="header"
          size="icon"
          className="mobile-menu-button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={open}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </div>
      {open && (
        <nav className="mobile-nav page-container" aria-label="Navigation mobile">
          {nav.map(([to, label]) => (
            <Link
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={pathname.startsWith(to) ? "nav-link nav-link-active" : "nav-link"}
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
