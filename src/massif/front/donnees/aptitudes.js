/**
 * Les aptitudes — passives et ordres.
 *
 * Règle d'admission, tenue sans exception : **une aptitude est de la donnée**.
 * Une passive porte une clé `passif` prise dans `PASSIFS`, lue à un seul
 * endroit des règles ; un ordre porte un sac d'effets pris dans `EFFETS`,
 * appliqués par un unique interpréteur de soixante lignes.
 *
 * C'est la leçon du jeu précédent, où les fardeaux étaient inertes parce que
 * leur application testait des identifiants écrits à la main : ici, un test
 * refuse toute aptitude dont la clé n'est pas réellement consommée par le
 * moteur, et toute aptitude qui ne change rien quand on l'applique.
 */

/** Les passives que les règles savent lire. Le test compare cette liste au code. */
export const PASSIFS = [
  'charge', // + dégâts par hexagone parcouru avant de frapper
  'embuscade', // + dégâts depuis un terrain furtif ou sur une cible qui n'a pas agi
  'tirailleur', // peut se déplacer après avoir tiré
  'riposteFerme', // riposte à pleins dégâts
  'sansRiposte', // la cible ne riposte pas
  'perce', // annule une part du couvert
  'bouclier', // − dégâts encaissés au tir
  'cuirasse', // − dégâts encaissés au contact
  'montagnard', // tout hexagone coûte au plus 1
  'pontonnier', // rivières et gués coûtent 1
  'marcheur', // + points de mouvement
  'guetteur', // + portée de vue
  'precision', // + portée de tir
  'volee', // éclabousse les voisins de la cible
  'zoneControle', // un ennemi qui entre à côté doit s'arrêter
  'insaisissable', // ignore les zones de contrôle
  'soigneur', // rend des points de vie à un voisin en fin de tour
  'commandement', // aura de commandement, en plus de celle du grade
  'tenace', // survit une fois au coup fatal, à 1 point de vie
  'discipline', // encaisse moins de perte de moral
  'fanatique', // + dégâts sous 40 % de vie
  'vengeance', // + dégâts contre qui l'a blessé au tour précédent
  'sniper', // + dégâts à portée maximale
  'traqueur', // + dégâts contre un type donné
  'aguerri', // + expérience gagnée
  'inspire', // + moral de départ pour l'escouade
]

/** Les effets qu'un ordre peut porter. Même règle : consommés, ou refusés. */
export const EFFETS = [
  'mvt',
  'etat',
  'duree',
  'soin',
  'moral',
  'degats',
  'perce',
  'sansRiposte',
  'rayon',
  'cible',
  'fumee',
  'terrain',
  'finTour',
  'piege',
  'rejoue',
]

const p = (id, nom, court, passif, valeur, texte, extra = {}) => ({ id, nom, court, passif, valeur, texte, ...extra })
const o = (id, nom, court, ordre, texte) => ({ id, nom, court, ordre, texte })

