import { C } from '../palette.js'
import { texte, rect, cadre } from '../dessin.js'

/**
 * ASCENSION — une échelle sans fin contre une IA qui apprend.
 *
 * Trois actions en pierre-feuille-ciseaux : ATTAQUE bat CHARGE, GARDE bat
 * ATTAQUE, CHARGE bat GARDE. Le sel n'est pas dans la règle, il est dans
 * l'adversaire.
 *
 * Chaque rang a son caractère. Le COMPTEUR regarde ce que tu joues le plus.
 * L'ANALYSTE fait mieux : il retient ce que tu joues *après* chaque coup, ce
 * qui casse les alternances. Le MIROIR contre ton dernier geste. À force, la
 * seule façon de ne pas être lu est de jouer au hasard — et jouer au hasard,
 * ça ne s'apprend pas.
 */

const ACTIONS = [
  { nom: 'ATTAQUE', couleur: C.rouge, aide: 'dépense la charge' },
  { nom: 'GARDE', couleur: C.cyan, aide: 'bloque et charge un peu' },
  { nom: 'CHARGE', couleur: C.accent, aide: 'gros gain, mais exposé' },
]

// Ce qui bat quoi : CONTRE[x] est l'action qui l'emporte sur x.
const CONTRE = [1, 2, 0]

const CARACTERES = [
  { id: 'brute', nom: 'LA BRUTE', dit: 'frappe souvent, réfléchit peu' },
  { id: 'compteur', nom: 'LE COMPTEUR', dit: 'retient ce que tu joues le plus' },
  { id: 'miroir', nom: 'LE MIROIR', dit: 'contre ton dernier geste' },
  { id: 'analyste', nom: 'L’ANALYSTE', dit: 'retient tes enchaînements' },
]

const AMELIORATIONS = [
  { cle: 'pvMax', nom: 'VITALITÉ', pas: 8, cout: 4, base: 40, suffixe: ' PV' },
  { cle: 'degats', nom: 'PUISSANCE', pas: 2, cout: 6, base: 6, suffixe: ' dégâts' },
  { cle: 'charge', nom: 'ENDURANCE', pas: 1, cout: 8, base: 2, suffixe: ' par charge' },
]

/** Une relique tous les trois rangs. C'est ce qui donne des parties différentes. */
const RELIQUES = [
  { id: 'lame', nom: 'LAME COURBE', dit: '+2 dégâts par point de charge' },
  { id: 'plastron', nom: 'PLASTRON', dit: 'tu encaisses 3 dégâts de moins' },
  { id: 'souffle', nom: 'SECOND SOUFFLE', dit: 'tu commences chaque duel avec 2 charges' },
  { id: 'brume', nom: 'BRUME', dit: 'elle oublie un geste sur trois' },
  { id: 'riposte', nom: 'RIPOSTE', dit: 'parer une attaque rend 4 dégâts' },
  { id: 'sangfroid', nom: 'SANG-FROID', dit: '+12 PV, et +1 charge en parant' },
  { id: 'usure', nom: 'USURE', dit: 'elle perd 2 PV à chaque tour' },
  { id: 'eclair', nom: 'ÉCLAIR', dit: 'ta première attaque du duel est doublée' },
]

export default {
  id: 'ascension',
  nom: 'ASCENSION',
  pitch: 'Une IA qui apprend tes habitudes. Sans fin',
  couleur: C.accent,
  unite: 'rang',
  persistant: true,
  sansScore: true,

  titreHud: (j) => `RANG ${j.e.h.rang}`,

  init(j) {
    const s = j.charge()
    j.e.h = s ?? {
      rang: 1,
      points: 0,
      pvMax: 40,
      degats: 6,
      charge: 2,
      victoires: 0,
      meilleur: 1,
      reliques: [],
    }
    j.e.h.reliques = j.e.h.reliques ?? []
    j.e.vue = 'atelier'
    j.e.recit = s ? `tu reprends au rang ${j.e.h.rang}` : "l'échelle commence ici"
    videMemoire(j)
  },

  maj(j, dt) {
    if (j.e.anim > 0) j.e.anim -= dt
  },

  dessine(j, ctx) {
    if (j.e.vue === 'atelier') return atelier(j, ctx)
    if (j.e.vue === 'relique') return choixRelique(j, ctx)
    duel(j, ctx)
  },

  appui(j, p) {
    if (j.e.vue === 'atelier') return appuiAtelier(j, p)
    if (j.e.vue === 'relique') return appuiRelique(j, p)
    if (j.e.anim > 0) return
    const i = Math.floor((p.y - 452) / 62)
    if (i >= 0 && i < 3 && p.y >= 452) tour(j, i)
  },

  quitte: (j) => ecrit(j),
}

