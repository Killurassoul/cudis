import { MemberCard } from "@/components/site/cards";
import { PageHero } from "@/components/site/page";
import { getPublicMembers } from "@/lib/content";
import { useAsyncValue } from "@/lib/use-async-value";

const loadMembers = () => getPublicMembers();

export default function Page() {
  const members = useAsyncValue("members", loadMembers, []);
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
