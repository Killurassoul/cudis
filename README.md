# Cadre CUDIS

## Backend Supabase et administration

Le backend complet du site vit dans le même projet que le frontend :

- **Migration SQL unique** : `supabase/migrations/202609190001_cudis_backend.sql` — tables, types énumérés, index, RLS complète, buckets Storage, données de départ.
- **Panneau d'administration** : `/gestion` (route discrète, `noindex`, exclue de `robots.txt`).
- **Formulaire de contact** : `POST /api/contact` — validation, honeypot, rate limit par IP, enregistrement Supabase, notification Resend.
- **Assistant IA (optionnel)** : `POST /api/assistant` — désactivé par défaut, multi-fournisseurs (Gemini / Claude / OpenAI).
- **Chat public** : widget disponible sur toutes les pages publiques ; les échanges ne sont pas conservés. L'IA reste désactivée tant que sa configuration et son budget ne sont pas validés.
- **Vercel** : cible Nitro configurée pour Vercel dans `vite.config.ts` et `vercel.json`.
- **Variables d'environnement** : voir `.env.example` (copier vers `.env.local`, ne jamais commiter).

### 1. Configuration Supabase

1. Créer un projet sur [supabase.com](https://supabase.com).
2. Ouvrir **SQL Editor**, coller tout le contenu de la migration et l'exécuter (ou utiliser la CLI : `supabase db push`).
3. Noter depuis **Settings → API** : `Project URL`, `anon key`, `service_role key` → à reporter dans `.env.local` / les variables d'environnement de l'hébergeur.

### 2. Déclarer les administrateurs (obligatoire)

Dans le **SQL Editor** de Supabase (droits superuser requis) :

```sql
alter role authenticator set app.admin_emails = 'Rassoulgye@gmail.com';
notify pgrst, 'reload config';
```

Plusieurs comptes : séparés par des virgules. Cette liste alimente les policies RLS : seul un compte authentifié dont l'e-mail y figure peut écrire dans les tables ou lire les messages de contact. Dupliquer la même liste dans `VITE_ADMIN_EMAILS` (couche de confort côté navigateur).

### 3. Créer le premier compte admin

Aucune inscription publique n'existe. Après déploiement :

1. Dans Supabase : **Authentication → Users → Add user**.
2. E-mail : `Rassoulgye@gmail.com`, mot de passe temporaire, cocher **Auto Confirm User**.
3. Vérifier que l'e-mail figure bien dans `app.admin_emails` (étape 2).
4. Se connecter sur `https://votre-site.tld/gestion` ; le mot de passe peut ensuite être changé (Supabase → Authentication → Users → … → Send password recovery, ou depuis la session : `supabase.auth.updateUser({ password })`).

Le mot de passe n'est jamais codé en dur ni stocké dans le code : il vit uniquement dans Supabase Auth.

### 4. Sécurité (résumé)

- RLS activée sur **toutes** les tables, sans exception ; lecture publique uniquement pour `members`, `programs`, `partners`, `resources` (+ buckets Storage publics en lecture).
- `contact_submissions` : aucune policy d'insertion publique — l'écriture passe exclusivement par la route serveur (`SUPABASE_SERVICE_ROLE_KEY`, jamais exposée au navigateur) ; lecture/archivage réservés à l'admin. Pas de suppression : archivage uniquement.
- Uploads limités à 10 Mo, types JPG / PNG / WEBP / PDF / DOCX ; les photos membres et logos partenaires sont recadrées en carré 800×800 côté navigateur avant envoi.
- Entrées du formulaire validées (zod) et assainies (contrôles retirés) côté serveur ; `ip_hash` stocké en SHA-256, jamais l'IP brute.
- HTTPS forcé par l'hébergeur (Vercel/Railway).

### 5. Contact et anti-spam

`POST /api/contact` : 5 messages max/heure/IP + champ honeypot. Chaque message est enregistré dans `contact_submissions` **avant** l'envoi de l'e-mail (aucune perte si Resend échoue). L'e-mail part vers `CONTACT_EMAIL_TO` si `RESEND_API_KEY` est définie ; configurer le domaine expéditeur chez Resend (SPF/DKIM) pour un envoi fiable.

### 6. Assistant IA — activation et suivi des coûts

Désactivé par défaut (`ENABLE_AI_ASSISTANT=false`) : la route répond 503 et n'appelle aucun modèle.

Pour l'activer :

1. Choisir un fournisseur et obtenir une clé : [Gemini](https://aistudio.google.com/apikey) (par défaut, `GEMINI_API_KEY`), [Anthropic](https://console.anthropic.com) (`ANTHROPIC_API_KEY`) ou [OpenAI](https://platform.openai.com/api-keys) (`OPENAI_API_KEY`). Le changement se fait par `AI_PROVIDER`, sans toucher au code.
2. Définir `ENABLE_AI_ASSISTANT=true` et `AI_PROVIDER=gemini` dans l'environnement.
3. Redéployer.

Garde-fous intégrés : 10 messages max/heure/IP, réponses plafonnées, périmètre strictement limité au contenu public du site (mission, membres, programmes, contacts — synchronisé depuis Supabase), aucune mémoire entre sessions, aucun accès internet.

Suivre les coûts : chaque appel est journalisé dans `assistant_usage` (métadonnées uniquement — jamais le contenu des conversations) :

```sql
select date_trunc('day', created_at) as jour,
       count(*) as appels,
       count(*) filter (where success) as reussis,
       count(*) filter (where not success) as echecs
from public.assistant_usage
group by 1 order by 1 desc limit 30;
```

Une requête représente environ 600 tokens (prompt de contexte + question + réponse). Multiplier par le tarif courant du fournisseur pour estimer le coût mensuel ; si le trafic décolle, basculer sur un modèle plus économique ou désactiver la variable.

### 7. Déploiement

- **Supabase** héberge la base, l'auth et le stockage — rien à gérer côté serveur.
- L'application (frontend + routes API) se déploie sur Vercel ; importer le dépôt dans Vercel puis ajouter les variables de `.env.example` dans **Settings → Environment Variables**. Pour les routes serveur, conserver les clés privées sans préfixe `VITE_`.
- Configurer au minimum `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_ADMIN_EMAILS`, `ENABLE_AI_ASSISTANT=true`, `AI_PROVIDER` et la clé privée du fournisseur IA choisi pour activer le chatbot.
- Vérifier le déploiement avec `npm run build`, puis lancer `vercel --prod` depuis un poste connecté au compte Vercel. Ne jamais exposer `SUPABASE_SERVICE_ROLE_KEY` ni une clé IA au navigateur.
- Le sitemap se régénère depuis la base ; `/gestion` en est exclue et reste hors navigation publique.

# Prompt — Frontend du site du Cadre Unitaire de l'Islam au Sénégal (CUDIS)

Tu es chargé de construire le **frontend complet, multi-pages, en production**, du nouveau site web du CUDIS (Cadre Unitaire de l'Islam au Sénégal), une institution religieuse basée à Dakar qui regroupe les comités scientifiques des confréries soufies et des mouvements islamiques réformistes du pays. Ce n'est pas un MVP ni une démo : construis un site complet, soigné, avec toutes les pages, tous les états (chargement, vide, erreur), et une navigation propre entre elles.

## 1. Stack technique imposée

- **Next.js 14+ (App Router) en TypeScript** — pas de Create React App, pas de SPA pure : on veut du rendu serveur/statique pour le SEO (une institution qui publie des communiqués a besoin d'être bien indexée sur Google).
- **Tailwind CSS** pour le styling, avec les tokens de design ci-dessous déclarés dans `tailwind.config.ts` (pas de valeurs magiques éparpillées dans le code).
- Déploiement cible : **Vercel** ou **Railway**. Le code doit être livré prêt à déployer (pas de dépendance à un service local).
- Images : utilise `next/image` partout pour l'optimisation automatique.

## 2. Système de design — NE PAS MODIFIER, déjà validé par le client

**Palette (à déclarer comme couleurs Tailwind nommées) :**

- `green-950` : `#0a2e22` (fond des sections sombres, header)
- `green-800` : `#123f2f`
- `green-700` : `#1a5240` (dégradé du hero)
- `gold` : `#c9a227` (accent principal, bordures, CTA)
- `gold-soft` : `#e2c56a` (texte doré sur fond sombre)
- `cream` : `#faf6ec` (fond des sections claires)
- `cream-2` : `#f1e9d6` (fond des cartes)
- `ink` : `#1c1a13` (texte principal)

**Typographie :**

- Titres : **Spectral** (serif, Google Fonts) — poids 400/500/600, style italique disponible pour les citations.
- Corps de texte : **Work Sans** (sans-serif, Google Fonts) — poids 400/500/600.
- Ne pas utiliser d'autres familles de police.

**Langage visuel à respecter partout :**

- Motif géométrique étoilé islamique en filigrane (SVG, léger, ~14% d'opacité) sur les fonds `green-950`.
- Cadres en arche (style mihrab, `border-radius: 46% 46% 6px 6px`) pour toutes les photos de personnes.
- Bordures fines dorées (1 à 1.5px) comme séparateurs et cadres, jamais d'ombre lourde ni de dégradés criards.
- Le vrai logo du CUDIS doit apparaître : en grand format centré sur une plaque crème avec bordure dorée dans le hero de l'accueil, et en petit format dans le header de chaque page (chip crème sur fond vert).
- Ambiance générale : sobre, élégante, digne d'une institution religieuse nationale — pas de style "startup", pas d'emoji dans l'UI, pas de gradients flashy.
- Motion : discret, une seule animation d'entrée par section maximum, respecter `prefers-reduced-motion`.

## 3. Arborescence des pages (site multi-pages, pas une seule page à ancres)

```
/                           → Accueil (résumé + aperçux de chaque section + widget Facebook)
/le-cadre                   → Qui sommes-nous + Ce que nous faisons (histoire, mission, valeurs)
/equipe                     → Grille des membres du bureau
/equipe/[slug]              → Page individuelle de chaque membre (photo, nom, fonction, bio si dispo)
/programmes                 → Liste avec onglets Réalisés / En cours / À venir
/programmes/[slug]          → Détail d'un programme (peut être ajouté plus tard, prévoir la route)
/partenariat                → Liste des partenaires avec logos
/ressources                 → Sous-navigation vers Galerie / Vidéo / Audio / Documents
/ressources/galerie
/ressources/video
/ressources/audio
/ressources/documents
/contact                    → Formulaire + adresse + carte + réseaux sociaux
```

Chaque page a son propre `<title>` et sa propre meta description (SEO). Le header et le footer sont des composants partagés, identiques sur toutes les pages, avec la navigation active mise en évidence.

## 4. Contenu réel à intégrer (ne pas inventer d'autre contenu)

**Membres du bureau (16, à afficher en grille sur `/equipe`, chacun avec sa propre page `/equipe/[slug]`) :**

| Nom                         | Fonction                                                  |
| --------------------------- | --------------------------------------------------------- |
| Cheikh Tidiane SY           | Président                                                 |
| Ouztaz Makhtar Kébé         | Vice-président chargé de la communication                 |
| Cherif Mballo               | Vice-président chargé des relations avec les institutions |
| Abdou Aziz Mbacké Majalis   | Vice-président chargé des projets                         |
| Djibril Laye Diop           | Vice-président chargé de la médiation                     |
| Dr Abdoullah Lam            | Vice-président chargé de la mobilisation                  |
| Pr Malamine Kourouma        | Vice-président chargé de la commission scientifique       |
| Mame Cheikh Mbacké          | Vice-président chargé des familles religieuses            |
| Dr Cheikh Guèye             | Secrétaire général                                        |
| Dr Mamarame Seck            | Secrétaire général adjoint                                |
| Pr Fatou Sarr Sow           | Trésorière générale                                       |
| Dr Moustapha Mbengue        | Trésorier général adjoint                                 |
| Serigne Sam Bousso          | Membre du bureau                                          |
| Dr Mamadou Dia              | Membre du bureau                                          |
| Serigne Bou Mouhamed Kounta | Vice-président                                            |
| Cheikh Ahmed Saloum Dieng   | Vice-président                                            |

> Les photos définitives seront fournies séparément (dossier `/public/equipe/`). En attendant, utilise des placeholders visuellement propres (silhouette ou initiales sur fond `cream-2`) — ne mets pas d'images génériques de stock à la place.

**Qui sommes-nous** : "Le Cadre Unitaire de l'islam au Sénégal (CUIS) est né de la volonté de préserver la cohésion sociale et le modèle de paix et de tolérance religieuse au Sénégal. C'est l'unique association qui regroupe les comités scientifiques des différentes confréries soufies du pays et d'autres mouvements islamiques de types réformistes."

**Ce que nous faisons** : "L'objectif général du CUDIS est la consolidation du contrat social sénégalais et la lutte contre l'obscurantisme et l'intégrisme religieux, en apportant une contribution à la réponse doctrinale pour la préservation du modèle islamique sénégalais connu pour sa tolérance."

**Programmes (à répartir dans les onglets appropriés) :**

- _En cours_ — Projet Dahiras : former sur deux ans plus de 20 000 dahiras et associations islamiques à travers le pays pour en faire des espaces d'éducation spirituelle, civique et économique (femmes rurales et jeunes en priorité).
- _Réalisé_ — Campagne de lutte contre la haine et la désinformation sur les réseaux sociaux, menée en partenariat avec Meta.
- _À venir_ — Semaine nationale du vivre-ensemble : manifestations culturelles, scientifiques et religieuses à travers le pays.

**Partenaires** : OSIWA, Commission Scientifique Layène, RIS, GSI, UCAD, AIS (logos à demander, prévoir des slots).

**Contact :**

- Adresse : Liberté 6, SCAT Urbam, derrière le Restaurant Pentola, Immeuble GSI, 2ᵉ étage, Dakar
- E-mail : contact@cudis.com
- Facebook : facebook.com/CadreUnitaireIslam
- X/Twitter : @Islam_Senegal
- Carte : intégrer une Google Map centrée sur ces coordonnées (14.7351652, -17.4627704)

## 5. Composants Facebook (widgets officiels, pas de captures d'écran)

- Sur `/` et `/le-cadre` (ou une page dédiée si tu préfères) : widget "Page Plugin" Facebook officiel en iframe, en mode timeline, encadré avec la bordure dorée du design system.
- Dans le footer (toutes les pages) : petit widget "like/facepile" Facebook compact.
- Prévoir un état de repli propre (message discret) si l'iframe ne charge pas (page Facebook non publique, bloqueur de pub, etc.) — ne jamais laisser un cadre vide moche.

## 6. Formulaire de contact

Un vrai formulaire (nom, email, sujet, message) sur `/contact`, avec validation côté client. Prévoir un appel à une route API (`/api/contact`) qui sera branchée côté backend (voir le prompt backend séparé) — ne pas la simuler avec un simple `mailto:`.

## 7. Exigences de qualité (non négociables)

- Responsive complet, du mobile (360px) au desktop large, avec `env(safe-area-inset-*)` géré proprement sur mobile.
- Accessibilité : focus clavier visible, contraste suffisant, alt text sur toutes les images, structure de titres logique (un seul `

` par page).

- Performance : Lighthouse ≥ 90 sur toutes les métriques, images optimisées, pas de librairie JS inutile.
- SEO : sitemap.xml généré, balises meta Open Graph par page, favicon, données structurées `Organization` en JSON-LD sur l'accueil.
- Pas de texte "Lorem ipsum" ni de contenu placeholder visible en production — tout le texte listé ci-dessus doit être réellement intégré.

## 8. Livrable attendu

Un projet Next.js complet, structuré, avec tous les composants réutilisables extraits proprement (Header, Footer, MemberCard, ProgramTabs, FacebookEmbed, etc.), prêt à `npm run build && npm run start` sans erreur, et prêt à déployer.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3686853d-253d-40cf-8a20-9eeb90e4d638).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
