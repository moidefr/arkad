/**
 * Le catalogue, rangé par durée de partie.
 *
 * C'est le seul endroit à toucher pour ajouter un jeu : on l'importe, on le
 * met dans la bonne catégorie, et il apparaît.
 */
import { C } from './palette.js'

import esquive from './court/esquive.js'
import voltige from './court/voltige.js'
import grimpe from './court/grimpe.js'
import slalom from './court/slalom.js'
import fusee from './court/fusee.js'
import casseBrique from './court/casseBrique.js'
import serpent from './court/serpent.js'
import orbite from './court/orbite.js'
import balance from './court/balance.js'
import pile from './court/pile.js'
import corde from './court/corde.js'
import cibles from './court/cibles.js'
import rythme from './court/rythme.js'
import gardien from './court/gardien.js'
import tri from './court/tri.js'
import memoire from './court/memoire.js'
import couleur from './court/couleur.js'
import calcul from './court/calcul.js'
import visee from './court/visee.js'
import geste from './court/geste.js'
import trace from './court/trace.js'
import eclair from './court/eclair.js'
import paires from './court/paires.js'
import dedale from './court/dedale.js'

import demineur from './moyen/demineur.js'
import mille from './moyen/mille.js'
import taquin from './moyen/taquin.js'
import picross from './moyen/picross.js'
import sudoku from './moyen/sudoku.js'
import lumieres from './moyen/lumieres.js'
import code from './moyen/code.js'
import solitaire from './moyen/solitaire.js'
import flux from './moyen/flux.js'

import usine from './long/usine/index.js'
import expedition from './long/expedition/index.js'
import breche from './long/breche/index.js'
import ruee from './long/ruee/index.js'
import colonie from './long/colonie/index.js'
import abyme from './long/abyme/index.js'
import grimoire from './long/grimoire/index.js'
import caravane from './long/caravane/index.js'
import rempart from './long/rempart/index.js'
import vivier from './long/vivier/index.js'

import front from './massif/front.js'

export const CATEGORIES = [
  {
    id: 'court',
    nom: 'COURT',
    duree: '2 à 3 minutes',
    detail: 'une seule touche, on recommence aussitôt',
    couleur: C.cyan,
    // Ces jeux démarrent à pleine vitesse : sans décompte, on perd la
    // première seconde à comprendre où on est.
    decompte: true,
    jeux: [
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
      visee,
      geste,
      trace,
      eclair,
      paires,
      dedale,
    ],
  },
  {
    id: 'moyen',
    nom: 'MOYEN',
    duree: '5 à 15 minutes',
    detail: 'une grille, une solution, on y réfléchit',
    couleur: C.vert,
    jeux: [demineur, mille, taquin, picross, sudoku, lumieres, code, solitaire, flux],
  },
  {
    id: 'long',
    nom: 'LONG',
    duree: '20 minutes à 10 heures',
    detail: 'ça continue quand on ferme',
    couleur: C.violet,
    jeux: [usine, expedition, breche, ruee, colonie, abyme, grimoire, caravane, rempart, vivier],
  },
  {
    id: 'massif',
    nom: 'MASSIF',
    duree: 'sans fin',
    detail: 'une compagnie qu’on garde, des batailles qui grandissent',
    couleur: C.accent,
    jeux: [front],
  },
]

export const TOUS = CATEGORIES.flatMap((c) => c.jeux)