const a = (j, id) => j.e.h.reliques.includes(id)

// --- Atelier -----------------------------------------------------------------

const AME_Y = 176
const AME_H = 60
const AME_PAS = 68
const COMBAT = { y: 442, h: 72 }

function atelier(j, ctx) {
  const h = j.e.h
  texte(ctx, `RANG ${h.rang}`, j.W / 2, 84, 30, C.accent, 700)
  texte(ctx, j.e.recit, j.W / 2, 110, 13, C.faible, 700, 330)
  texte(ctx, `${h.points} points`, j.W / 2, 134, 17, C.texte, 700)
  texte(ctx, `meilleur rang : ${h.meilleur} · ${h.victoires} victoires`, j.W / 2, 155, 12, C.faible, 700)

  AMELIORATIONS.forEach((am, i) => {
    const y = AME_Y + i * AME_PAS
    const possible = h.points >= cout(h, am)
    rect(ctx, 20, y, 320, AME_H, C.panneau)
    rect(ctx, 20, y, 4, AME_H, possible ? C.accent : C.bord)
    ctx.textAlign = 'left'
    texte(ctx, am.nom, 34, y + 20, 15, possible ? C.texte : C.faible, 700)
    texte(ctx, `${h[am.cle]}${am.suffixe}  →  +${am.pas}`, 34, y + 42, 12, C.faible, 700, 210)
    ctx.textAlign = 'right'
    texte(ctx, `${cout(h, am)} pts`, 326, y + 31, 15, possible ? C.accent : C.bord, 700)
    ctx.textAlign = 'center'
  })

  ctx.textAlign = 'left'
  texte(ctx, 'RELIQUES', 20, 396, 11, C.bord, 700)
  const noms = h.reliques.map((id) => RELIQUES.find((r) => r.id === id)?.nom ?? id)
  texte(ctx, noms.length ? noms.join(' · ') : 'aucune — la prochaine au rang ' + prochaineRelique(h), 20, 416, 12, noms.length ? C.accent : C.bord, 700, 320)
  ctx.textAlign = 'center'

  const c = caractere(h.rang)
  rect(ctx, 20, COMBAT.y, 320, COMBAT.h, C.panneau)
  cadre(ctx, 20, COMBAT.y, 320, COMBAT.h, boss(h.rang) ? C.accent : C.rouge)
  texte(ctx, boss(h.rang) ? `GARDIEN DU RANG ${h.rang}` : `COMBATTRE LE RANG ${h.rang}`, j.W / 2, COMBAT.y + 24, 17, boss(h.rang) ? C.accent : C.rouge, 700, 296)
  texte(ctx, `${c.nom} — ${c.dit}`, j.W / 2, COMBAT.y + 48, 12, C.faible, 700, 296)

  texte(ctx, `${pvAdverse(h.rang)} PV · ${degatsAdverse(h.rang)} dégâts · lucidité ${Math.round(lucidite(h.rang) * 100)} %`, j.W / 2, 532, 12, C.bord, 700, 320)
}

