import { createFileRoute } from "@tanstack/react-router";
import { getPublicMembers, getPublicPrograms } from "@/lib/content";
import { programRouteId } from "@/components/site/cards";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const [members, programs] = await Promise.all([getPublicMembers(), getPublicPrograms()]);
        const paths = [
          "/",
          "/le-cadre",
          "/equipe",
          "/programmes",
          "/partenariat",
          "/ressources",
          "/ressources/galerie",
          "/ressources/video",
          "/ressources/audio",
          "/ressources/documents",
          "/contact",
          ...members.map((member) => `/equipe/${member.slug}`),
          ...programs.map((program) => `/programmes/${programRouteId(program)}`),
        ];
        const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${origin}${path}</loc></url>`).join("")}</urlset>`;
        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
