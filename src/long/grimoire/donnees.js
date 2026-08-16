import { C } from '../../palette.js'

/**
 * Les tables de GRIMOIRE : les cartes, les adversaires, les constantes de
 * combat. Rien ici ne résout un tour ni ne tire un dé — c'est `logique.js`
 * qui décide, avec un hasard qui vient toujours du moteur.
 *
 * Une carte porte des champs optionnels que `logique.js` interprète un par
 * un : `degats` (multiplié par `fois` pour un coup multiple), `bloc`, `soin`,
 * `recul` (dégâts à soi), `pioche`, `energieBonus`, `force`/`fragile` (statut
 * posé sur le joueur), `vulnerable`/`faible`/`poison` (statut posé sur
 * l'adversaire), `comboParCarte` (bonus qui grandit avec le nombre de cartes
 * déjà jouées ce tour) et `finisseur`/`finisseurBonus` (bonus si l'adversaire
 * est sous 30 % de ses points de vie). `defausseMain` défausse le reste de la
 * main après avoir joué la carte — le prix d'un très gros bloc.
 *
 * `debloqueA` est le nombre de victoires **à vie** (toutes parties confondues)
 * qu'il faut avoir accumulé pour que la carte apparaisse en récompense :
 * c'est la seule méta-progression du jeu, légère et irréversible.
 */

export const VERSION = 1

export const ENERGIE_BASE = 3
export const MAIN_TAILLE = 5
export const PV_DEPART = 60
export const SOIN_VICTOIRE = 8 // ce que le repos après un combat rend, jamais plus

export const COULEUR_TYPE = { attaque: C.rouge, defense: C.cyan, effet: C.violet }

// --- Le deck de départ : minimal, sans surprise --------------------------------

export const STARTERS = [
  { id: 'coup', nom: 'COUP', type: 'attaque', cout: 1, degats: 6 },
  { id: 'garde', nom: 'GARDE', type: 'defense', cout: 1, bloc: 5 },
  { id: 'elan', nom: 'ÉLAN', type: 'effet', cout: 0, pioche: 1 },
]

export const DEPART = ['coup', 'coup', 'coup', 'coup', 'garde', 'garde', 'garde', 'garde', 'elan', 'elan']

// --- Le pool à débloquer : 34 cartes, cinq paliers de victoires-à-vie ----------
//
// Chaque famille (attaque/défense/effet) porte ses propres synergies — la
// force s'empile pour toute la durée d'un combat, le poison ronge à chaque
// tour adverse, `comboParCarte` récompense un tour chargé de cartes bon
// marché plutôt qu'une seule grosse carte. Quelques cartes à gros chiffre
// portent un vrai revers (`recul`, `fragile`) : sans lui, « toujours la carte
// qui tape le plus fort » serait un choix strictement dominant.
export const POOL = [
  // Palier 0 — toujours proposables, dès la première partie.
  { id: 'taillade', nom: 'TAILLADE', type: 'attaque', cout: 1, degats: 9, debloqueA: 0 },
  { id: 'pointe_empoisonnee', nom: 'POINTE EMPOISONNÉE', type: 'attaque', cout: 1, degats: 4, poison: 3, debloqueA: 0 },
  { id: 'marque_lame', nom: 'MARQUE', type: 'attaque', cout: 1, degats: 3, vulnerable: 2, debloqueA: 0 },
  { id: 'estoc', nom: 'ESTOC', type: 'attaque', cout: 2, degats: 16, debloqueA: 0 },
  { id: 'bouclier', nom: 'BOUCLIER', type: 'defense', cout: 1, bloc: 8, debloqueA: 0 },
  { id: 'parade_eclair', nom: 'PARADE ÉCLAIR', type: 'defense', cout: 0, bloc: 3, debloqueA: 0 },
  { id: 'mur', nom: 'MUR', type: 'defense', cout: 2, bloc: 16, debloqueA: 0 },
  { id: 'soins_legers', nom: 'SOINS LÉGERS', type: 'defense', cout: 1, bloc: 4, soin: 4, debloqueA: 0 },
  { id: 'pioche_rapide', nom: 'PIOCHE RAPIDE', type: 'effet', cout: 0, pioche: 2, debloqueA: 0 },
  { id: 'surge', nom: 'SURGE', type: 'effet', cout: 0, energieBonus: 1, debloqueA: 0 },
  { id: 'affaiblissement', nom: 'AFFAIBLISSEMENT', type: 'effet', cout: 1, faible: 2, debloqueA: 0 },
  { id: 'marque_vulnerable', nom: 'MARQUE VULNÉRABLE', type: 'effet', cout: 1, vulnerable: 2, debloqueA: 0 },
  { id: 'entrainement', nom: 'ENTRAÎNEMENT', type: 'effet', cout: 1, force: 2, debloqueA: 0 },

  // Palier 1 — dès dix-huit victoires cumulées.
  { id: 'rafale', nom: 'RAFALE', type: 'attaque', cout: 1, degats: 3, comboParCarte: 2, debloqueA: 18 },
  { id: 'achever', nom: 'ACHEVER', type: 'attaque', cout: 1, degats: 5, finisseur: true, finisseurBonus: 14, debloqueA: 18 },
  { id: 'coup_brutal', nom: 'COUP BRUTAL', type: 'attaque', cout: 2, degats: 22, fragile: 1, debloqueA: 18 },
  { id: 'posture_fer', nom: 'POSTURE DE FER', type: 'defense', cout: 1, bloc: 6, force: 1, debloqueA: 18 },
  { id: 'repli_tactique', nom: 'REPLI TACTIQUE', type: 'defense', cout: 1, bloc: 5, pioche: 1, debloqueA: 18 },
  { id: 'poison_lent', nom: 'POISON LENT', type: 'effet', cout: 1, poison: 5, debloqueA: 18 },
  { id: 'respiration', nom: 'RESPIRATION', type: 'effet', cout: 0, soin: 3, debloqueA: 18 },

  // Palier 2 — dès quarante victoires cumulées.
  { id: 'lame_jumelle', nom: 'LAME JUMELLE', type: 'attaque', cout: 2, degats: 6, fois: 2, debloqueA: 40 },
  { id: 'entaille_profonde', nom: 'ENTAILLE PROFONDE', type: 'attaque', cout: 1, degats: 7, poison: 2, debloqueA: 40 },
  { id: 'carapace', nom: 'CARAPACE', type: 'defense', cout: 2, bloc: 14, debloqueA: 40 },
  { id: 'grand_affaiblissement', nom: 'GRAND AFFAIBLISSEMENT', type: 'effet', cout: 2, faible: 4, vulnerable: 2, debloqueA: 40 },
  { id: 'frenesie', nom: 'FRÉNÉSIE', type: 'effet', cout: 1, force: 3, recul: 2, debloqueA: 40 },
  { id: 'ruse', nom: 'RUSE', type: 'effet', cout: 0, pioche: 2, debloqueA: 40 },

  // Palier 3 — dès soixante-dix victoires cumulées.
  { id: 'ultime_assaut', nom: 'ULTIME ASSAUT', type: 'attaque', cout: 3, degats: 30, debloqueA: 70 },
  { id: 'lame_furieuse', nom: 'LAME FURIEUSE', type: 'attaque', cout: 1, degats: 4, comboParCarte: 3, debloqueA: 70 },
  { id: 'second_souffle', nom: 'SECOND SOUFFLE', type: 'defense', cout: 1, bloc: 3, soin: 6, debloqueA: 70 },
  { id: 'bastion', nom: 'BASTION', type: 'defense', cout: 2, bloc: 10, force: 1, debloqueA: 70 },
  { id: 'toxine_concentree', nom: 'TOXINE CONCENTRÉE', type: 'effet', cout: 2, poison: 10, debloqueA: 70 },

  // Palier 4 — dès cent-dix victoires cumulées.
  { id: 'coup_du_desespoir', nom: 'COUP DU DÉSESPOIR', type: 'attaque', cout: 1, degats: 14, recul: 4, debloqueA: 110 },
  { id: 'dernier_rempart', nom: 'DERNIER REMPART', type: 'defense', cout: 1, bloc: 20, defausseMain: true, debloqueA: 110 },
  { id: 'vision_du_champ', nom: 'VISION DU CHAMP', type: 'effet', cout: 1, pioche: 2, energieBonus: 1, debloqueA: 110 },
]

