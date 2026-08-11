import { C } from '../palette.js'
import { texte, rect, cadre } from '../dessin.js'

/**
 * ASCENSION — une échelle sans fin contre une IA qui apprend.
 *
 * Trois actions en pierre-feuille-ciseaux : ATTAQUE bat CHARGE, GARDE bat
 * ATTAQUE, CHARGE bat GARDE. Le sel n'est pas dans la règle, il est dans
 * l'adversaire : l'IA compte ce que tu joues et te contre d'autant plus
 * souvent que le rang est élevé. À force, jouer au hasard devient la seule
 * façon de ne pas être lu — et jouer au hasard, ça ne s'apprend pas.
 */

const ACTIONS = [
  { id: 0, nom: 'ATTAQUE', couleur: C.rouge, aide: 'dépense la charge' },
  { id: 1, nom: 'GARDE', couleur: C.cyan, aide: 'bloque et charge un peu' },
  { id: 2, nom: 'CHARGE', couleur: C.accent, aide: 'gros gain, mais exposé' },
]

// Ce qui bat quoi : contre[x] est l'action qui l'emporte sur x.
const CONTRE = [1, 2, 0]

const AMELIORATIONS = [
  { cle: 'pvMax', nom: 'VITALITÉ', pas: 8, cout: 4, suffixe: ' PV' },
  { cle: 'degats', nom: 'PUISSANCE', pas: 2, cout: 6, suffixe: ' dégâts' },
  { cle: 'charge', nom: 'ENDURANCE', pas: 1, cout: 8, suffixe: ' par charge' },
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
    j.e.h = s ?? { rang: 1, points: 0, pvMax: 40, degats: 6, charge: 2, victoires: 0, meilleur: 1 }
    j.e.vue = 'atelier'
    j.e.recit = s ? `tu reprends au rang ${j.e.h.rang}` : "l'échelle commence ici"
    j.e.memoire = [0, 0, 0] // ce que l'IA a retenu de toi
  },

  maj(j, dt) {
    if (j.e.anim > 0) j.e.anim -= dt
  },

  dessine(j, ctx) {
    if (j.e.vue === 'atelier') return atelier(j, ctx)
    duel(j, ctx)
  },

  appui(j, p) {
    if (j.e.vue === 'atelier') return appuiAtelier(j, p)
    if (j.e.anim > 0) return
    const i = Math.floor((p.y - 452) / 62)
    if (i >= 0 && i < 3 && p.y >= 452) tour(j, i)
  },

  quitte: (j) => ecrit(j),
}

// --- Atelier -----------------------------------------------------------------

function atelier(j, ctx) {
  const h = j.e.h
  texte(ctx, `RANG ${h.rang}`, j.W / 2, 96, 34, C.accent, 700)
  texte(ctx, j.e.recit, j.W / 2, 128, 13, C.faible, 700, 320)
  texte(ctx, `${h.points} points`, j.W / 2, 160, 18, C.texte, 700)
  texte(ctx, `meilleur rang atteint : ${h.meilleur}`, j.W / 2, 184, 12, C.faible, 700)

  AMELIORATIONS.forEach((a, i) => {
    const y = 210 + i * 74
    const possible = h.points >= cout(h, a)
    rect(ctx, 20, y, 320, 64, C.panneau)
    rect(ctx, 20, y, 4, 64, possible ? C.accent : C.bord)
    ctx.textAlign = 'left'
    texte(ctx, a.nom, 34, y + 22, 16, possible ? C.texte : C.faible, 700)
    texte(ctx, `${h[a.cle]}${a.suffixe}  →  +${a.pas}`, 34, y + 44, 13, C.faible, 700, 220)
    ctx.textAlign = 'right'
    texte(ctx, `${cout(h, a)} pts`, 326, y + 33, 16, possible ? C.accent : C.bord, 700)
    ctx.textAlign = 'center'
  })

  rect(ctx, 20, 450, 320, 74, C.panneau)
  cadre(ctx, 20, 450, 320, 74, C.rouge)
  texte(ctx, `COMBATTRE LE RANG ${h.rang}`, j.W / 2, 478, 18, C.rouge, 700, 296)
  texte(ctx, `${pvAdverse(h.rang)} PV · ${degatsAdverse(h.rang)} dégâts · lucidité ${Math.round(lucidite(h.rang) * 100)} %`, j.W / 2, 504, 12, C.faible, 700, 296)

  texte(ctx, "plus le rang monte, mieux l'IA te lit", j.W / 2, 556, 12, C.bord, 700)
}

