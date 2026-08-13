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
import { nouvelle, pas, PAS, avancement } from '../src/long/ruee/logique.js'

/** Une décision tous les `GRAIN` pas : quatre pas, soit un soixantième. */
const GRAIN = 4

/** Copie légère : tout sauf la grille, qui ne change jamais. */
const copie = (e) => ({
  ...e,
  orbesPrises: new Set(e.orbesPrises),
})

const cle = (e, n) => `${n}|${Math.round(e.y)}|${Math.round(e.vy / 10)}|${e.mode}|${e.vitesse.toFixed(2)}`

/**
 * Cherche une suite d'appuis qui mène au bout. Rend `{ gagne, avance, appuis,
 * etats }` — `avance` étant le plus loin atteint, ce qui localise le passage
 * fautif quand ça échoue.
 */
export function resout(niveauId, { budget = 400000, depart = 0 } = {}) {
  const racine = nouvelle(niveauId, depart)
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

    // On empile « ne pas appuyer » en dernier pour l'essayer en premier :
    // c'est la décision de loin la plus fréquente, donc celle qui trouve une
    // solution le plus vite.
    for (const appui of [true, false]) {
      const suite = copie(e)
      for (let i = 0; i < GRAIN && !suite.mort && !suite.fini; i++) pas(suite, appui, PAS)
      if (suite.mort) continue
      pile.push({ e: suite, appuis: appuis.concat(appui), n: n + 1 })
    }
  }
  return { gagne: false, avance: mieux, appuis: null, etats }
}

/**
 * La marge d'un niveau : pour chaque décision de la solution trouvée, de
 * combien d'images on peut se tromper sans mourir. C'est ça qui dit si un
 * niveau est jouable — un passage à une image près se franchit au banc et
 * jamais au doigt.
 *
 * Rend la plus petite fenêtre rencontrée, en images de soixantième.
 */
export function marge(niveauId, appuis) {
  if (!appuis) return 0
  let pire = Infinity
  // On ne teste que les changements de décision : décaler un appui au milieu
  // d'un maintien ne change rien, et les tester tous coûterait cent fois plus
  // pour la même réponse.
  for (let i = 1; i < appuis.length; i++) {
    if (appuis[i] === appuis[i - 1]) continue
    let large = 0
    for (const decalage of [-3, -2, -1, 1, 2, 3]) {
      const variante = appuis.slice()
      const j = i + decalage
      if (j < 1 || j >= variante.length) continue
      // On déplace la bascule de `decalage` images.
      for (let k = Math.min(i, j); k < Math.max(i, j); k++) variante[k] = appuis[i]
      if (rejoue(niveauId, variante)) large++
    }
    pire = Math.min(pire, large)
  }
  return pire === Infinity ? 6 : pire
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
