/**
 * L'automate qui franchit un niveau de RUÉE — ou prouve qu'il ne se franchit
 * pas.
 *
 * Ce n'est pas un joueur : c'est une **recherche**. À intervalles réguliers il
 * essaie les deux seules décisions qui existent dans ce jeu (appuyer, ne pas
 * appuyer) et remonte quand il meurt. Un joueur humain fait la même chose,
 * en beaucoup plus de temps et avec de la mémoire musculaire.
 *
 * La mémoïsation porte sur l'état *quantifié* — position d'avancement,
 * hauteur au pixel, vitesse verticale à dix près, véhicule. Sans elle, un
 * niveau de quinze secondes ouvre deux puissance huit cents branches ; avec
 * elle, quelques dizaines de milliers d'états suffisent, parce que deux
 * trajectoires qui se rejoignent au même endroit et à la même vitesse sont la
 * même trajectoire pour tout ce qui suit.
 *
 * Ce que l'automate ne dit pas : si c'est agréable. Il joue à la fenêtre
 * d'appui près, donc un passage qu'il franchit à une image près est
 * « franchissable » et pourtant injouable. D'où `marge()`, plus bas, qui
 * mesure la largeur de la fenêtre au lieu de son existence.
 */
import { nouvelle, pas, PAS, avancement, caseA, CASE, TAILLE } from '../src/long/ruee/logique.js'
import { RANGEES } from '../src/long/ruee/donnees.js'

/** Une décision tous les `GRAIN` pas : quatre pas, soit un soixantième. */
const GRAIN = 4

/** Copie légère : tout sauf la grille, qui ne change jamais. */
const copie = (e) => ({
  ...e,
  orbesPrises: new Set(e.orbesPrises),
})

/**
 * L'air qu'il reste au-dessus et au-dessous, en pixels. Sert uniquement à
 * classer les branches : la recherche reste exhaustive, elle commence
 * simplement par ce qui ressemble à un vol raisonnable.
 */
function degagement(e) {
  const g = TAILLE / 2
  const cx0 = Math.floor((e.x - g) / CASE)
  const cx1 = Math.floor((e.x + g - 0.001) / CASE)
  let haut = Infinity
  let bas = Infinity
  for (let cx = cx0; cx <= cx1; cx++) {
    for (let cy = 0; cy < RANGEES; cy++) {
      if (caseA(e.grille, cx, cy) !== '#') continue
      const dessus = e.y - g - (cy + 1) * CASE
      const dessous = cy * CASE - (e.y + g)
      if (dessus >= 0) haut = Math.min(haut, dessus)
      if (dessous >= 0) bas = Math.min(bas, dessous)
    }
  }
  return Math.min(haut, bas)
}

const cle = (e, n) => `${n}|${Math.round(e.y)}|${Math.round(e.vy / 10)}|${e.mode}|${e.vitesse.toFixed(2)}`

/**
 * Cherche une suite d'appuis qui mène au bout. Rend `{ gagne, avance, appuis,
 * etats }` — `avance` étant le plus loin atteint, ce qui localise le passage
 * fautif quand ça échoue.
 */
