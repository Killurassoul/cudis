import { useState } from "react";
import { ProgramCard } from "./cards";
import type { Program } from "@/lib/supabase";

const tabs = [
  ["en_cours", "En cours"],
  ["realise", "Réalisé"],
  ["a_venir", "À venir"],
] as const;

export function ProgramTabs({ programs }: { programs: Program[] }) {
  const [active, setActive] = useState<(typeof tabs)[number][0]>("en_cours");
  return (
    <div>
      <div className="program-tabs" role="tablist" aria-label="Filtrer les programmes">
        {tabs.map(([status, label]) => (
          <button
            key={status}
            type="button"
            role="tab"
            aria-selected={active === status}
            className={active === status ? "program-tab active" : "program-tab"}
            onClick={() => setActive(status)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="program-list">
        {programs
          .filter((program) => program.statut === active)
          .map((program) => (
            <ProgramCard key={program.id} program={program} />
          ))}
      </div>
    </div>
  );
}
