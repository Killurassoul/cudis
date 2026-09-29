export async function extractAdminDocument(file: File): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (file.size > 10 * 1024 * 1024) throw new Error("Le document dépasse la limite de 10 Mo.");
  if (extension === "txt") return (await file.text()).slice(0, 120_000);
  if (extension === "docx") {
    const mammoth = await import("mammoth/mammoth.browser");
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value.slice(0, 120_000);
  }
  if (extension === "pdf") {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url).toString();
    const document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= Math.min(document.numPages, 80); pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => "str" in item ? item.str : "").join(" "));
    }
    return pages.join("\n").slice(0, 120_000);
  }
  throw new Error("Formats acceptés : PDF, DOCX ou TXT.");
}

export type AdminAiEntity = "members" | "programs" | "partners" | "resources" | "assistant_knowledge";
export type AdminAiProposal = {
  entity: AdminAiEntity;
  action: "create" | "update" | "delete";
  target_id?: string;
  record: Record<string, unknown>;
  summary: string;
};

const allowedFields: Record<AdminAiEntity, string[]> = {
  members: ["slug", "nom", "fonction", "photo_url", "ordre_affichage", "bio", "actif"],
  programs: ["titre", "description", "statut", "date_debut", "date_fin"],
  partners: ["nom", "logo_url", "lien_externe"],
  resources: ["type", "titre", "url_fichier", "url_externe", "date_publication"],
  assistant_knowledge: ["topic", "content", "active", "sort_order"],
};

export function sanitizeAdminAiProposal(value: unknown, ids: Record<AdminAiEntity, string[]>): AdminAiProposal {
  if (!value || typeof value !== "object") throw new Error("Proposition IA invalide.");
  const raw = value as Record<string, unknown>;
  if (typeof raw["entity"] !== "string" || !Object.hasOwn(allowedFields, raw["entity"]) || !["create", "update", "delete"].includes(String(raw["action"]))) throw new Error("Type d’action non autorisé.");
  const entity = raw["entity"] as AdminAiEntity;
  const action = raw["action"] as AdminAiProposal["action"];
  const targetId = typeof raw["target_id"] === "string" ? raw["target_id"] : undefined;
  if (action !== "create" && (!targetId || !ids[entity].includes(targetId))) throw new Error("La cible choisie ne correspond à aucun élément chargé dans cette section.");
  const source = raw["record"] && typeof raw["record"] === "object" ? raw["record"] as Record<string, unknown> : {};
  const record: Record<string, unknown> = {};
  for (const field of allowedFields[entity]) {
    const fieldValue = source[field];
    if (fieldValue === null || ["string", "number", "boolean"].includes(typeof fieldValue)) record[field] = fieldValue;
  }
  if (action !== "delete" && Object.keys(record).length === 0) throw new Error("La proposition ne contient aucun champ à enregistrer.");
  return { entity, action, ...(targetId ? { target_id: targetId } : {}), record, summary: String(raw["summary"] ?? "Action proposée par l’assistant").slice(0, 300) };
}
