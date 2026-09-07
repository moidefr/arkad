/**
 * Supabase, sans la bibliothèque Supabase.
 *
 * ARKAD n'a pas d'étape de compilation : `build.mjs` recopie `src/`, et c'est
 * tout. Ajouter le SDK officiel voudrait dire ajouter un empaqueteur au
 * projet pour trois requêtes HTTP. Or GoTrue (l'authentification) et
 * PostgREST (les tables) sont deux API REST ordinaires : `fetch` suffit, et
 * ce fichier tient en cent lignes qu'on peut lire en entier.
 *
 * Tout ce qui suit renvoie une promesse et **ne lance jamais** pour une
 * panne réseau : `{ donnees, erreur }`. Une borne hors ligne doit rester
 * jouable, et un classement injoignable est un désagrément, pas un plantage.
 */
import { SUPABASE_URL, SUPABASE_ANON_KEY, enLigne } from './config.js'

/** Le délai au-delà duquel on considère que le serveur ne répondra pas. */
const DELAI = 8000

const entetes = (jeton) => ({
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${jeton ?? SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
})

/**
 * Traduit les messages de GoTrue et de PostgREST en français, et surtout en
 * phrases qui disent quoi faire. « invalid login credentials » sur un écran de
 * borne n'aide personne.
 */
function lisible(message, statut) {
  const m = String(message ?? '').toLowerCase()
  if (m.includes('invalid login')) return 'pseudo ou mot de passe incorrect'
  if (m.includes('already registered') || m.includes('already been registered')) return 'ce pseudo est déjà pris'
  if (m.includes('duplicate key') && m.includes('pseudo')) return 'ce pseudo est déjà pris'
  if (m.includes('password')) return 'mot de passe trop court (6 caractères minimum)'
  if (m.includes('rate limit') || statut === 429) return 'trop d’essais, réessaie dans un instant'
  if (m.includes('profils_pseudo_check')) return 'pseudo : 3 à 16 lettres, chiffres, - ou _'
  if (m.includes('profils_snap_check')) return 'snap : 1 à 32 lettres, chiffres, . - ou _'
  return message || 'le serveur n’a pas répondu'
}

async function appel(chemin, { methode = 'GET', corps, jeton, entetesEnPlus } = {}) {
  if (!enLigne()) return { donnees: null, erreur: 'classements hors ligne' }
  const arret = AbortSignal.timeout ? AbortSignal.timeout(DELAI) : undefined
  try {
    const r = await fetch(`${SUPABASE_URL}${chemin}`, {
      method: methode,
      headers: { ...entetes(jeton), ...entetesEnPlus },
      body: corps === undefined ? undefined : JSON.stringify(corps),
      signal: arret,
    })
    // 204 (rien à dire) et les corps vides sont légitimes : ne pas les
    // traiter comme du JSON cassé.
    const texte = await r.text()
    const donnees = texte ? JSON.parse(texte) : null
    if (!r.ok) {
      const msg = donnees?.error_description ?? donnees?.msg ?? donnees?.message ?? donnees?.error
      return { donnees: null, erreur: lisible(msg, r.status) }
    }
    return { donnees, erreur: null }
  } catch (e) {
    // Coupure, DNS, délai dépassé : le joueur n'a rien fait de mal.
    return { donnees: null, erreur: e?.name === 'TimeoutError' ? 'le serveur met trop de temps' : 'pas de réseau' }
  }
}

// --- Authentification (GoTrue) ----------------------------------------------

export const inscris = (email, motDePasse) =>
  appel('/auth/v1/signup', { methode: 'POST', corps: { email, password: motDePasse } })

export const connecte = (email, motDePasse) =>
  appel('/auth/v1/token?grant_type=password', { methode: 'POST', corps: { email, password: motDePasse } })

export const rafraichis = (jetonRafraichissement) =>
  appel('/auth/v1/token?grant_type=refresh_token', { methode: 'POST', corps: { refresh_token: jetonRafraichissement } })

export const deconnecte = (jeton) => appel('/auth/v1/logout', { methode: 'POST', jeton })

// --- Tables et vues (PostgREST) ---------------------------------------------

/** Un select tout simple : `table('classement_general', 'rang=lte.20', jeton)`. */
export const table = (nom, requete = '', jeton) =>
  appel(`/rest/v1/${nom}${requete ? `?${requete}` : ''}`, { jeton })

export const insere = (nom, ligne, jeton) =>
  appel(`/rest/v1/${nom}`, {
    methode: 'POST',
    corps: ligne,
    jeton,
    entetesEnPlus: { Prefer: 'return=representation' },
  })

export const modifie = (nom, requete, champs, jeton) =>
  appel(`/rest/v1/${nom}?${requete}`, {
    methode: 'PATCH',
    corps: champs,
    jeton,
    entetesEnPlus: { Prefer: 'return=representation' },
  })

/** Une fonction du schéma — ici `poser_score`, le seul chemin d'écriture. */
export const fonction = (nom, arguments_, jeton) =>
  appel(`/rest/v1/rpc/${nom}`, { methode: 'POST', corps: arguments_, jeton })