function appuiAtelier(j, p) {
  const h = j.e.h
  const i = Math.floor((p.y - 210) / 74)
  if (i >= 0 && i < AMELIORATIONS.length && p.y >= 210 && p.y < 210 + AMELIORATIONS.length * 74) {
    const a = AMELIORATIONS[i]
    if (h.points < cout(h, a)) return j.son.rate()
    h.points -= cout(h, a)
    h[a.cle] += a.pas
    j.son.niveau()
    j.fx.eclat(180, 210 + i * 74 + 32, C.accent, { n: 12, vitesse: 140 })
    ecrit(j)
    return
  }

  if (p.y >= 450 && p.y <= 524) {
    j.son.clic()
    commence(j)
  }
}

const cout = (h, a) => a.cout + Math.floor((h[a.cle] - depart(a)) / a.pas) * a.cout
const depart = (a) => ({ pvMax: 40, degats: 6, charge: 2 })[a.cle]

// --- Duel --------------------------------------------------------------------

const pvAdverse = (rang) => 30 + rang * 7
const degatsAdverse = (rang) => 5 + Math.floor(rang * 0.8)
/** À quel point l'IA se sert de ce qu'elle a retenu. Jamais parfaite. */
const lucidite = (rang) => Math.min(0.88, 0.2 + rang * 0.035)

function commence(j) {
  const h = j.e.h
  j.e.vue = 'duel'
  j.e.moi = { pv: h.pvMax, charge: 0 }
  j.e.lui = { pv: pvAdverse(h.rang), charge: 0 }
  j.e.memoire = [0, 0, 0]
  j.e.recit = 'à toi'
  j.e.dernier = null
  j.e.anim = 0
}

