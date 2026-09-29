import { ProgramTabs } from "@/components/site/program-tabs";
import { PageHero } from "@/components/site/page";
import { getPublicPrograms } from "@/lib/content";
import { useAsyncValue } from "@/lib/use-async-value";

const loadPrograms = () => getPublicPrograms();

export default function Page() {
  const programs = useAsyncValue("programmes", loadPrograms, []);
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
