/**
 * Le compte du joueur : s'inscrire, se connecter, rester connecté.
 *
 * **Un pseudo, pas une adresse.** On ne demande pas de courriel : personne ne
 * tape une adresse au pouce sur une borne, et ARKAD n'a rien à envoyer à
 * personne. Supabase, lui, veut un identifiant en forme d'adresse — alors on
 * lui en fabrique un à partir du pseudo (`greg` → `greg@joueurs.arkad.fr`).
 * Ce domaine n'existe pas et ne recevra jamais rien ; c'est un identifiant
 * interne, pas un moyen de contact. Le pseudo affiché, lui, vit dans la table
 * `profils`, avec sa contrainte d'unicité — deux joueurs ne peuvent pas
 * s'appeler pareil.
 *
 * **La contrepartie, et elle est réelle** : sans adresse, un mot de passe
 * perdu est perdu. L'écran d'inscription le dit, plutôt que de laisser la
 * découverte au premier oubli.
 */
import * as api from './supabase.js'
import { lis, ecris } from '../stockage.js'
import { enLigne } from './config.js'

/** Le domaine d'identifiants internes. Il ne reçoit pas de courrier. */
const DOMAINE = 'joueurs.arkad.fr'

const CLE_SESSION = 'compte.session'

export const PSEUDO_VALIDE = /^[A-Za-z0-9_-]{3,16}$/
export const SNAP_VALIDE = /^[A-Za-z0-9._-]{1,32}$/

/** Le pseudo tel qu'on le stocke et l'affiche : sans espaces autour. */
export const nettoie = (s) => String(s ?? '').trim()

/** Le tour de passe-passe du pseudo → identifiant Supabase. */
export const identifiantDe = (pseudo) => `${nettoie(pseudo).toLowerCase()}@${DOMAINE}`

/**
 * Ce qu'on sait du joueur en ce moment. `pseudo` est `null` quand personne
 * n'est connecté — c'est le seul test à faire ailleurs dans le code.
 */
export const session = {
  pseudo: null,
  snap: null,
  id: null,
  jeton: null,
  rafraichissement: null,
  expire: 0,
}

/** Prévenus à chaque connexion, déconnexion ou inscription. */
const abonnes = new Set()
export function surChangement(f) {
  abonnes.add(f)
  return () => abonnes.delete(f)
}
const previens = () => abonnes.forEach((f) => f(session))

export const connecte = () => Boolean(session.pseudo && session.jeton)

function pose(donnees, profil) {
  session.jeton = donnees?.access_token ?? null
  session.rafraichissement = donnees?.refresh_token ?? null
  // `expires_in` est en secondes ; on retire une minute pour ne pas courir
  // après le jeton à la seconde près.
  session.expire = Date.now() + Math.max(0, ((donnees?.expires_in ?? 3600) - 60) * 1000)
  session.id = donnees?.user?.id ?? session.id
  if (profil) {
    session.pseudo = profil.pseudo
    session.snap = profil.snap ?? null
  }
  enregistre()
}

/** Grave la session sur l'appareil et prévient les écrans. */
function enregistre() {
  ecris(
    CLE_SESSION,
    JSON.stringify({
      jeton: session.jeton,
      rafraichissement: session.rafraichissement,
      expire: session.expire,
      id: session.id,
      pseudo: session.pseudo,
      snap: session.snap,
    }),
  )
  previens()
}

export function oublie() {
  const jeton = session.jeton
  Object.assign(session, { pseudo: null, snap: null, id: null, jeton: null, rafraichissement: null, expire: 0 })
  ecris(CLE_SESSION, 'null')
  previens()
  // On prévient le serveur sans l'attendre : localement, c'est déjà fait.
  if (jeton) api.deconnecte(jeton)
}

/**
 * Un jeton valide, ou `null`. Le rafraîchissement est transparent : le reste
 * du code demande un jeton et n'a jamais à savoir qu'il en existe deux.
 */