export const APTITUDES = [
  // --- Passives -------------------------------------------------------------
  p('charge', 'CHARGE', 'CHG', 'charge', 0.14, '+14 % de dégâts par hexagone parcouru avant le choc, jusqu’à 4.'),
  p('charge_lourde', 'CHARGE LOURDE', 'CHL', 'charge', 0.2, '+20 % de dégâts par hexagone parcouru, jusqu’à 4.'),
  p('embuscade', 'EMBUSCADE', 'EMB', 'embuscade', 0.3, '+30 % de dégâts depuis un couvert dense.'),
  p('embuscade_maitre', 'MAÎTRE DE L’OMBRE', 'OMB', 'embuscade', 0.5, '+50 % de dégâts depuis un couvert dense.'),
  p('tirailleur', 'TIRAILLEUR', 'TIL', 'tirailleur', 1, 'Peut se déplacer après avoir tiré.'),
  p('riposte_ferme', 'RIPOSTE FERME', 'RIP', 'riposteFerme', 1, 'Riposte à pleins dégâts au lieu de la moitié.'),
  p('brise_ligne', 'BRISE-LIGNE', 'BRL', 'sansRiposte', 1, 'La cible ne riposte pas.'),
  p('perce_armure', 'PERCE-ARMURE', 'PRC', 'perce', 0.5, 'Annule la moitié du couvert de la cible.'),
  p('perce_total', 'OBUS PERFORANT', 'OBU', 'perce', 1, 'Annule tout le couvert de la cible.'),
  p('bouclier', 'PAVOIS', 'PAV', 'bouclier', 0.25, '−25 % de dégâts subis au tir.'),
  p('cuirasse', 'CUIRASSE', 'CUI', 'cuirasse', 0.2, '−20 % de dégâts subis au contact.'),
  p('montagnard', 'MONTAGNARD', 'MTG', 'montagnard', 1, 'Aucun hexagone ne coûte plus d’un point de mouvement.'),
  p('pontonnier', 'PONTONNIER', 'PON', 'pontonnier', 1, 'Rivières et gués coûtent 1 point de mouvement.'),
  p('marcheur', 'MARCHEUR', 'MAR', 'marcheur', 1, '+1 point de mouvement.'),
  p('grand_marcheur', 'GRAND MARCHEUR', 'GMA', 'marcheur', 2, '+2 points de mouvement.'),
  p('guetteur', 'GUETTEUR', 'GUE', 'guetteur', 2, '+2 de portée de vue.'),
  p('precision', 'PRÉCISION', 'PRE', 'precision', 1, '+1 de portée de tir.'),
  p('volee', 'VOLÉE', 'VOL', 'volee', 0.4, 'Les voisins de la cible subissent 40 % des dégâts.'),
  p('volee_lourde', 'TIR FRACASSANT', 'TFR', 'volee', 0.6, 'Les voisins de la cible subissent 60 % des dégâts.'),
  p('zone_controle', 'TENIR LE PAS', 'ZDC', 'zoneControle', 1, 'Un ennemi qui entre à côté doit s’arrêter.'),
  p('insaisissable', 'INSAISISSABLE', 'INS', 'insaisissable', 1, 'Ignore les zones de contrôle adverses.'),
  p('soigneur', 'SOIGNEUR', 'SOI', 'soigneur', 7, 'Rend 7 points de vie à un voisin blessé en fin de tour.'),
  p('soigneur_chef', 'CHIRURGIEN', 'CHI', 'soigneur', 13, 'Rend 13 points de vie à un voisin blessé en fin de tour.'),
  p('commandement', 'COMMANDEMENT', 'CMD', 'commandement', 1, 'Étend l’aura de commandement d’un hexagone.'),
  p(
    'commandement_large',
    'VOIX QUI PORTE',
    'VOI',
    'commandement',
    2,
    'Étend l’aura de commandement de deux hexagones.',
  ),
  p('tenace', 'TENACE', 'TEN', 'tenace', 1, 'Survit une fois par bataille au coup fatal, à 1 point de vie.'),
  p('discipline', 'DISCIPLINE', 'DIS', 'discipline', 0.5, 'Ne perd que la moitié du moral.'),
  p('fanatique', 'FUREUR', 'FUR', 'fanatique', 0.35, '+35 % de dégâts sous 40 % de vie.'),
  p('vengeance', 'VENGEANCE', 'VEN', 'vengeance', 0.3, '+30 % de dégâts contre qui l’a blessé au tour précédent.'),
  p('sniper', 'TIREUR D’ÉLITE', 'SNI', 'sniper', 0.3, '+30 % de dégâts à portée maximale.'),
  p('traque_monte', 'TUEUR DE CHEVAUX', 'TCH', 'traqueur', 0.35, '+35 % de dégâts contre les montés.', {
    contre: 'MON',
  }),
  p('traque_lourd', 'BRISEUR DE MURS', 'TBM', 'traqueur', 0.35, '+35 % de dégâts contre l’infanterie.', {
    contre: 'INF',
  }),
  p('traque_engin', 'CONTRE-BATTERIE', 'TCB', 'traqueur', 0.45, '+45 % de dégâts contre les engins.', {
    contre: 'ENG',
  }),
  p('traque_tir', 'CHASSEUR D’ARCHERS', 'TCA', 'traqueur', 0.35, '+35 % de dégâts contre les tireurs.', {
    contre: 'TIR',
  }),
  p('aguerri', 'VIEUX BRISQUARD', 'VBR', 'aguerri', 0.4, '+40 % d’expérience gagnée.'),
  p('inspire', 'INSPIRE', 'INP', 'inspire', 15, '+15 de moral de départ pour toute l’escouade.'),

  // --- Ordres ---------------------------------------------------------------
  o(
    'sprint',
    'SPRINT',
    'SPR',
    { forme: 'soi', froid: 3, effets: { mvt: 3, finTour: false } },
    '+3 points de mouvement immédiatement.',
  ),
  o(
    'retranchement',
    'SE RETRANCHER',
    'RET',
    { forme: 'soi', froid: 3, effets: { etat: { couvert: 0.3, def: 0.15 }, duree: 2, finTour: true } },
    '+30 % de couvert et +15 % de défense pendant deux tours. Termine le tour.',
  ),
  o(
    'soin',
    'PANSER',
    'PAN',
    { forme: 'allie', portee: [1, 1], froid: 2, effets: { soin: 24, finTour: true } },
    'Rend 24 points de vie à un voisin. Termine le tour.',
  ),
  o(
    'ralliement',
    'RALLIEMENT',
    'RAL',
    { forme: 'soi', rayon: 2, froid: 4, effets: { moral: 30, cible: 'allies', rayon: 2, finTour: true } },
    '+30 de moral à tous les alliés à deux hexagones. Termine le tour.',
  ),
  o(
    'cri_guerre',
    'CRI DE GUERRE',
    'CRI',
    { forme: 'soi', rayon: 2, froid: 4, effets: { moral: -22, cible: 'ennemis', rayon: 2, finTour: true } },
    '−22 de moral à tous les ennemis à deux hexagones. Termine le tour.',
  ),
  o(
    'grenade',
    'GRENADE',
    'GRE',
    {
      forme: 'hex',
      portee: [1, 2],
      froid: 3,
      effets: { degats: 0.8, rayon: 1, perce: true, sansRiposte: true, finTour: true },
    },
    'Explose sur un hexagone et ses voisins, sans tenir compte du couvert.',
  ),
  o(
    'barrage',
    'TIR DE BARRAGE',
    'BAR',
    { forme: 'hex', portee: [2, 6], froid: 4, effets: { degats: 0.7, rayon: 1, sansRiposte: true, finTour: true } },
    'Pilonne un hexagone et ses voisins depuis l’arrière.',
  ),
  o(
    'fumigene',
    'FUMIGÈNE',
    'FUM',
    { forme: 'hex', portee: [1, 3], froid: 4, effets: { fumee: 1, duree: 2, finTour: true } },
    'Aveugle un hexagone et ses voisins pendant deux tours.',
  ),
  o(
    'tir_precis',
    'TIR PRÉCIS',
    'TPR',
    {
      forme: 'ennemi',
      portee: [1, 9],
      froid: 3,
      effets: { degats: 1.15, perce: true, sansRiposte: true, finTour: true },
    },
    'Un tir qui ignore tout couvert et n’appelle pas de riposte.',
  ),
  o(
    'ponton',
    'JETER UN PONT',
    'PNT',
    { forme: 'hex', portee: [1, 1], froid: 5, effets: { terrain: 'pont', finTour: true } },
    'Transforme une rivière voisine en pont.',
  ),
  o(
    'mine',
    'POSER UNE MINE',
    'MIN',
    { forme: 'hex', portee: [1, 1], froid: 4, effets: { piege: 26, finTour: true } },
    'Piège un hexagone voisin : 26 dégâts à qui y entre.',
  ),
  o(
    'ordre_marche',
    'ORDRE DE MARCHE',
    'ODM',
    { forme: 'soi', froid: 5, effets: { etat: { mvt: 2 }, duree: 1, cible: 'allies', rayon: 9, finTour: true } },
    'Toute la compagnie gagne 2 points de mouvement ce tour-ci.',
  ),
  o(
    'tenir_ligne',
    'TENIR LA LIGNE',
    'TLI',
    {
      forme: 'soi',
      froid: 5,
      effets: { etat: { couvert: 0.2, def: 0.1 }, duree: 2, cible: 'allies', rayon: 3, finTour: true },
    },
    'Les alliés proches gagnent 20 % de couvert pendant deux tours.',
  ),
  o(
    'assaut_general',
    'ASSAUT GÉNÉRAL',
    'ASG',
    { forme: 'soi', froid: 6, effets: { etat: { att: 0.28 }, duree: 1, cible: 'allies', rayon: 9, finTour: true } },
    '+28 % de dégâts pour toute la compagnie ce tour-ci.',
  ),
  o(
    'second_souffle',
    'SECOND SOUFFLE',
    'SSO',
    { forme: 'soi', froid: 6, effets: { rejoue: true, soin: 16 } },
    'Rend 16 points de vie et rend son action : on rejoue immédiatement.',
  ),
]

export const APT = Object.fromEntries(APTITUDES.map((a) => [a.id, a]))
