/**
 * Le catalogue de la borne : un jeu principal, et des mini-jeux autour.
 *
 * Ajouter un mini-jeu = créer un fichier à côté et l'ajouter à MINIS.
 * Rien d'autre à toucher dans le moteur.
 *
 * L'ordre compte : c'est celui de la grille de l'accueil. Les jeux d'adresse
 * d'abord, les jeux de réflexe ensuite, les jeux de tête à la fin.
 */
import aventure from '../aventure/index.js'
import esquive from './esquive.js'
import voltige from './voltige.js'
import grimpe from './grimpe.js'
import slalom from './slalom.js'
import fusee from './fusee.js'
import casseBrique from './casseBrique.js'
import serpent from './serpent.js'
import orbite from './orbite.js'
import balance from './balance.js'
import pile from './pile.js'
import corde from './corde.js'
import cibles from './cibles.js'
import rythme from './rythme.js'
import gardien from './gardien.js'
import tri from './tri.js'
import memoire from './memoire.js'
import couleur from './couleur.js'
import calcul from './calcul.js'

export const PRINCIPAL = aventure

export const MINIS = [
  esquive,
  voltige,
  grimpe,
  slalom,
  fusee,
  casseBrique,
  serpent,
  orbite,
  balance,
  pile,
  corde,
  cibles,
  rythme,
  gardien,
  tri,
  memoire,
  couleur,
  calcul,
]

export const TOUS = [PRINCIPAL, ...MINIS]
