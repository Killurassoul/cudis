export const members = [
  { slug: "cheikh-tidiane-sy", name: "Cheikh Tidiane SY", role: "Président" },
  {
    slug: "ouztaz-makhtar-kebe",
    name: "Ouztaz Makhtar Kébé",
    role: "Vice-président chargé de la communication",
  },
  {
    slug: "cherif-mballo",
    name: "Cherif Mballo",
    role: "Vice-président chargé des relations avec les institutions",
  },
  {
    slug: "abdou-aziz-mbacke-majalis",
    name: "Abdou Aziz Mbacké Majalis",
    role: "Vice-président chargé des projets",
  },
  {
    slug: "djibril-laye-diop",
    name: "Djibril Laye Diop",
    role: "Vice-président chargé de la médiation",
  },
  {
    slug: "dr-abdoullah-lam",
    name: "Dr Abdoullah Lam",
    role: "Vice-président chargé de la mobilisation",
  },
  {
    slug: "pr-malamine-kourouma",
    name: "Pr Malamine Kourouma",
    role: "Vice-président chargé de la commission scientifique",
  },
  {
    slug: "mame-cheikh-mbacke",
    name: "Mame Cheikh Mbacké",
    role: "Vice-président chargé des familles religieuses",
  },
  { slug: "dr-cheikh-gueye", name: "Dr Cheikh Guèye", role: "Secrétaire général" },
  { slug: "dr-mamarame-seck", name: "Dr Mamarame Seck", role: "Secrétaire général adjoint" },
  { slug: "pr-fatou-sarr-sow", name: "Pr Fatou Sarr Sow", role: "Trésorière générale" },
  { slug: "dr-moustapha-mbengue", name: "Dr Moustapha Mbengue", role: "Trésorier général adjoint" },
  { slug: "serigne-sam-bousso", name: "Serigne Sam Bousso", role: "Membre du bureau" },
  { slug: "dr-mamadou-dia", name: "Dr Mamadou Dia", role: "Membre du bureau" },
  {
    slug: "serigne-bou-mohamed-kounta",
    name: "Serigne Bou Mouhamed Kounta",
    role: "Vice-président",
  },
  { slug: "cheikh-ahmed-saloum-dieng", name: "Cheikh Ahmed Saloum Dieng", role: "Vice-président" },
] as const;

export const programs = [
  {
    slug: "projet-dahiras",
    status: "En cours",
    title: "Projet Dahiras",
    description:
      "Former sur deux ans plus de 20 000 dahiras et associations islamiques à travers le pays pour en faire des espaces d’éducation spirituelle, civique et économique, avec les femmes rurales et les jeunes en priorité.",
  },
  {
    slug: "lutte-haine-desinformation",
    status: "Réalisé",
    title: "Lutte contre la haine et la désinformation",
    description:
      "Campagne de lutte contre la haine et la désinformation sur les réseaux sociaux, menée en partenariat avec Meta.",
  },
  {
    slug: "semaine-vivre-ensemble",
    status: "À venir",
    title: "Semaine nationale du vivre-ensemble",
    description: "Manifestations culturelles, scientifiques et religieuses à travers le pays.",
  },
] as const;

export const partners = [
  "OSIWA",
  "Commission Scientifique Layène",
  "RIS",
  "GSI",
  "UCAD",
  "AIS",
] as const;

export const aboutText =
  "Le Cadre Unitaire de l'islam au Sénégal (CUIS) est né de la volonté de préserver la cohésion sociale et le modèle de paix et de tolérance religieuse au Sénégal. C'est l'unique association qui regroupe les comités scientifiques des différentes confréries soufies du pays et d'autres mouvements islamiques de types réformistes.";
export const missionText =
  "L'objectif général du CUDIS est la consolidation du contrat social sénégalais et la lutte contre l'obscurantisme et l'intégrisme religieux, en apportant une contribution à la réponse doctrinale pour la préservation du modèle islamique sénégalais connu pour sa tolérance.";

export function initials(name: string) {
  return name
    .split(" ")
    .filter((part) => !["Dr", "Pr"].includes(part))
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
