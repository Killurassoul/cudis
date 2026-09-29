import { createFileRoute } from "@tanstack/react-router";
import { ProgramTabs } from "@/components/site/program-tabs";
import { PageHero } from "@/components/site/page";
import { getPublicPrograms } from "@/lib/content";

export const Route = createFileRoute("/programmes")({
  loader: () => getPublicPrograms(),
  head: () => ({
    meta: [
      { title: "Programmes — CUDIS" },
      {
        name: "description",
        content: "Découvrez les programmes réalisés, en cours et à venir du CUDIS.",
      },
      { property: "og:title", content: "Programmes — CUDIS" },
      {
        property: "og:description",
        content: "Les actions du CUDIS pour l'éducation, le dialogue et le vivre-ensemble.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/programmes" }],
  }),
  component: Page,
});

function Page() {
  const programs = Route.useLoaderData();
  return (
    <>
      <PageHero
        eyebrow="Nos actions"
        title="Programmes"
        intro="Des initiatives de terrain pour renforcer l'éducation, la responsabilité civique et le vivre-ensemble."
      />
      <section className="section">
        <div className="page-container narrow">
          <ProgramTabs programs={programs} />
        </div>
      </section>
    </>
  );
}