function appuiAtelier(j, p) {
  const h = j.e.h
  const i = Math.floor((p.y - AME_Y) / AME_PAS)
  if (i >= 0 && i < AMELIORATIONS.length && p.y >= AME_Y && p.y < AME_Y + AMELIORATIONS.length * AME_PAS) {
    const am = AMELIORATIONS[i]
    if (h.points < cout(h, am)) return j.son.rate()
    h.points -= cout(h, am)
    h[am.cle] += am.pas
    j.son.niveau()
    j.fx.eclat(180, AME_Y + i * AME_PAS + AME_H / 2, C.accent, { n: 12, vitesse: 140 })
    ecrit(j)
    return
  }

  if (p.y >= COMBAT.y && p.y <= COMBAT.y + COMBAT.h) {
    j.son.clic()
    commence(j)
  }
}

const cout = (h, am) => am.cout + Math.floor((h[am.cle] - am.base) / am.pas) * am.cout
const prochaineRelique = (h) => Math.ceil(h.rang / 3) * 3

// --- Choix de relique --------------------------------------------------------

function choixRelique(j, ctx) {
  texte(ctx, 'CHOISIS UNE RELIQUE', j.W / 2, 110, 22, C.accent, 700)
  texte(ctx, 'elle reste pour toujours', j.W / 2, 138, 13, C.faible, 700)

  j.e.offre.forEach((r, i) => {
    const y = 180 + i * 116
    rect(ctx, 20, y, 320, 100, C.panneau)
    cadre(ctx, 20, y, 320, 100, C.accent)
    texte(ctx, r.nom, j.W / 2, y + 34, 19, C.accent, 700, 296)
    texte(ctx, r.dit, j.W / 2, y + 66, 13, C.texte, 700, 296)
  })
}

function appuiRelique(j, p) {
  const i = Math.floor((p.y - 180) / 116)
  if (i < 0 || i >= j.e.offre.length || p.y < 180) return
  const r = j.e.offre[i]
  j.e.h.reliques.push(r.id)
  if (r.id === 'sangfroid') j.e.h.pvMax += 12
  j.e.vue = 'atelier'
  j.e.recit = `${r.nom} — ${r.dit}`
  j.son.record()
  j.fx.eclat(j.W / 2, 300, C.accent, { n: 30, vitesse: 240 })
  ecrit(j)
}

function offreRelique(j) {
  const reste = RELIQUES.filter((r) => !a(j, r.id))
  if (!reste.length) return false
  const tirage = []
  while (tirage.length < Math.min(3, reste.length)) {
    const r = reste[Math.floor(Math.random() * reste.length)]
    if (!tirage.includes(r)) tirage.push(r)
  }
  j.e.offre = tirage
  j.e.vue = 'relique'
  return true
}

// --- Duel --------------------------------------------------------------------

const boss = (rang) => rang % 10 === 0
const pvAdverse = (rang) => Math.round((30 + rang * 7) * (boss(rang) ? 1.6 : 1))
const degatsAdverse = (rang) => 5 + Math.floor(rang * 0.8)
/** À quel point elle se sert de ce qu'elle a retenu. Jamais parfaite. */
const lucidite = (rang) => Math.min(boss(rang) ? 0.95 : 0.88, 0.2 + rang * 0.035)

/** Le caractère dépend du rang : les plus fins arrivent plus haut. */
function caractere(rang) {
  if (boss(rang)) return CARACTERES[3]
  const dispo = rang < 3 ? 1 : rang < 6 ? 2 : rang < 12 ? 3 : 4
  // Déterministe : un rang donné a toujours le même adversaire.
  return CARACTERES[(rang * 7 + 3) % dispo]
}

function videMemoire(j) {
  j.e.freq = [0, 0, 0]
  j.e.chaine = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]
  j.e.dernierMien = null
}

function commence(j) {
  const h = j.e.h
  j.e.vue = 'duel'
  j.e.moi = { pv: h.pvMax, charge: a(j, 'souffle') ? 2 : 0 }
  j.e.lui = { pv: pvAdverse(h.rang), charge: 0 }
  j.e.car = caractere(h.rang)
  j.e.premiere = true
  videMemoire(j)
  j.e.recit = 'à toi'
  j.e.dernier = null
  j.e.anim = 0
}