function duel(j, ctx) {
  const h = j.e.h

  jauge(ctx, 'ADVERSAIRE', j.e.lui, pvAdverse(h.rang), 90, C.rouge)
  jauge(ctx, 'TOI', j.e.moi, h.pvMax, 300, C.vert)

  if (j.e.dernier) {
    const [mien, sien] = j.e.dernier
    texte(ctx, `toi ${ACTIONS[mien].nom}  ·  elle ${ACTIONS[sien].nom}`, j.W / 2, 214, 14, C.faible, 700, 330)
  }
  texte(ctx, j.e.recit, j.W / 2, 244, 17, C.accent, 700, 330)

  // Ce que l'IA croit savoir de toi : montré exprès, c'est le vrai jeu.
  texte(ctx, 'CE QU’ELLE A RETENU', j.W / 2, 396, 11, C.bord, 700)
  const total = j.e.memoire.reduce((s, v) => s + v, 0) || 1
  ACTIONS.forEach((a, i) => {
    const l = (j.e.memoire[i] / total) * 96
    rect(ctx, 36 + i * 100, 410, 96, 8, C.panneau)
    rect(ctx, 36 + i * 100, 410, l, 8, a.couleur)
  })

  ACTIONS.forEach((a, i) => {
    const y = 452 + i * 62
    rect(ctx, 20, y, 320, 54, C.panneau)
    cadre(ctx, 20, y, 320, 54, a.couleur)
    ctx.textAlign = 'left'
    texte(ctx, a.nom, 38, y + 27, 18, a.couleur, 700)
    ctx.textAlign = 'right'
    texte(ctx, a.aide, 324, y + 27, 12, C.faible, 700, 180)
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
  for (let i = 0; i < 6; i++) {
    rect(ctx, 20 + i * 18, y + 36, 12, 8, i < e.charge ? C.accent : C.bord)
  }
}

/** L'IA choisit : soit elle contre ton habitude, soit elle joue au hasard. */
function choixIA(j) {
  const rang = j.e.h.rang
  if (Math.random() > lucidite(rang)) return Math.floor(Math.random() * 3)
  const m = j.e.memoire
  const total = m[0] + m[1] + m[2]
  if (!total) return Math.floor(Math.random() * 3)
  let favori = 0
  for (let i = 1; i < 3; i++) if (m[i] > m[favori]) favori = i
  return CONTRE[favori]
}

function tour(j, mien) {
  const h = j.e.h
  const sien = choixIA(j)
  j.e.memoire[mien]++
  j.e.dernier = [mien, sien]
  j.e.anim = 0.25

  const moi = j.e.moi
  const lui = j.e.lui
  const degatsMoi = h.degats + moi.charge * 3
  const degatsLui = degatsAdverse(h.rang) + lui.charge * 3

  let recit = ''
  const frappe = (att, def, degats, expose) => {
    const total = expose ? degats * 2 : degats
    def.pv -= total
    att.charge = 0
    return total
  }

  if (mien === 0 && sien === 0) {
    frappe(moi, lui, degatsMoi, false)
    frappe(lui, moi, degatsLui, false)
    recit = 'les deux lames passent'
  } else if (mien === 0 && sien === 1) {
    moi.charge = 0
    lui.charge = Math.min(6, lui.charge + 1)
    recit = 'elle a paré'
  } else if (mien === 0 && sien === 2) {
    const d = frappe(moi, lui, degatsMoi, true)
    recit = `tu la prends en pleine charge (${d})`
  } else if (mien === 1 && sien === 0) {
    lui.charge = 0
    moi.charge = Math.min(6, moi.charge + 1)
    recit = 'tu pares'
  } else if (mien === 1 && sien === 1) {
    moi.charge = Math.min(6, moi.charge + 1)
    lui.charge = Math.min(6, lui.charge + 1)
    recit = 'personne ne bouge'
  } else if (mien === 1 && sien === 2) {
    moi.charge = Math.min(6, moi.charge + 1)
    lui.charge = Math.min(6, lui.charge + 2)
    recit = 'elle prend de l’élan'
  } else if (mien === 2 && sien === 0) {
    const d = frappe(lui, moi, degatsLui, true)
    recit = `elle te cueille en pleine charge (${d})`
  } else if (mien === 2 && sien === 1) {
    moi.charge = Math.min(6, moi.charge + h.charge)
    lui.charge = Math.min(6, lui.charge + 1)
    recit = 'tu montes en puissance'
  } else {
    moi.charge = Math.min(6, moi.charge + h.charge)
    lui.charge = Math.min(6, lui.charge + 2)
    recit = 'les deux reculent'
  }

  j.e.recit = recit
  j.son.touche(mien === 0 ? 7 : 4)
  if (mien === 0 || sien === 0) j.fx.secoue(4)

  if (lui.pv <= 0) return gagne(j)
  if (moi.pv <= 0) return perd(j)
}

function gagne(j) {
  const h = j.e.h
  const gain = 3 + Math.floor(h.rang * 1.5)
  h.points += gain
  h.rang++
  h.victoires++
  h.meilleur = Math.max(h.meilleur, h.rang)
  j.e.vue = 'atelier'
  j.e.recit = `rang ${h.rang - 1} vaincu · +${gain} points`
  j.son.record()
  j.fx.eclat(j.W / 2, 260, C.accent, { n: 30, vitesse: 240 })
  ecrit(j)
}

function perd(j) {
  const h = j.e.h
  // On ne perd jamais tout : le rang recule d'un cran, les améliorations
  // restent. Une échelle sans fin ne doit pas punir comme un roguelike.
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
