# Site institutionnel CUDIS

## Objectif

Construire le site public complet du Cadre Unitaire de l’Islam au Sénégal, avec une identité visuelle fidèle à la charte fournie, des pages distinctes et un parcours clair sur mobile comme sur ordinateur.

## Pages et navigation

- Mettre en place l’en-tête et le pied de page communs, la navigation active et le menu mobile.
- Créer les pages Accueil, Le Cadre, Équipe, Programmes, Partenariat, Ressources et Contact.
- Créer les 16 profils individuels de l’équipe et les pages de détail des trois programmes.
- Créer les quatre sections Ressources : Galerie, Vidéo, Audio et Documents, avec des états vides soignés.

## Contenu et fonctions

- Intégrer uniquement les textes, personnes, fonctions, programmes, partenaires et coordonnées fournis.
- Employer des portraits temporaires à initiales et des emplacements de logos clairement identifiés.
- Ajouter les widgets Facebook officiels avec un message de repli discret.
- Ajouter la carte Google centrée sur les coordonnées fournies.
- Construire le formulaire de contact avec validation, état d’envoi, succès et erreur, prêt à appeler `/api/contact`.

## Direction visuelle

- Appliquer exactement la palette vert profond, or et crème fournie.
- Utiliser Spectral pour les titres et Work Sans pour le corps.
- Créer le motif géométrique islamique, les cadres en arche et les séparateurs dorés.
- Créer une marque CUDIS typographique temporaire, faute de fichier de logo officiel fourni, sans inventer un autre emblème.
- Ajouter des transitions discrètes respectant les préférences de réduction des animations.

## Qualité

- Assurer l’adaptation de 360 px aux grands écrans, les zones sûres mobiles, la navigation clavier et les contrastes.
- Ajouter les titres, descriptions, Open Graph, données structurées Organization, robots et sitemap.
- Vérifier la compilation, les erreurs d’exécution et les parcours principaux sur ordinateur et mobile.

## Détails techniques

- Conserver TanStack Start, le framework imposé par l’environnement, avec rendu serveur et routes indexables équivalentes au besoin SEO exprimé.
- Centraliser les contenus structurés et réutiliser les composants d’interface.
- Le traitement serveur réel du formulaire reste volontairement hors périmètre : l’interface appellera l’adresse API prévue par le prompt backend séparé.
