import { createFileRoute } from "@tanstack/react-router";
import { MemberCard } from "@/components/site/cards";
import { PageHero } from "@/components/site/page";
import { getPublicMembers } from "@/lib/content";

export const Route = createFileRoute("/equipe")({
  loader: () => getPublicMembers(),
  head: ({ loaderData }) => ({
    meta: [
      { title: "Équipe — CUDIS" },
      {
        name: "description",
        content: "Découvrez les membres du bureau du CUDIS et leurs responsabilités.",
      },
      { property: "og:title", content: "Le bureau du CUDIS" },
      {
        property: "og:description",
        content: "Les membres engagés au service de l'unité de l'islam au Sénégal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      ...(loaderData?.length ? [] : [{ name: "robots", content: "noindex" }]),
    ],
    links: [{ rel: "canonical", href: "/equipe" }],
  }),
  component: Page,
});

function Page() {
  const members = Route.useLoaderData();
  return (
    <>
      <PageHero
        eyebrow="Gouvernance"
        title="Les membres du bureau"
        intro="Les personnalités engagées au service de l'unité, du dialogue et de la cohésion sociale."
      />
      <section className="section">
        <div className="page-container member-grid">
          {members.map((member) => (
            <MemberCard key={member.id} member={member} />
          ))}
        </div>
      </section>
    </>
  );
}