function duel(j, ctx) {
  const h = j.e.h

  ctx.textAlign = 'center'
  texte(ctx, j.e.car.nom, j.W / 2, 70, 14, C.rouge, 700)
  jauge(ctx, 'ADVERSAIRE', j.e.lui, pvAdverse(h.rang), 96, C.rouge)
  jauge(ctx, 'TOI', j.e.moi, h.pvMax, 300, C.vert)

  if (j.e.dernier) {
    const [mien, sien] = j.e.dernier
    texte(ctx, `toi ${ACTIONS[mien].nom}  ·  elle ${ACTIONS[sien].nom}`, j.W / 2, 214, 14, C.faible, 700, 330)
  }
  texte(ctx, j.e.recit, j.W / 2, 244, 17, C.accent, 700, 330)

  // Ce qu'elle croit savoir de toi : montré exprès, c'est le vrai jeu.
  texte(ctx, 'CE QU’ELLE A RETENU', j.W / 2, 396, 11, C.bord, 700)
  const total = j.e.freq.reduce((s, v) => s + v, 0) || 1
  ACTIONS.forEach((act, i) => {
    rect(ctx, 36 + i * 100, 410, 96, 8, C.panneau)
    rect(ctx, 36 + i * 100, 410, (j.e.freq[i] / total) * 96, 8, act.couleur)
  })

  ACTIONS.forEach((act, i) => {
    const y = 452 + i * 62
    rect(ctx, 20, y, 320, 54, C.panneau)
    cadre(ctx, 20, y, 320, 54, act.couleur)
    ctx.textAlign = 'left'
    texte(ctx, act.nom, 38, y + 27, 18, act.couleur, 700)
    ctx.textAlign = 'right'
    texte(ctx, act.aide, 324, y + 27, 12, C.faible, 700, 180)
    ctx.textAlign = 'center'
  })
}

function jauge(ctx, nom, e, max, y, couleur) {
  ctx.textAlign = 'left'
  texte(ctx, nom, 20, y, 14, C.faible, 700)
  ctx.textAlign = 'right'
  texte(ctx, `${Math.max(0, e.pv)} PV`, 340, y, 14, C.texte, 700)
  ctx.textAlign = 'center'
  rect(ctx, 20, y + 14, 320, 14, C.panneau)
  rect(ctx, 20, y + 14, 320 * Math.max(0, e.pv / max), 14, couleur)
  for (let i = 0; i < 6; i++) rect(ctx, 20 + i * 18, y + 36, 12, 8, i < e.charge ? C.accent : C.bord)
}

const alea = () => Math.floor(Math.random() * 3)
const argmax = (t) => t.indexOf(Math.max(...t))

/** Elle choisit : soit elle exploite ce qu'elle a retenu, soit elle improvise. */
function choixIA(j) {
  const h = j.e.h
  if (Math.random() > lucidite(h.rang)) return alea()

  switch (j.e.car.id) {
    case 'brute':
      return Math.random() < 0.6 ? 0 : alea()

    case 'miroir':
      return j.e.dernierMien === null ? alea() : CONTRE[j.e.dernierMien]

    case 'analyste': {
      // Ce que tu joues *après* ton dernier coup : casse les alternances,
      // que la simple fréquence ne voit pas.
      const suite = j.e.dernierMien === null ? null : j.e.chaine[j.e.dernierMien]
      if (suite && suite.some(Boolean)) return CONTRE[argmax(suite)]
      return j.e.freq.some(Boolean) ? CONTRE[argmax(j.e.freq)] : alea()
    }

    default:
      return j.e.freq.some(Boolean) ? CONTRE[argmax(j.e.freq)] : alea()
  }
}

function retient(j, mien) {
  // La brume lui fait sauter un geste sur trois : ses statistiques restent
  // justes, mais elles vieillissent moins vite.
  if (a(j, 'brume') && Math.random() < 0.34) return
  j.e.freq[mien]++
  if (j.e.dernierMien !== null) j.e.chaine[j.e.dernierMien][mien]++
}

