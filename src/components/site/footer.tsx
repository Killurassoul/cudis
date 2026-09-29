import { Link } from "react-router-dom";
import { Facebook, Mail, MapPin } from "lucide-react";
import { Brand } from "./brand";
import { FacebookEmbed } from "./facebook-embed";

export function Footer() {
  return (
    <footer className="site-footer islamic-pattern">
      <div className="page-container footer-grid">
        <div>
          <Brand />
          <p className="footer-intro">
            Au service de la paix, de la cohésion sociale et du modèle islamique sénégalais.
          </p>
        </div>
        <div>
          <h2 className="footer-title">Nous contacter</h2>
          <address className="footer-links">
            <span>
              <MapPin />
              Liberté 6, SCAT Urbam, Dakar
            </span>
            <a href="mailto:contact@cudis.com">
              <Mail />
              contact@cudis.com
            </a>
            <a href="https://facebook.com/CadreUnitaireIslam" target="_blank" rel="noreferrer">
              <Facebook />
              CadreUnitaireIslam
            </a>
          </address>
        </div>
        <div>
          <h2 className="footer-title">Suivez le CUDIS</h2>
          <FacebookEmbed compact />
        </div>
      </div>
      <div className="page-container footer-bottom">
        <span>© {new Date().getFullYear()} CUDIS</span>
        <Link to="/contact">Contact</Link>
      </div>
    </footer>
  );
}
