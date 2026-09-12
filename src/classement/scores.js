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
 */
export async function videLaFile() {
  if (enCours || !enLigne() || !connecte()) return
  const attente = file()
  if (attente.length === 0) return
  enCours = true
  try {
    const j = await jeton()
    if (!j) return
    const restants = []
    for (const s of attente) {
      const { erreur } = await api.fonction('poser_score', { p_jeu: s.jeu, p_score: s.score }, j)
      // Un refus du serveur (jeu inconnu, score invalide) ne repartira jamais :
      // le garder ferait une file qui grossit sans fin. Une panne réseau, si.
      if (erreur && (erreur.includes('réseau') || erreur.includes('trop de temps'))) restants.push(s)
    }
    ecrisFile(restants)
    if (restants.length < attente.length) {
      // Ce qui vient de partir change les classements : la prochaine demande
      // ne doit pas servir un cache d'avant.
      for (const cle of cache.keys()) cache.set(cle, { ...connu(cle), quand: 0 })
      previens(null)
    }
  } finally {
    enCours = false
  }
}

/** Combien de scores attendent le réseau (ou un compte). */
export const enAttente = () => (compte === null ? file().length : compte)
