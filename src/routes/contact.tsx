import { createFileRoute } from "@tanstack/react-router";
import { Facebook, Mail, MapPin } from "lucide-react";
import { ContactForm } from "@/components/site/contact-form";
import { PageHero, SectionHeading } from "@/components/site/page";
export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — CUDIS" },
      {
        name: "description",
        content: "Contactez le CUDIS à Dakar par formulaire, e-mail ou réseaux sociaux.",
      },
      { property: "og:title", content: "Contacter le CUDIS" },
      {
        property: "og:description",
        content: "Adresse, e-mail, réseaux sociaux et formulaire de contact du CUDIS.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/contact" }],
  }),
  component: Page,
});
function Page() {
  const map = "https://www.google.com/maps?q=14.7351652,-17.4627704&z=16&output=embed";
  return (
    <>
      <PageHero
        eyebrow="Nous écrire"
        title="Contact"
        intro="Pour toute demande d’information ou proposition de collaboration, notre équipe est à votre écoute."
      />
      <section className="section">
        <div className="page-container contact-grid">
          <div>
            <SectionHeading eyebrow="Coordonnées" title="Retrouvez-nous à Dakar" />
            <address className="contact-details">
              <div>
                <MapPin />
                <p>
                  <strong>Adresse</strong>
                  <span>
                    Liberté 6, SCAT Urbam, derrière le Restaurant Pentola, Immeuble GSI, 2ᵉ étage,
                    Dakar
                  </span>
                </p>
              </div>
              <a href="mailto:contact@cudis.com">
                <Mail />
                <p>
                  <strong>E-mail</strong>
                  <span>contact@cudis.com</span>
                </p>
              </a>
              <a href="https://facebook.com/CadreUnitaireIslam" target="_blank" rel="noreferrer">
                <Facebook />
                <p>
                  <strong>Facebook</strong>
                  <span>CadreUnitaireIslam</span>
                </p>
              </a>
              <a href="https://x.com/Islam_Senegal" target="_blank" rel="noreferrer">
                <span className="x-icon">X</span>
                <p>
                  <strong>X / Twitter</strong>
                  <span>@Islam_Senegal</span>
                </p>
              </a>
            </address>
          </div>
          <div>
            <SectionHeading eyebrow="Votre message" title="Écrivez-nous" />
            <ContactForm />
          </div>
        </div>
      </section>
      <section className="map-section">
        <iframe
          title="Localisation du CUDIS à Dakar"
          src={map}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </section>
    </>
  );
}
