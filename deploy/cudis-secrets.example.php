<?php
// Copier hors du dossier web OVH, sous le nom .cudis-secrets.php,
// puis remplacer les valeurs sur le serveur. Ne jamais versionner le fichier réel.
return [
    'admin_email' => 'admin@example.com',
    // Générer avec PHP : password_hash('mot-de-passe-long-et-unique', PASSWORD_DEFAULT)
    'admin_password_hash' => 'REMPLACER_PAR_UN_HASH_PASSWORD_DEFAULT',
    'supabase_url' => 'https://your-project.supabase.co',
    'supabase_secret_key' => 'REMPLACER_PAR_LA_CLE_SECRETE_SUPABASE',
];
