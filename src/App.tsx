import { lazy, Suspense, useEffect } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";

import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/header";
const PublicAssistant = lazy(() => import("@/components/site/public-assistant").then((m) => ({ default: m.PublicAssistant })));
const HomePage = lazy(() => import("@/routes/index"));
const AboutPage = lazy(() => import("@/routes/le-cadre"));
const MembersPage = lazy(() => import("@/routes/equipe"));
const MemberPage = lazy(() => import("@/routes/equipe.$slug"));
const ProgramsPage = lazy(() => import("@/routes/programmes"));
const ProgramPage = lazy(() => import("@/routes/programmes.$slug"));
const PartnershipPage = lazy(() => import("@/routes/partenariat"));
const ResourcesPage = lazy(() => import("@/routes/ressources"));
const GalleryPage = lazy(() => import("@/routes/ressources.galerie"));
const VideoPage = lazy(() => import("@/routes/ressources.video"));
const AudioPage = lazy(() => import("@/routes/ressources.audio"));
const DocumentsPage = lazy(() => import("@/routes/ressources.documents"));
const ContactPage = lazy(() => import("@/routes/contact"));
const AdminPage = lazy(() => import("@/routes/gestion"));

function MissingPage() {
  return (
    <section className="section">
      <div className="page-container empty-state">
        <span>404</span>
        <h1>Page introuvable</h1>
        <p>Cette page n’existe pas ou a été déplacée.</p>
        <Link className="text-link" to="/">Retour à l’accueil</Link>
      </div>
    </section>
  );
}

function AppShell() {
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith("/gestion");

  useEffect(() => {
    const titles: Record<string, string> = {
      "/": "CUDIS — Cadre Unitaire de l’Islam au Sénégal",
      "/le-cadre": "Le Cadre — CUDIS",
      "/equipe": "Équipe — CUDIS",
      "/programmes": "Programmes — CUDIS",
      "/partenariat": "Partenariat — CUDIS",
      "/ressources": "Ressources — CUDIS",
      "/ressources/galerie": "Galerie — CUDIS",
      "/ressources/video": "Vidéos — CUDIS",
      "/ressources/audio": "Audio — CUDIS",
      "/ressources/documents": "Documents — CUDIS",
      "/contact": "Contact — CUDIS",
      "/gestion": "Administration — CUDIS",
    };
    const title = titles[pathname] ?? (pathname.startsWith("/equipe/") ? "Membre — CUDIS" : pathname.startsWith("/programmes/") ? "Programme — CUDIS" : "Page — CUDIS");
    const descriptions: Record<string, string> = {
      "/": "Le CUDIS œuvre pour la paix, la cohésion sociale et la préservation du modèle islamique sénégalais.",
      "/le-cadre": "Découvrez la mission, l’histoire et les principes du Cadre Unitaire de l’Islam au Sénégal.",
      "/equipe": "Découvrez les membres du bureau du Cadre Unitaire de l’Islam au Sénégal.",
      "/programmes": "Découvrez les programmes réalisés, en cours et à venir du CUDIS.",
      "/partenariat": "Les partenaires institutionnels et associatifs du CUDIS.",
      "/ressources": "Retrouvez les ressources et publications du CUDIS.",
      "/ressources/galerie": "Galerie photo des activités du CUDIS.",
      "/ressources/video": "Interventions, conférences et reportages du CUDIS.",
      "/ressources/audio": "Enregistrements et prises de parole du CUDIS.",
      "/ressources/documents": "Communiqués et publications institutionnelles du CUDIS.",
      "/contact": "Contacter le Cadre Unitaire de l’Islam au Sénégal à Dakar.",
      "/gestion": "Administration du site du CUDIS.",
    };
    const description = descriptions[pathname] ?? "Informations officielles sur le Cadre Unitaire de l’Islam au Sénégal.";
    document.title = title;
    let descriptionMeta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!descriptionMeta) {
      descriptionMeta = document.createElement("meta");
      descriptionMeta.name = "description";
      document.head.append(descriptionMeta);
    }
    descriptionMeta.content = description;
    let ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    if (!ogTitle) {
      ogTitle = document.createElement("meta");
      ogTitle.setAttribute("property", "og:title");
      document.head.append(ogTitle);
    }
    ogTitle.content = title;
    let robotsMeta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (pathname === "/gestion") {
      if (!robotsMeta) {
        robotsMeta = document.createElement("meta");
        robotsMeta.name = "robots";
        document.head.append(robotsMeta);
      }
      robotsMeta.content = "noindex, nofollow";
    } else {
      robotsMeta?.remove();
    }
  }, [pathname]);

  return (
    <>
      {!isAdmin && <Header />}
      <main>
        <Suspense fallback={<p className="section page-container" role="status">Chargement…</p>}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/le-cadre" element={<AboutPage />} />
          <Route path="/equipe" element={<MembersPage />} />
          <Route path="/equipe/:slug" element={<MemberPage />} />
          <Route path="/programmes" element={<ProgramsPage />} />
          <Route path="/programmes/:slug" element={<ProgramPage />} />
          <Route path="/partenariat" element={<PartnershipPage />} />
          <Route path="/ressources" element={<ResourcesPage />} />
          <Route path="/ressources/galerie" element={<GalleryPage />} />
          <Route path="/ressources/video" element={<VideoPage />} />
          <Route path="/ressources/audio" element={<AudioPage />} />
          <Route path="/ressources/documents" element={<DocumentsPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/gestion" element={<AdminPage />} />
          <Route path="*" element={<MissingPage />} />
        </Routes>
        </Suspense>
      </main>
      {!isAdmin && <Footer />}
      {!isAdmin && <Suspense fallback={null}><PublicAssistant /></Suspense>}
    </>
  );
}

export function App() {
  return <AppShell />;
}
