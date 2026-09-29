# CUDIS — déploiement statique OVH

Le site est une application React/Vite statique avec une petite passerelle PHP pour l'administration. Le dossier `dist/` contient les fichiers à publier sur l'hébergement mutualisé OVH. Supabase fournit la base, le stockage et deux Edge Functions publiques pour le formulaire et l'assistant. La connexion `/gestion` utilise une session PHP OVH et ne dépend pas de Supabase Auth.

## Développement et compilation

```sh
npm ci
cp .env.example .env.local
npm run dev
npm run build
```

Seules les variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont nécessaires au navigateur. Utiliser la clé publishable/anon du projet Supabase. Les clés serveur ne doivent jamais être commitées ni exposées dans une variable `VITE_*`.

Pour **le développement local uniquement**, `npm run dev` ouvre `/gestion` directement sans écran de connexion et utilise le proxy privé Vite. Ajoute une clé serveur Supabase fraîche à `CUDIS_LOCAL_SUPABASE_SECRET_KEY` dans `.env.local` pour que les ajouts/modifications fonctionnent. Cette variable n'a pas de préfixe `VITE_`, reste côté serveur, et n'entre pas dans `dist/`. Le serveur de développement écoute uniquement sur `127.0.0.1`. Ne déploie jamais le serveur Vite et n'utilise pas cette connexion locale en production.

Cela permet de préparer les contenus **avant le lancement** : ouvre `http://127.0.0.1:5173/gestion`, ajoute les membres, programmes, partenaires, ressources et éléments du chatbot. Ils sont enregistrés tout de suite dans le projet Supabase choisi dans `.env.local`; au déploiement, configure le même projet Supabase et ces contenus seront déjà disponibles sur le site.

## Préparer Supabase

1. Exécuter les migrations `supabase/migrations/` dans l'ordre, depuis l'éditeur SQL Supabase ou avec `supabase db push` après liaison du projet.
2. Aucun compte Supabase Auth n'est requis pour `/gestion`. Le serveur PHP OVH authentifie un compte administrateur et relaie seulement les tables et buckets autorisés, avec une clé secrète qui reste hors du navigateur.
3. Définir les secrets côté Supabase, sans les transmettre dans le dépôt ni dans le chat. Dans **Project Settings → Edge Functions → Secrets** (ou `supabase secrets set`), configurer :

   - `SUPABASE_SECRET_KEY` : clé secrète serveur Supabase (`sb_secret_*`) ; à défaut, `SUPABASE_SERVICE_ROLE_KEY` si le projet expose encore l'ancienne clé.
   - `AI_PROVIDER=gemini`, `AI_MODEL=gemini-3.6-flash` et `GEMINI_API_KEY` (ou les secrets Anthropic/OpenAI correspondants).
   - `RESEND_API_KEY`, `CONTACT_EMAIL_FROM` (domaine validé) et `CONTACT_EMAIL_TO` pour les notifications e-mail.

4. Déployer les fonctions :

```sh
supabase functions deploy assistant
supabase functions deploy contact
```

Les fonctions sont accessibles sans session visiteur (`verify_jwt = false`), vérifient les entrées et appliquent les limites serveur : 10 questions d'assistant et 5 messages de contact par heure et par adresse IP hachée. L'assistant utilise uniquement le contenu public et les fiches de connaissance activées par l'admin. Les échanges ne sont pas conservés.

## Configurer l'accès admin OVH

L'hébergement doit prendre en charge PHP 8.1 ou plus récent, cURL et les sessions. Le script `public/api/admin.php` exige un fichier secret placé **à côté du répertoire `www/`, jamais dedans**. Copier `deploy/cudis-secrets.example.php` sous `/.cudis-secrets.php` sur l'espace OVH, puis définir :

- `admin_email` : adresse de connexion choisie.
- `admin_password_hash` : hash généré sur un ordinateur de confiance avec `php -r "echo password_hash('un-mot-de-passe-long', PASSWORD_DEFAULT), PHP_EOL;"`.
- `supabase_url` : URL du projet.
- `supabase_secret_key` : nouvelle clé serveur Supabase. Ne pas utiliser une clé qui a été partagée dans une conversation; la révoquer et en créer une nouvelle.

Utiliser un mot de passe long et unique. La passerelle utilise un cookie `HttpOnly`, `SameSite=Strict`, une session limitée à huit heures, limite les essais de connexion et n'accepte que les tables/buckets nécessaires à l'admin.

## Publier sur OVH

1. Créer `.env.local` avec l'URL Supabase et la clé publique, puis lancer `npm run build`.
2. Transférer **le contenu** de `dist/` dans le répertoire web OVH (souvent `www/`). Le fichier `dist/.htaccess` doit être présent.
3. Installer le fichier `/.cudis-secrets.php` hors du webroot. Activer PHP, cURL et le certificat SSL dans OVH, puis forcer HTTPS. Tester la page d'accueil, une URL profonde (par exemple `/equipe`), la connexion `/gestion`, l'envoi de contact, l'assistant et les uploads.

Le `.htaccess` renvoie les routes React vers `index.html` tout en laissant les fichiers et répertoires réels intacts. Si le site est publié dans un sous-répertoire, adapter les chemins de base et les règles de réécriture avant compilation.

## Administration

`/gestion` permet au compte PHP admin configuré sur OVH de créer, modifier, supprimer et téléverser les membres, programmes, partenaires et ressources, de traiter les messages et de gérer la base de connaissances de l'assistant. Les fichiers de portraits fournis sont servis localement depuis `public/equipe/`; aucune image de membre n'est chargée depuis un site tiers.

L'onglet **Chatbot IA** comprend aussi l'assistant d'administration :

- Choix de Gemini, OpenAI ou Anthropic, saisie du modèle et test de connexion.
- La clé IA est enregistrée dans `/.cudis-ai.json`, au même niveau que `/.cudis-secrets.php` et hors du webroot. Le compte PHP doit pouvoir écrire dans ce dossier. La clé n'est jamais retournée au navigateur ni enregistrée dans Supabase.
- En local, les paramètres sont enregistrés dans `.cudis-ai.local.json` à la racine, fichier ignoré par Git. Le serveur Vite reste lié à `127.0.0.1`.
- L'import d'un PDF texte, DOCX ou TXT demande à l'IA de proposer une fiche. Après validation, le document est ajouté aux ressources et la fiche à la base de connaissances active du chatbot public. Les PDF scannés sans couche texte nécessitent une OCR préalable.
- Les commandes d'administration proposent une seule création, modification ou suppression sur les membres, programmes, partenaires, ressources et fiches du chatbot. L'action n'est envoyée à Supabase qu'après confirmation; les cibles de modification/suppression doivent déjà figurer dans les enregistrements chargés.

Cette configuration sert à l'assistant d'administration. Le chatbot public reste configuré séparément avec les secrets des Edge Functions Supabase décrits plus haut. Le backend d'administration est une route PHP OVH : la configuration par interface nécessite donc le déploiement OVH documenté ici, et ne fonctionne pas sur un hébergement statique Vercel sans porter cette route PHP vers une fonction serveur.

## Contrôle des coûts de l'assistant

Les appels (métadonnées sans question/réponse) sont inscrits dans `assistant_usage` :

```sql
select date_trunc('day', created_at) as jour,
       count(*) as appels,
       count(*) filter (where success) as reussis,
       count(*) filter (where not success) as echecs
from public.assistant_usage
group by 1 order by 1 desc limit 30;
```

Prévoir un budget et des alertes chez le fournisseur IA. La limite applicative réduit les abus mais ne remplace pas les plafonds de dépenses configurés dans son compte.
