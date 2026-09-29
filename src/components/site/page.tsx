import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function PageHero({
  eyebrow,
  title,
  intro,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
}) {
  return (
    <section className="page-hero islamic-pattern">
      <div className="page-container page-hero-inner">
        <p className="eyebrow light">{eyebrow}</p>
        <h1>{title}</h1>
        {intro && <p className="page-hero-copy">{intro}</p>}
      </div>
    </section>
  );
}
export function SectionHeading({
  eyebrow,
  title,
  intro,
  align = "left",
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={`section-heading ${align === "center" ? "section-heading-center" : ""}`}>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {intro && <p>{intro}</p>}
    </div>
  );
}
export function TextLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="text-link">
      {children}
      <ChevronRight />
    </Link>
  );
}
export function EmptyState({ kind, message }: { kind: string; message: string }) {
  return (
    <div className="empty-state">
      <span>{kind}</span>
      <h2>Contenus à venir</h2>
      <p>{message}</p>
    </div>
  );
}
