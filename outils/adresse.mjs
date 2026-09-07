/**
 * L'adresse du projet Supabase, ramenée à ce qu'ARKAD attend.
 *
 * Le client construit ses appels en collant `/rest/v1/…` ou `/auth/v1/…`
 * derrière `SUPABASE_URL` : il lui faut donc l'**origine nue**, et rien
 * d'autre. Or ce n'est pas ce qu'on a sous la main quand on remplit le
 * secret — la console de Supabase montre partout des exemples en
 * `https://xxx.supabase.co/rest/v1/…`, et c'est cette ligne-là qu'on copie.
 * Le résultat est une adresse doublée (`/rest/v1/rest/v1/…`) et un message
 * d'erreur qui ne dit rien à personne : « Invalid path specified in request
 * URL ».
 *
 * Alors on ne fait pas confiance au presse-papier. `new URL(…).origin` jette
 * tout ce qui suit le domaine, et le `trim()` d'abord règle l'autre grand
 * classique : le retour à la ligne invisible attrapé en fin de copie.
 *
 * Ce n'est pas de la magie qui devine une intention — c'est refuser de
 * garder une partie d'adresse dont on sait qu'elle ne peut être qu'une
 * erreur.
 */
export function origineSeule(brut) {
  const s = String(brut ?? '').trim()
  if (!s) return ''
  try {
    return new URL(s).origin
  } catch {
    // Pas une URL analysable (adresse sans protocole, valeur farfelue) : on
    // la rend telle quelle, débarrassée de ses barres finales. Le build ne
    // doit pas échouer sur un secret mal rempli — la borne se déploiera avec
    // des classements muets, ce qui est déjà dit à l'écran.
    return s.replace(/\/+$/, '')
  }
}
