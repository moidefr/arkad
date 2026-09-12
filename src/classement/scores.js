/**
 * Les classements : les poser, les lire, et ne jamais faire attendre.
 *
 * Deux règles tiennent tout ce fichier.
 *
 * **On ne bloque jamais une partie.** Poser un score part en arrière-plan et
 * n'attend rien : le joueur voit son écran de fin tout de suite, réseau ou
 * pas. Un score qui n'a pas pu partir est mis de côté (`file d'attente`) et
 * repart à la prochaine occasion — une borne se joue dans le métro.
 *
 * **On garde la dernière image.** Un classement déjà chargé reste affiché
 * pendant qu'on en demande un frais : mieux vaut trois noms d'il y a une
 * minute qu'un écran vide qui tourne.
 */
import * as api from './supabase.js'
import { jeton, connecte, session } from './compte.js'
import { lis, ecris } from '../stockage.js'
import { enLigne } from './config.js'
import { classable } from './coefficients.js'

/** Combien de lignes on demande, et combien on en montre au podium. */
export const PROFONDEUR = 20
export const PODIUM = 3

/** Au-delà, on redemande au serveur plutôt que de servir le cache. */
const FRAICHEUR = 60_000

const CLE_FILE = 'classement.attente'

/** `{ 'general' | id du jeu : { lignes, quand, charge, erreur } }` */
const cache = new Map()

const abonnes = new Set()
export function surChangement(f) {
  abonnes.add(f)
  return () => abonnes.delete(f)
}
const previens = (cle) => abonnes.forEach((f) => f(cle))

/** Ce qu'on a sous la main pour cette clé, frais ou non. */
export function connu(cle) {
  return cache.get(cle) ?? { lignes: [], quand: 0, charge: false, erreur: null }
}

/** Le podium d'un classement, au plus trois lignes. */
export const podium = (cle) => connu(cle).lignes.slice(0, PODIUM)

/** La place du joueur connecté dans ce classement, ou `null`. */
export function maPlace(cle) {
  if (!session.pseudo) return null
  return connu(cle).lignes.find((l) => l.pseudo === session.pseudo) ?? null
}

/**
 * Demande un classement. Rend tout de suite ce qu'on a (éventuellement rien)
 * et rafraîchit derrière ; les écrans se redessinent soixante fois par
 * seconde, ils verront l'arrivée sans qu'on les prévienne autrement que par
 * `surChangement`.
 */
export function demande(cle, { force = false } = {}) {
  const etat = connu(cle)
  if (!enLigne()) return etat
  if (etat.charge) return etat
  if (!force && etat.quand && Date.now() - etat.quand < FRAICHEUR) return etat

  cache.set(cle, { ...etat, charge: true })
  previens(cle)
  charge(cle)
  return connu(cle)
}

async function charge(cle) {
  const requete =
    cle === 'general'
      ? `select=pseudo,points,jeux,rang&order=rang.asc&limit=${PROFONDEUR}`
      : `jeu=eq.${encodeURIComponent(cle)}&select=pseudo,score,points,rang&order=rang.asc&limit=${PROFONDEUR}`
  const vue = cle === 'general' ? 'classement_general' : 'classement_par_jeu'
  const { donnees, erreur } = await api.table(vue, requete, await jeton())
  const avant = connu(cle)
  cache.set(cle, {
    // Une panne ne doit pas effacer ce qui était affiché : on garde les
    // anciennes lignes et on montre l'erreur à côté.
    lignes: erreur ? avant.lignes : (donnees ?? []),
    quand: erreur ? avant.quand : Date.now(),
    charge: false,
    erreur,
  })
  previens(cle)
}

// --- Poser un score ----------------------------------------------------------

/**
 * La file est relue depuis le stockage, mais son **compte** est gardé en
 * mémoire : l'écran de classement l'affiche, donc il le demandait soixante
 * fois par seconde — soixante `localStorage.getItem` et autant de
 * `JSON.parse` par seconde, pour un nombre qui ne change qu'à la fin d'une
 * partie. Sur un téléphone, c'est le genre de détail qui fait tomber des
 * images.
 */
let compte = null

const file = () => {
  try {
    const f = JSON.parse(lis(CLE_FILE, '[]'))
    const liste = Array.isArray(f) ? f : []
    compte = liste.length
    return liste
  } catch {
    compte = 0
    return []
  }
}
const ecrisFile = (f) => {
  const garde = f.slice(-40)
  compte = garde.length
  ecris(CLE_FILE, JSON.stringify(garde))
}

/**
 * Pose un score. Ne rend rien et n'attend rien : c'est appelé depuis l'écran
 * de fin, au moment précis où le joueur regarde ailleurs.
 *
 * Un jeu `sansScore` n'a rien à poser — son nombre à l'écran n'est pas un
 * score mais un état de partie, et le classer n'aurait pas de sens. Les
 * points, eux, ne sont pas calculés ici : `poser_score` s'en charge côté
 * serveur, avec le même barème mais sans croire le navigateur sur parole.
 */
