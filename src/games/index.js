/**
 * Le catalogue de la borne : un jeu principal, et des mini-jeux autour.
 *
 * Ajouter un mini-jeu = créer un fichier à côté et l'ajouter à MINIS.
 * Rien d'autre à toucher dans le moteur.
 */
import aventure from '../aventure/index.js'
import esquive from './esquive.js'
import casseBrique from './casseBrique.js'
import serpent from './serpent.js'
import cibles from './cibles.js'

export const PRINCIPAL = aventure
export const MINIS = [esquive, casseBrique, serpent, cibles]
export const TOUS = [PRINCIPAL, ...MINIS]