function tour(j, mien) {
  const h = j.e.h
  const sien = choixIA(j)
  retient(j, mien)
  j.e.dernierMien = mien
  j.e.dernier = [mien, sien]
  j.e.anim = 0.25

  const moi = j.e.moi
  const lui = j.e.lui
  const parCharge = a(j, 'lame') ? 5 : 3
  let degatsMoi = h.degats + moi.charge * parCharge
  const degatsLui = Math.max(1, degatsAdverse(h.rang) + lui.charge * 3 - (a(j, 'plastron') ? 3 : 0))

  if (mien === 0 && j.e.premiere && a(j, 'eclair')) {
    degatsMoi *= 2
    j.e.premiere = false
  }

  let recit = ''
  const gagneCharge = (e, n) => (e.charge = Math.min(6, e.charge + n))

  if (mien === 0 && sien === 0) {
    lui.pv -= degatsMoi
    moi.pv -= degatsLui
    moi.charge = 0
    lui.charge = 0
    recit = 'les deux lames passent'
  } else if (mien === 0 && sien === 1) {
    moi.charge = 0
    gagneCharge(lui, 1)
    recit = 'elle a paré'
  } else if (mien === 0 && sien === 2) {
    lui.pv -= degatsMoi * 2
    moi.charge = 0
    recit = `tu la prends en pleine charge (${degatsMoi * 2})`
  } else if (mien === 1 && sien === 0) {
    lui.charge = 0
    gagneCharge(moi, a(j, 'sangfroid') ? 2 : 1)
    if (a(j, 'riposte')) {
      lui.pv -= 4
      recit = 'tu pares et tu rends le coup'
    } else recit = 'tu pares'
  } else if (mien === 1 && sien === 1) {
    gagneCharge(moi, 1)
    gagneCharge(lui, 1)
    recit = 'personne ne bouge'
  } else if (mien === 1 && sien === 2) {
    gagneCharge(moi, 1)
    gagneCharge(lui, 2)
    recit = 'elle prend de l’élan'
  } else if (mien === 2 && sien === 0) {
    moi.pv -= degatsLui * 2
    lui.charge = 0
    recit = `elle te cueille en pleine charge (${degatsLui * 2})`
  } else if (mien === 2 && sien === 1) {
    gagneCharge(moi, h.charge)
    gagneCharge(lui, 1)
    recit = 'tu montes en puissance'
  } else {
    gagneCharge(moi, h.charge)
    gagneCharge(lui, 2)
    recit = 'les deux reculent'
  }

  if (a(j, 'usure')) lui.pv -= 2

  j.e.recit = recit
  j.son.touche(mien === 0 ? 7 : 4)
  if (mien === 0 || sien === 0) j.fx.secoue(4)

  if (lui.pv <= 0) return gagne(j)
  if (moi.pv <= 0) return perd(j)
}

function gagne(j) {
  const h = j.e.h
  const gain = (3 + Math.floor(h.rang * 1.5)) * (boss(h.rang) ? 3 : 1)
  h.points += gain
  h.rang++
  h.victoires++
  h.meilleur = Math.max(h.meilleur, h.rang)
  j.e.recit = `rang ${h.rang - 1} vaincu · +${gain} points`
  j.son.record()
  j.fx.eclat(j.W / 2, 260, C.accent, { n: 30, vitesse: 240 })

  // Une relique tous les trois rangs : c'est le vrai rythme de progression.
  if ((h.rang - 1) % 3 === 0 && offreRelique(j)) {
    ecrit(j)
    return
  }
  j.e.vue = 'atelier'
  ecrit(j)
}

function perd(j) {
  const h = j.e.h
  // On ne perd jamais tout : le rang recule d'un cran, améliorations et
  // reliques restent. Une échelle sans fin ne punit pas comme un roguelike.
  h.rang = Math.max(1, h.rang - 1)
  h.points += 1
  j.e.vue = 'atelier'
  j.e.recit = 'battu — tu redescends d’un rang'
  j.son.mort()
  j.fx.secoue(9)
  ecrit(j)
}

function ecrit(j) {
  if (j.e?.h) j.sauve(j.e.h)
}