export function pose(def, score) {
  if (!enLigne() || !classable(def)) return
  if (!(score > 0)) return
  const attente = file()
  // Un seul score par jeu en attente : le meilleur. La file est un tampon,
  // pas un journal.
  const existant = attente.find((s) => s.jeu === def.id)
  if (existant) existant.score = Math.max(existant.score, Math.floor(score))
  else attente.push({ jeu: def.id, score: Math.floor(score) })
  ecrisFile(attente)
  videLaFile()
}

let enCours = false

/**
 * Vide la file d'attente. Appelée après chaque partie et à la connexion —
 * les scores posés avant d'avoir un compte partent au moment où il en existe
 * un, ce qui évite de perdre la partie qui a donné envie de s'inscrire.
 *
 * **Ce qui arrive pendant l'envoi reste.** La version d'avant relisait la
 * file une fois, envoyait, puis réécrivait ce qui restait — écrasant au
 * passage tout score posé entre-temps. Une partie finie pendant que la
 * précédente montait encore disparaissait sans un mot, et c'est exactement ce
 * qui arrive quand on enchaîne deux parties courtes sur un réseau lent. On
 * relit donc la file à la fin, et on n'en retire que ce qu'on a vraiment
 * réussi à poser.
 */
export async function videLaFile() {
  if (enCours || !enLigne() || !connecte()) return
  if (file().length === 0) return
  enCours = true
  try {
    await unePassee()
  } finally {
    enCours = false
  }
}

/**
 * Une passée d'envoi. Rend le nombre de scores partis — zéro veut dire qu'il
 * n'y a plus rien à faire pour l'instant.
 */
async function unePassee(profondeur = 0) {
  const attente = file()
  if (attente.length === 0) return 0
  const j = await jeton()
  if (!j) return 0

  /** Ce qu'on a réussi à poser : jeu -> score envoyé. */
  const envoyes = new Map()
  /** Ce qui a buté sur le réseau et doit repartir plus tard. */
  const areprendre = new Set()

  for (const s of attente) {
    const { erreur } = await api.fonction('poser_score', { p_jeu: s.jeu, p_score: s.score }, j)
    // Un refus du serveur (jeu inconnu, score invalide) ne repartira jamais :
    // le garder ferait une file qui grossit sans fin. Une panne réseau, si.
    if (erreur && (erreur.includes('réseau') || erreur.includes('trop de temps'))) areprendre.add(s.jeu)
    else envoyes.set(s.jeu, s.score)
  }

  // On relit : la file a pu grossir pendant que les requêtes montaient.
  const restants = ceQuiReste(file(), envoyes, areprendre)
  ecrisFile(restants)

  if (envoyes.size > 0) {
    // Ce qui vient de partir change les classements : la prochaine demande
    // ne doit pas servir un cache d'avant.
    for (const cle of cache.keys()) cache.set(cle, { ...connu(cle), quand: 0 })
    previens(null)
  }

  // Ce qui est arrivé pendant l'envoi part tout de suite plutôt que d'attendre
  // la prochaine partie. La profondeur borne la reprise : un serveur qui
  // refuse sans être une panne réseau ne doit pas faire tourner une boucle.
  if (restants.length > 0 && envoyes.size > 0 && areprendre.size === 0 && profondeur < 3) {
    return envoyes.size + (await unePassee(profondeur + 1))
  }
  return envoyes.size
}

/**
 * Ce qui doit rester dans la file après une passée d'envoi.
 *
 * Le cœur du problème, et la raison d'être de cette fonction : entre le
 * moment où l'on lit la file et celui où le dernier envoi revient, il se
 * passe des centaines de millisecondes de réseau — largement de quoi finir
 * une partie de plus. L'ancienne version réécrivait la file à partir de
 * l'instantané pris *avant* les envois, et effaçait donc ce qui était arrivé
 * entre-temps : sur un réseau à 350 ms, près d'un score sur deux disparaissait
 * sans un mot.
 *
 * On repart donc de la file **telle qu'elle est maintenant**, et on n'en
 * retire que ce qu'on a vraiment réussi à poser, au score près : un même jeu
 * rejoué mieux pendant l'envoi doit repartir.
 *
 * @param maintenant la file relue après les envois
 * @param envoyes    jeu -> score effectivement accepté par le serveur
 * @param areprendre jeux dont l'envoi a buté sur le réseau
 */
export function ceQuiReste(maintenant, envoyes, areprendre = new Set()) {
  return maintenant.filter((s) => {
    if (areprendre.has(s.jeu)) return true
    const envoye = envoyes.get(s.jeu)
    // Jamais envoyé (arrivé entre-temps), ou battu depuis : il reste.
    return envoye === undefined || s.score > envoye
  })
}

/** Combien de scores attendent le réseau (ou un compte). */
export const enAttente = () => (compte === null ? file().length : compte)