export async function jeton() {
  if (!session.jeton) return null
  if (Date.now() < session.expire) return session.jeton
  if (!session.rafraichissement) return null
  const { donnees, erreur } = await api.rafraichis(session.rafraichissement)
  if (erreur || !donnees?.access_token) {
    // Un jeton de rafraîchissement refusé ne revient pas : mieux vaut
    // redemander une connexion que réessayer en boucle.
    if (!erreur?.includes('réseau')) oublie()
    return null
  }
  pose(donnees)
  return session.jeton
}

/** Relit la session laissée par la dernière visite. À appeler au démarrage. */
export function reprends() {
  if (!enLigne()) return
  try {
    const s = JSON.parse(lis(CLE_SESSION, 'null'))
    if (!s?.jeton) return
    Object.assign(session, s)
    previens()
  } catch {
    /* session illisible : on repart déconnecté, sans bruit */
  }
}

// --- Les trois gestes --------------------------------------------------------

/**
 * Inscription. Le Snap est facultatif — et il l'est vraiment : il n'est publié
 * nulle part, aucun classement ne l'affiche. C'est un champ **espéré par Greg
 * Boulard**, laissé là pour qui veut se retrouver hors de la borne.
 */
export async function inscris({ pseudo, motDePasse, snap }) {
  const nom = nettoie(pseudo)
  const snapNet = nettoie(snap) || null
  if (!PSEUDO_VALIDE.test(nom)) return { erreur: 'pseudo : 3 à 16 lettres, chiffres, - ou _' }
  if (String(motDePasse ?? '').length < 6) return { erreur: 'mot de passe : 6 caractères minimum' }
  if (snapNet && !SNAP_VALIDE.test(snapNet)) return { erreur: 'snap : 1 à 32 lettres, chiffres, . - ou _' }

  const { donnees, erreur } = await api.inscris(identifiantDe(nom), motDePasse)
  if (erreur) return { erreur }
  // Supabase renvoie l'utilisateur mais pas toujours de session (selon la
  // configuration du projet) : dans ce cas on se connecte dans la foulée,
  // sinon on n'aurait pas le jeton qu'exige la création du profil.
  let s = donnees
  if (!s?.access_token) {
    const suite = await api.connecte(identifiantDe(nom), motDePasse)
    if (suite.erreur) return { erreur: `compte créé, mais connexion refusée (${suite.erreur})` }
    s = suite.donnees
  }
  pose(s)

  const profil = { id: s.user?.id ?? session.id, pseudo: nom, snap: snapNet }
  const pose_ = await api.insere('profils', profil, session.jeton)
  if (pose_.erreur) {
    // Le compte existe mais n'a pas de pseudo : inutilisable, et il
    // occuperait l'identifiant. On repart de zéro plutôt que de laisser un
    // demi-compte derrière soi.
    oublie()
    return { erreur: pose_.erreur }
  }
  pose(s, pose_.donnees?.[0] ?? profil)
  return { erreur: null, session }
}

export async function connexion({ pseudo, motDePasse }) {
  const nom = nettoie(pseudo)
  if (!nom) return { erreur: 'il faut un pseudo' }
  const { donnees, erreur } = await api.connecte(identifiantDe(nom), motDePasse)
  if (erreur) return { erreur }
  pose(donnees)
  const profil = await api.table('profils', `id=eq.${donnees.user?.id}&select=pseudo,snap`, donnees.access_token)
  if (profil.erreur || !profil.donnees?.[0]) {
    oublie()
    return { erreur: profil.erreur ?? 'ce compte n’a pas de profil' }
  }
  pose(donnees, profil.donnees[0])
  return { erreur: null, session }
}

/** Change (ou retire) le Snap, sans toucher au reste. */
export async function changeSnap(snap) {
  const snapNet = nettoie(snap) || null
  if (snapNet && !SNAP_VALIDE.test(snapNet)) return { erreur: 'snap : 1 à 32 lettres, chiffres, . - ou _' }
  const j = await jeton()
  if (!j) return { erreur: 'il faut être connecté' }
  const { erreur } = await api.modifie('profils', `id=eq.${session.id}`, { snap: snapNet }, j)
  if (erreur) return { erreur }
  session.snap = snapNet
  enregistre()
  return { erreur: null }
}
