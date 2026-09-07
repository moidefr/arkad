/**
 * Traduit une URL en état de la borne, et inversement.
 *
 * Le seul endroit à connaître les deux sens du chemin : `depuisChemin` pour
 * atterrir directement sur une catégorie ou un jeu, `cheminDe` pour que
 * chaque appui du joueur laisse une adresse qu'on peut partager ou
 * retrouver. Ni l'un ni l'autre ne touche au DOM — testable sous
 * `node --test`, sans simulacre.
 */
import { CATEGORIES } from './catalogue.js'

/**
 * Le classement n'est pas une catégorie : il n'a pas de jeux, et il ne doit
 * pas apparaître sur l'accueil comme une cinquième carte. Il a en revanche
 * besoin d'une adresse à lui — c'est un écran qu'on partage.
 */
export const CHEMIN_CLASSEMENT = '/classement/'

/**
 * Un chemin d'URL ('/', '/court/', '/court/corde/', …) -> { cat, def }, ou
 * `null` si le premier segment ne correspond à aucune catégorie connue (lien
 * mort, vieux favori) — l'appelant retombe alors sur l'accueil.
 *
 * Un deuxième segment qui ne correspond à aucun jeu de la catégorie est
 * ignoré plutôt que rejeté : `def` retombe à `null` et l'appelant atterrit
 * sur l'écran de la catégorie, pas sur l'accueil — c'est le mieux qu'on
 * puisse faire d'un lien à moitié valide.
 */
export function depuisChemin(chemin) {
  const parts = chemin.split('/').filter(Boolean)
  if (parts.length === 0) return { cat: null, def: null }
  // `/classement/`, et `/classement/<jeu>/` pour pointer un classement
  // précis. Le jeu est cherché dans tout le catalogue : une adresse de
  // classement n'a pas à répéter la catégorie.
  if (parts[0] === 'classement') {
    const def = parts[1] ? (CATEGORIES.flatMap((c) => c.jeux).find((j) => j.id === parts[1]) ?? null) : null
    return { cat: null, def: null, classement: true, jeu: def }
  }
  const cat = CATEGORIES.find((c) => c.id === parts[0])
  if (!cat) return null
  const def = parts[1] ? (cat.jeux.find((j) => j.id === parts[1]) ?? null) : null
  return { cat, def }
}

/** L'inverse : { cat, def } -> chemin canonique, toujours terminé par « / ». */
export function cheminDe(cat, def) {
  if (!cat) return '/'
  return def ? `/${cat.id}/${def.id}/` : `/${cat.id}/`
}

/** Et celui du classement, général ou centré sur un jeu. */
export const cheminClassement = (jeu) => (jeu ? `${CHEMIN_CLASSEMENT}${jeu.id}/` : CHEMIN_CLASSEMENT)
