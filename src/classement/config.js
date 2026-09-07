/**
 * L'adresse du dos de la borne.
 *
 * Ces deux valeurs ne sont pas des secrets : la clé « anon » de Supabase est
 * faite pour vivre dans une page publique, c'est le RLS du schéma qui protège
 * les données, pas le silence sur la clé. Elles restent malgré tout hors du
 * dépôt : `build.mjs` réécrit ce fichier dans `www/` à partir des variables
 * d'environnement SUPABASE_URL et SUPABASE_ANON_KEY, pour qu'un fork parte
 * sur son propre projet sans toucher au code.
 *
 * Vides, tout continue de marcher : la borne reste jouable, les records
 * restent locaux, et les écrans de classement disent qu'ils sont hors ligne
 * au lieu de tourner dans le vide.
 */
export const SUPABASE_URL = ''
export const SUPABASE_ANON_KEY = ''

/** Vrai si la borne sait où poser ses scores. */
export const enLigne = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