export const CARTES = [...STARTERS, ...POOL]

// --- Les adversaires : huit gabarits, mis à l'échelle par la profondeur -------
//
// Chaque `pattern` boucle sur les tours de l'adversaire. Un `attaque` inflige
// `(attaque + forceEnnemi) × mult` ; un `buff` accumule de la force adverse
// (le COLOSSE s'emballe si on le laisse durer — puni l'attentisme pur) ; un
// `soin` régénère (le CHAROGNARD punit le grignotage lent, favorise le
// burst ou le poison) ; un `bloc` protège l'adversaire un tour joueur entier.
export const ADVERSAIRES = [
  { nom: 'RÔDEUR', couleur: C.faible, pv: 14, attaque: 5, pattern: [{ type: 'attaque', mult: 1 }] },
  {
    nom: 'BRUTE',
    couleur: C.rouge,
    pv: 20,
    attaque: 7,
    pattern: [
      { type: 'attaque', mult: 1 },
      { type: 'attaque', mult: 1.3 },
    ],
  },
  {
    nom: 'GARDE-CHIOURME',
    couleur: C.cyan,
    pv: 18,
    attaque: 6,
    pattern: [
      { type: 'bloc', bloc: 6 },
      { type: 'attaque', mult: 1.6 },
    ],
  },
  {
    nom: 'CHAROGNARD',
    couleur: C.vert,
    pv: 16,
    attaque: 6,
    pattern: [
      { type: 'attaque', mult: 1 },
      { type: 'soin', soin: 6 },
    ],
  },
  {
    nom: 'COLOSSE',
    couleur: C.violet,
    pv: 30,
    attaque: 5,
    pattern: [
      { type: 'buff', force: 2 },
      { type: 'attaque', mult: 1 },
    ],
  },
  { nom: 'ASSASSIN', couleur: C.rouge, pv: 12, attaque: 9, pattern: [{ type: 'attaque', mult: 1.2 }] },
  {
    nom: 'GOLEM',
    couleur: C.accent,
    pv: 26,
    attaque: 5,
    pattern: [
      { type: 'attaque', mult: 0.8 },
      { type: 'attaque', mult: 0.8 },
      { type: 'attaque', mult: 1.8 },
    ],
  },
  {
    nom: 'HANTISE',
    couleur: C.violet,
    pv: 17,
    attaque: 4,
    pattern: [
      { type: 'attaque', mult: 1 },
      { type: 'buff', force: 1 },
      { type: 'attaque', mult: 1.3 },
    ],
  },
]

// Combat n : pv/attaque de base × (1 + n × ÉCHELLE). Trouvé au banc — plus
// haut, un deck encore petit meurt avant d'avoir vu deux récompenses ; plus
// bas, la profondeur n'a plus de sens et rien ne force le deck à grandir.
export const ECHELLE_PV = 0.15
export const ECHELLE_ATTAQUE = 0.1