export function resout(niveauId, { budget = 400000, depart = 0, etat = null } = {}) {
  const racine = etat ? copie(etat) : nouvelle(niveauId, depart)
  const vus = new Set()
  let mieux = 0
  let etats = 0

  // Pile explicite plutôt que récursion : un niveau long dépasse la pile
  // d'appels de Node bien avant d'épuiser la recherche.
  const pile = [{ e: racine, appuis: [], n: 0 }]

  while (pile.length) {
    const { e, appuis, n } = pile.pop()
    if (etats++ > budget) return { gagne: false, avance: mieux, appuis: null, etats, epuise: true }

    // On joue GRAIN pas avec la décision courante déjà appliquée par le père.
    if (e.fini) return { gagne: true, avance: 1, appuis, etats }
    if (e.mort) continue

    mieux = Math.max(mieux, avancement(e))
    const k = cle(e, n)
    if (vus.has(k)) continue
    vus.add(k)

    // On explore d'abord la décision qui laisse le plus d'air.
    //
    // Sans ce tri, la recherche rend la première solution venue — et pour un
    // véhicule à contrôle continu, c'est presque toujours une trajectoire qui
    // rase une paroi à quatre pixels. Le niveau paraît alors injouable alors
    // que c'est le chemin choisi qui l'est : un joueur vole au milieu du
    // couloir. On mesurait la prudence du solveur, pas la largeur du passage.
    const enfants = []
    for (const appui of [false, true]) {
      const suite = copie(e)
      for (let i = 0; i < GRAIN && !suite.mort && !suite.fini; i++) pas(suite, appui, PAS)
      if (suite.mort) continue
      enfants.push({ e: suite, appuis: appuis.concat(appui), n: n + 1, air: degagement(suite) })
    }
    // La pile dépile par la fin : le plus dégagé part en dernier.
    enfants.sort((a, b) => a.air - b.air)
    for (const enfant of enfants) pile.push(enfant)
  }
  return { gagne: false, avance: mieux, appuis: null, etats }
}

/**
 * La marge d'un niveau : de combien d'images on peut se tromper à chaque
 * changement de décision **sans que le passage devienne irrattrapable**.
 *
 * Le premier jet demandait autre chose : que la *même* suite d'appuis marche
 * encore après le décalage. C'est la bonne question pour un cube, dont chaque
 * saut est un engagement — mais pas pour l'onde ni le vaisseau, qu'on pilote
 * en continu. Là, décaler un appui d'une image change toute la trajectoire, et
 * la suite d'origine ne peut évidemment plus s'appliquer : la mesure rendait
 * 1 pour des couloirs parfaitement jouables, où un joueur corrige à chaque
 * instant.
 *
 * On mesure donc la **rattrapabilité** : après l'erreur, existe-t-il encore un
 * chemin ? Pour un cube qui saute dans un pic, non — la mesure dit toujours la
 * vérité là où elle la disait déjà. Pour une onde qui dérive d'un degré, oui.
 */
export function marge(niveauId, appuis) {
  if (!appuis) return 0
  let pire = Infinity
  for (let i = 1; i < appuis.length; i++) {
    if (appuis[i] === appuis[i - 1]) continue
    let large = 0
    for (const decalage of [-3, -2, -1, 1, 2, 3]) {
      const j = i + decalage
      if (j < 1 || j >= appuis.length) continue
      const variante = appuis.slice()
      for (let k = Math.min(i, j); k < Math.max(i, j); k++) variante[k] = appuis[i]
      if (rattrapable(niveauId, variante, Math.max(i, j) + 1)) large++
    }
    pire = Math.min(pire, large)
  }
  return pire === Infinity ? 6 : pire
}

/**
 * Rejoue `n` décisions de la variante, puis cherche si le niveau se finit
 * encore depuis l'état obtenu.
 */
function rattrapable(niveauId, appuis, n) {
  const e = nouvelle(niveauId)
  for (let d = 0; d < n; d++) {
    for (let i = 0; i < GRAIN && !e.mort && !e.fini; i++) pas(e, appuis[d], PAS)
    if (e.mort) return false
    if (e.fini) return true
  }
  // Budget serré : on ne cherche pas la meilleure suite, seulement qu'il en
  // existe une. Un passage qui demande une recherche énorme pour être rattrapé
  // n'est de toute façon pas rattrapable au doigt.
  return resout(niveauId, { etat: e, budget: 120000 }).gagne
}

/** Rejoue une suite d'appuis et dit si elle mène au bout. */
export function rejoue(niveauId, appuis, depart = 0) {
  const e = nouvelle(niveauId, depart)
  for (const appui of appuis) {
    for (let i = 0; i < GRAIN && !e.mort && !e.fini; i++) pas(e, appui, PAS)
    if (e.mort) return false
    if (e.fini) return true
  }
  return e.fini
}
