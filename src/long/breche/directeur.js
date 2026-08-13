/**
 * Le directeur de difficulté de BRÈCHE — « l'IA qui s'adapte à ton niveau ».
 *
 * La partie est sans fin : il n'y a plus de mondes, plus d'objectif, plus de
 * palier à franchir. Ce qui monte, c'est **ce qu'on te donne**. Un joueur qui
 * enchaîne reçoit des pièces encombrantes ; un joueur qui s'enlise en reçoit
 * de plus maniables, le temps de se refaire.
 *
 * **Il est honnête, et c'est une contrainte, pas une politesse.** Trois règles
 * qu'il ne franchit jamais :
 *
 *   1. il ne donne jamais une main dont aucune pièce n'entre — perdre doit
 *      venir du plateau qu'on a construit, pas du tirage ;
 *   2. il ne regarde pas où tu comptes poser : il pondère un vivier, il ne
 *      choisit pas contre toi ;
 *   3. il ne t'offre pas non plus la pièce qui sauve. Un directeur qui rattrape
 *      les fautes retire au score toute signification, et le score est la seule
 *      chose que ce jeu propose.
 *
 * Autrement dit il déplace la **moyenne** de ce qu'on reçoit, jamais le coup
 * particulier. C'est ce qui permet de garder un classement qui veut dire
 * quelque chose tout en évitant qu'un débutant soit noyé au bout de trente
 * secondes.
 */
import { PIECES } from './donnees.js'

/** Le lissage de l'estimation : lent, pour qu'un coup malheureux ne compte pas. */
const INERTIE = 0.12

/**
 * L'aisance de départ. On commence au milieu plutôt qu'au plus facile : un
 * joueur qui connaît le jeu n'a pas à subir deux minutes de pièces d'une case
 * pour prouver qu'il sait jouer.
 */
export const AISANCE_INITIALE = 0.45

/** L'occupation du plateau, de 0 (vide) à 1 (plein). */
export const occupation = (p) => p.cases.reduce((n, x) => n + (x > 0 ? 1 : 0), 0) / p.cases.length

/**
 * Ce que valait le coup qu'on vient de jouer, de 0 (au bord de la rupture) à
 * 1 (parfaitement à l'aise). Trois signaux, et pas un de plus : un plateau
 * dégagé, des lignes qui partent, et des pièces qui trouvent où aller.
 */
export function lecture(p, lignes, placesRestantes) {
  const place = 1 - occupation(p)
  const nettoie = Math.min(1, lignes / 2)
  const respire = Math.min(1, placesRestantes / 12)
  return Math.max(0, Math.min(1, place * 0.5 + nettoie * 0.25 + respire * 0.25))
}

/** Met à jour l'estimation après un coup. Rend la nouvelle aisance. */
export function apprend(p, lignes, placesRestantes) {
  const vu = lecture(p, lignes, placesRestantes)
  p.aisance = (p.aisance ?? AISANCE_INITIALE) * (1 - INERTIE) + vu * INERTIE
  return p.aisance
}

/**
 * La difficulté visée, de 0 à 1.
 *
 * Elle mêle deux choses volontairement : **l'aisance**, qui répond en quelques
 * coups, et **la durée de la partie**, qui ne redescend jamais. Sans la
 * seconde, un très bon joueur qui se met à jouer petit ferait retomber la
 * difficulté et jouerait indéfiniment ; sans la première, un débutant subirait
 * la même courbe qu'un habitué.
 */
export function difficulte(p) {
  const aisance = p.aisance ?? AISANCE_INITIALE
  // Le plancher monte avec les poses, et il ne redescend pas : à trois cents
  // coups il vaut 0,6, ce qui interdit de revenir aux pièces de débutant.
  const plancher = Math.min(0.6, (p.poses ?? 0) / 500)
  return Math.max(plancher, Math.min(1, aisance))
}

/**
 * Le poids d'une pièce à une difficulté donnée.
 *
 * `poids` reste la fréquence de base — c'est lui qui donne son grain au jeu.
 * La difficulté ne fait que l'incliner vers les grosses pièces ou vers les
 * petites, sans jamais rien exclure : une pièce qui ne sortirait plus du tout
 * serait un contenu perdu.
 */
export function poids(piece, d) {
  // Le nombre de cases, pas l'encombrement : une barre de quatre et un carré
  // de deux sur deux occupent le même rectangle et ne pèsent pas pareil sur un
  // plateau. `encombrement()` rend `{w, h}` — le lire comme `{n}` donnait des
  // poids NaN, et le tirage rendait alors toujours la même pièce.
  const n = piece.cases.length
  // Une pièce d'une case vaut 0, une de cinq ou plus vaut 1.
  const gros = Math.min(1, Math.max(0, (n - 1) / 4))
  // À d = 0 on multiplie les petites par 2,2 et on divise les grosses d'autant ;
  // à d = 1 c'est l'inverse. Au milieu, le vivier est celui d'origine.
  const inclinaison = Math.pow(2.2, (d - 0.5) * 2 * (gros - 0.5) * 2)
  return Math.max(0.02, piece.poids * inclinaison)
}

/** Le vivier pondéré pour la difficulté courante. */
export const vivier = (p) => {
  const d = difficulte(p)
  return PIECES.map((piece) => ({ piece, poids: poids(piece, d) }))
}

/**
 * Un tirage pondéré dans le vivier. `rng` est fourni par l'appelant pour que
 * le tirage reste reproductible depuis la graine de la partie.
 */
export function tire(entrees, rng) {
  const total = entrees.reduce((s, e) => s + e.poids, 0)
  let x = rng() * total
  for (const e of entrees) if ((x -= e.poids) <= 0) return e.piece
  return entrees[entrees.length - 1]?.piece ?? PIECES[0]
}
