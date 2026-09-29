import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Handshake, Users } from "lucide-react";
import { Brand } from "@/components/site/brand";
import { FacebookEmbed } from "@/components/site/facebook-embed";
import { SectionHeading, TextLink } from "@/components/site/page";
import { ProgramCard } from "@/components/site/cards";
import { aboutText } from "@/data/site";
import { getPublicPrograms } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { useAsyncValue } from "@/lib/use-async-value";

export default function HomePage() {
  const programs = useAsyncValue("programmes", getPublicPrograms, []);
  const featured = programs.find((program) => program.statut === "en_cours") ?? programs[0];
  return (
    <>
      <section className="home-hero islamic-pattern">
        <div className="page-container home-hero-grid">
          <div className="home-hero-copy">
            <p className="eyebrow light">Cadre Unitaire de l’Islam au Sénégal</p>
            <h1>
              Unis pour la paix
              <br />
              et le <em>vivre-ensemble.</em>
            </h1>
            <p>
              Préserver le modèle sénégalais de tolérance religieuse, renforcer le dialogue et
              servir le bien commun.
            </p>
            <div className="hero-actions">
              <Button asChild variant="gold" size="lg">
                <Link to="/le-cadre">
                  Découvrir le CUDIS
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="header" size="lg">
                <Link to="/programmes">Nos programmes</Link>
              </Button>
            </div>
          </div>
          <div className="hero-brand-plaque">
            <Brand large />
          </div>
        </div>
      </section>
      <section className="stats-band">
        <div className="page-container stats-grid">
          <div>
            <strong>01</strong>
            <span>Cadre commun</span>
          </div>
          <div>
            <strong>16</strong>
            <span>Membres du bureau</span>
          </div>
          <div>
            <strong>20 000+</strong>
            <span>Dahiras visés</span>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="page-container intro-grid">
          <SectionHeading
            eyebrow="Notre raison d’être"
            title="Rassembler les voix de l’islam sénégalais"
          />
          <div>
            <p className="lead-copy">{aboutText}</p>
            <TextLink to="/le-cadre">Connaître notre histoire</TextLink>
          </div>
        </div>
      </section>
      <section className="section section-alt">
        <div className="page-container">
          <SectionHeading
            eyebrow="Nos actions"
            title="Une présence concrète au service du vivre-ensemble"
            align="center"
          />
          <div className="pillars-grid">
            <Link to="/le-cadre">
              <Users />
              <h3>Dialogue</h3>
              <p>Réunir les familles religieuses et mouvements islamiques.</p>
            </Link>
            <Link to="/programmes">
              <BookOpen />
              <h3>Transmission</h3>
              <p>Faire des dahiras des espaces d’éducation spirituelle et civique.</p>
            </Link>
            <Link to="/partenariat">
              <Handshake />
              <h3>Coopération</h3>
              <p>Mobiliser les institutions autour de la cohésion sociale.</p>
            </Link>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="page-container">
          <div className="section-top">
            <SectionHeading
              eyebrow="Programme prioritaire"
              title="Former et accompagner les dahiras"
            />
            <TextLink to="/programmes">Tous les programmes</TextLink>
          </div>
          {featured && <ProgramCard program={featured} />}
        </div>
      </section>
      <section className="section facebook-section">
        <div className="page-container facebook-grid">
          <div>
            <SectionHeading
              eyebrow="Actualités"
              title="Suivre la vie du CUDIS"
              intro="Retrouvez nos prises de parole, rencontres et initiatives sur notre page Facebook officielle."
            />
            <Button asChild variant="default" size="lg">
              <a href="https://facebook.com/CadreUnitaireIslam" target="_blank" rel="noreferrer">
                Ouvrir Facebook
                <ArrowRight />
              </a>
            </Button>
          </div>
          <FacebookEmbed />
        </div>
      </section>
    </>
  );
}
