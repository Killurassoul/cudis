# CUDIS — déploiement statique OVH

Le site est une application React/Vite statique. Le dossier `dist/` contient les fichiers à publier sur l'hébergement mutualisé OVH. Supabase fournit l'authentification, la base, le stockage et deux Edge Functions publiques pour le formulaire et l'assistant.

## Développement et compilation

```sh
npm ci
cp .env.example .env.local
npm run dev
npm run build
```

Seules les variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont nécessaires au navigateur. Utiliser la clé publishable/anon du projet Supabase. Les clés `service_role`, `sb_secret_*` et les clés d'IA ne doivent jamais être ajoutées à `.env.local`, au dépôt ou à une variable `VITE_*`.

## Préparer Supabase

1. Exécuter les migrations `supabase/migrations/` dans l'ordre, depuis l'éditeur SQL Supabase ou avec `supabase db push` après liaison du projet.
2. Configurer les comptes administrateurs dans `app.admin_emails` comme décrit par la migration initiale. Créer leurs comptes dans **Authentication → Users**. Les droits d'écriture sont protégés par RLS ; `VITE_ADMIN_EMAILS` sert seulement au confort de connexion.
3. Définir les secrets côté Supabase, sans les transmettre dans le dépôt ni dans le chat. Dans **Project Settings → Edge Functions → Secrets** (ou `supabase secrets set`), configurer :

   - `SUPABASE_SECRET_KEY` : clé secrète serveur Supabase (`sb_secret_*`) ; à défaut, `SUPABASE_SERVICE_ROLE_KEY` si le projet expose encore l'ancienne clé.
   - `AI_PROVIDER=gemini`, `AI_MODEL=gemini-2.0-flash` et `GEMINI_API_KEY` (ou les secrets Anthropic/OpenAI correspondants).
   - `RESEND_API_KEY`, `CONTACT_EMAIL_FROM` (domaine validé) et `CONTACT_EMAIL_TO` pour les notifications e-mail.

4. Déployer les fonctions :

```sh
supabase functions deploy assistant
supabase functions deploy contact
```

Les fonctions sont accessibles sans session visiteur (`verify_jwt = false`), vérifient les entrées et appliquent les limites serveur : 10 questions d'assistant et 5 messages de contact par heure et par adresse IP hachée. L'assistant utilise uniquement le contenu public et les fiches de connaissance activées par l'admin. Les échanges ne sont pas conservés.

## Publier sur OVH

1. Créer `.env.local` avec l'URL Supabase et la clé publique, puis lancer `npm run build`.
2. Transférer **le contenu** de `dist/` dans le répertoire web OVH (souvent `www/`). Le fichier `dist/.htaccess` doit être présent.
3. Dans OVH, activer le certificat SSL et forcer HTTPS. Tester la page d'accueil, une URL profonde (par exemple `/equipe`), la connexion `/gestion`, l'envoi de contact, l'assistant et les uploads.

Le `.htaccess` renvoie les routes React vers `index.html` tout en laissant les fichiers et répertoires réels intacts. Si le site est publié dans un sous-répertoire, adapter les chemins de base et les règles de réécriture avant compilation.

## Administration

`/gestion` permet aux comptes autorisés de créer, modifier, supprimer et téléverser les membres, programmes, partenaires et ressources, de traiter les messages et de gérer la base de connaissances de l'assistant. Les fichiers de portraits fournis sont servis localement depuis `public/equipe/`; aucune image de membre n'est chargée depuis un site tiers.

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
