/**
 * Le catalogue de la borne : un jeu principal, et des mini-jeux autour.
 *
 * Ajouter un mini-jeu = créer un fichier à côté et l'ajouter à MINIS.
 * Rien d'autre à toucher dans le moteur.
 *
 * L'ordre compte : c'est celui de la grille de l'accueil. Les jeux les plus
 * immédiats en premier, les plus cérébraux à la fin.
 */
import aventure from '../aventure/index.js'
import esquive from './esquive.js'
import casseBrique from './casseBrique.js'
import serpent from './serpent.js'
import cibles from './cibles.js'
import voltige from './voltige.js'
import grimpe from './grimpe.js'
import pile from './pile.js'
import orbite from './orbite.js'
import rythme from './rythme.js'
import tri from './tri.js'
import memoire from './memoire.js'
import calcul from './calcul.js'

export const PRINCIPAL = aventure

export const MINIS = [
  esquive,
  voltige,
  grimpe,
  casseBrique,
  serpent,
  orbite,
  pile,
  cibles,
  rythme,
  tri,
  memoire,
  calcul,
]

export const TOUS = [PRINCIPAL, ...MINIS]
