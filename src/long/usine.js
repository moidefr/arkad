import { C, ton } from '../palette.js'
import { texte, rect, cadre, bloc, lueur } from '../dessin.js'

const MACHINES = [
  { nom: 'PIOCHE', cout: 12, taux: 1.15, prod: 0.4, couleur: C.faible },
  { nom: 'FOREUSE', cout: 140, taux: 1.16, prod: 3.5, couleur: C.cyan },
  { nom: 'CONVOYEUR', cout: 1700, taux: 1.17, prod: 24, couleur: C.vert },
  { nom: 'FONDERIE', cout: 24000, taux: 1.18, prod: 170, couleur: C.violet },
  { nom: 'RÉACTEUR', cout: 400000, taux: 1.2, prod: 1400, couleur: C.accent },
]

/**
 * Les améliorations sont ce qui empêche un incrémental de devenir une file
 * d'attente : elles cassent la courbe au lieu de l'allonger.
 */
const AMELIORATIONS = [
  { id: 'g0', nom: 'MANCHES FERRÉS', dit: 'PIOCHE ×3', cout: 900, cible: 0, facteur: 3 },
  { id: 'm1', nom: 'GANTS RENFORCÉS', dit: 'creuser à la main ×6', cout: 2500, main: 6 },
  { id: 'g1', nom: 'TÊTES DIAMANT', dit: 'FOREUSE ×3', cout: 14000, cible: 1, facteur: 3 },
  { id: 'h1', nom: 'HUILE CHAUDE', dit: 'tout ×1.6', cout: 90000, global: 1.6 },
  { id: 'g2', nom: 'COURROIES DOUBLES', dit: 'CONVOYEUR ×3', cout: 400000, cible: 2, facteur: 3 },
  { id: 'h2', nom: 'AUTOMATISATION', dit: 'tout ×2', cout: 4e6, global: 2 },
  { id: 'g3', nom: 'CREUSETS PROFONDS', dit: 'FONDERIE ×3', cout: 3e7, cible: 3, facteur: 3 },
  { id: 'g4', nom: 'CONFINEMENT', dit: 'RÉACTEUR ×4', cout: 6e8, cible: 4, facteur: 4 },
  { id: 'h3', nom: 'CHAÎNE COMPLÈTE', dit: 'tout ×3', cout: 2e10, global: 3 },
]

const HORS_LIGNE_MAX = 8 * 3600 // on ne crédite jamais plus de huit heures
const SEUIL_LINGOT = 1e4 // il faut ce cube de minerai pour un premier lingot

export default {
  id: 'usine',
  nom: 'USINE',
  pitch: 'Ça produit même quand tu n’es pas là. Puis on refond tout',
  couleur: C.violet,
  unite: '',
  persistant: true,
  sansScore: true,

  titreHud: (j) => nombre(j.e.minerai),

  init(j) {
    const s = j.charge()
    j.e.minerai = s?.minerai ?? 0
    j.e.n = s?.n ?? MACHINES.map(() => 0)
    j.e.ame = s?.ame ?? []
    j.e.total = s?.total ?? 0
    j.e.lingots = s?.lingots ?? 0
    j.e.fontes = s?.fontes ?? 0
    j.e.vue = 'usine'
    j.e.horsLigne = 0
    j.e.depuisSauve = 0
    j.e.pulse = 0

    // Production hors ligne : c'est ce qui donne envie de rouvrir le jeu.
    if (s?.quand) {
      const ecoule = Math.min(HORS_LIGNE_MAX, Math.max(0, (Date.now() - s.quand) / 1000))
      const gagne = production(j) * ecoule
      if (gagne > 1) {
        j.e.minerai += gagne
        j.e.total += gagne
        j.e.horsLigne = gagne
      }
    }
  },

  maj(j, dt) {
    const p = production(j) * dt
    j.e.minerai += p
    j.e.total += p
    j.e.pulse = Math.max(0, j.e.pulse - dt * 4)

    j.e.depuisSauve += dt
    if (j.e.depuisSauve > 2) {
      j.e.depuisSauve = 0
      ecrit(j)
    }
  },

  quitte: (j) => ecrit(j),

  dessine(j, ctx) {
    texte(ctx, nombre(j.e.minerai), j.W / 2, 78, 32, C.texte, 700, 320)
    texte(ctx, `${nombre(production(j))} / s`, j.W / 2, 104, 14, C.faible, 700)
    if (j.e.lingots) {
      texte(ctx, `${j.e.lingots} lingots · +${Math.round(j.e.lingots * 5)} %`, j.W / 2, 124, 12, C.accent, 700)
    }

    onglet(j, ctx, 'usine', 'USINE', 20, 138)
    onglet(j, ctx, 'atelier', 'ATELIER', 186, 138)

    if (j.e.vue === 'usine') vueUsine(j, ctx)
    else vueAtelier(j, ctx)

    if (j.e.horsLigne > 1 && j.t < 6) {
      texte(ctx, `pendant ton absence : +${nombre(j.e.horsLigne)}`, j.W / 2, j.H - 16, 13, C.accent, 700)
    }
  },

  appui(j, p) {
    if (p.y >= 138 && p.y <= 174) {
      j.e.vue = p.x < j.W / 2 ? 'usine' : 'atelier'
      return j.son.clic()
    }
    if (j.e.vue === 'usine') return appuiUsine(j, p)
    appuiAtelier(j, p)
  },
}

function onglet(j, ctx, id, nom, x, y) {
  const actif = j.e.vue === id
  rect(ctx, x, y, 154, 36, actif ? C.panneau : C.fond)
  cadre(ctx, x, y, 154, 36, actif ? C.accent : C.bord)
  texte(ctx, nom, x + 77, y + 19, 15, actif ? C.accent : C.faible, 700)
}

// --- Vue usine ---------------------------------------------------------------

const CREUSER = { x: 90, y: 186, w: 180, h: 56 }
const RANGEE_Y = 256
const RANGEE_H = 60

function vueUsine(j, ctx) {
  const k = 1 + j.e.pulse * 0.05
  ctx.save()
  ctx.translate(CREUSER.x + CREUSER.w / 2, CREUSER.y + CREUSER.h / 2)
  ctx.scale(k, k)
  lueur(ctx, -CREUSER.w / 2, -CREUSER.h / 2, CREUSER.w, CREUSER.h, C.accent, 3, 0.8)
  bloc(ctx, -CREUSER.w / 2, -CREUSER.h / 2, CREUSER.w, CREUSER.h, ton(C.panneau, 0.3), 3)
  cadre(ctx, -CREUSER.w / 2, -CREUSER.h / 2, CREUSER.w, CREUSER.h, C.accent)
  texte(ctx, 'CREUSER', 0, 0, 19, C.accent, 700)
  ctx.restore()

  MACHINES.forEach((m, i) => {
    const y = RANGEE_Y + i * (RANGEE_H + 4)
    const prix = cout(j, i)
    const possible = j.e.minerai >= prix
    const mult = multiplicateur(j, i)
    rect(ctx, 16, y, 328, RANGEE_H, C.panneau)
    rect(ctx, 16, y + RANGEE_H - 3, 328, 3, ton(C.panneau, -0.5))
    if (possible) lueur(ctx, 16, y, 5, RANGEE_H, m.couleur, 2)
    bloc(ctx, 16, y, 5, RANGEE_H, possible ? m.couleur : C.bord, 2)

    ctx.textAlign = 'left'
    texte(ctx, m.nom, 32, y + 18, 15, possible ? C.texte : C.faible, 700)
    const detail = `${nombre(m.prod * j.e.n[i] * mult * global(j))} / s` + (mult > 1 ? `  ×${mult}` : '')
    texte(ctx, detail, 32, y + 40, 12, mult > 1 ? C.accent : C.faible, 700, 190)
    ctx.textAlign = 'right'
    texte(ctx, `x${j.e.n[i]}`, 336, y + 18, 15, C.texte, 700)
    texte(ctx, nombre(prix), 336, y + 40, 13, possible ? C.accent : C.bord, 700)
    ctx.textAlign = 'center'
  })
}

function appuiUsine(j, p) {
  if (p.y >= CREUSER.y && p.y <= CREUSER.y + CREUSER.h) {
    // Extraction manuelle : jamais rentable longtemps, mais c'est par là
    // qu'on démarre — et les gants la gardent utile un moment.
    const gain = (1 + production(j) * 0.05) * mainMult(j)
    j.e.minerai += gain
    j.e.total += gain
    j.e.pulse = 1
    j.son.rebond()
    j.fx.bulle(p.x, p.y - 10, '+' + nombre(gain), C.accent, 14)
    return
  }

  const i = Math.floor((p.y - RANGEE_Y) / (RANGEE_H + 4))
  if (i < 0 || i >= MACHINES.length || p.y < RANGEE_Y) return
  const prix = cout(j, i)
  if (j.e.minerai < prix) return j.son.rate()

  j.e.minerai -= prix
  j.e.n[i]++
  j.son.niveau()
  j.fx.eclat(180, RANGEE_Y + i * (RANGEE_H + 4) + RANGEE_H / 2, MACHINES[i].couleur, { n: 12, vitesse: 140 })
  ecrit(j)
}

// --- Vue atelier -------------------------------------------------------------

const AME_Y = 190
const AME_H = 44
const FONTE = { y: 560, h: 60 }

function vueAtelier(j, ctx) {
  // On ne montre que ce qui est à portée : la liste entière découragerait.
  const liste = visibles(j)
  liste.forEach((a, i) => {
    const y = AME_Y + i * (AME_H + 5)
    const prise = j.e.ame.includes(a.id)
    const possible = !prise && j.e.minerai >= a.cout
    rect(ctx, 16, y, 328, AME_H, C.panneau)
    rect(ctx, 16, y, 4, AME_H, prise ? C.vert : possible ? C.accent : C.bord)
    ctx.textAlign = 'left'
    texte(ctx, a.nom, 32, y + 15, 14, prise ? C.faible : C.texte, 700, 200)
    texte(ctx, a.dit, 32, y + 33, 12, prise ? C.vert : C.faible, 700, 200)
    ctx.textAlign = 'right'
    texte(ctx, prise ? 'ACQUIS' : nombre(a.cout), 336, y + 23, 13, prise ? C.vert : possible ? C.accent : C.bord, 700)
    ctx.textAlign = 'center'
  })
  if (!liste.length) texte(ctx, 'rien de neuf à forger pour l’instant', j.W / 2, 260, 13, C.bord, 700)

  const gain = lingotsSi(j)
  rect(ctx, 16, FONTE.y, 328, FONTE.h, C.panneau)
  cadre(ctx, 16, FONTE.y, 328, FONTE.h, gain > 0 ? C.rouge : C.bord)
  texte(ctx, 'TOUT REFONDRE', j.W / 2, FONTE.y + 22, 17, gain > 0 ? C.rouge : C.bord, 700)
  texte(
    ctx,
    gain > 0 ? `+${gain} lingots · repart de zéro` : `il faut ${nombre(coutProchainLingot(j))} extraits en tout`,
    j.W / 2,
    FONTE.y + 44,
    12,
    C.faible,
    700,
    300
  )
}

function appuiAtelier(j, p) {
  const liste = visibles(j)
  const i = Math.floor((p.y - AME_Y) / (AME_H + 5))
  if (i >= 0 && i < liste.length && p.y >= AME_Y) {
    const a = liste[i]
    if (j.e.ame.includes(a.id) || j.e.minerai < a.cout) return j.son.rate()
    j.e.minerai -= a.cout
    j.e.ame.push(a.id)
    j.son.record()
    j.fx.eclat(180, AME_Y + i * (AME_H + 5) + AME_H / 2, C.accent, { n: 16, vitesse: 160 })
    ecrit(j)
    return
  }

  if (p.y >= FONTE.y && p.y <= FONTE.y + FONTE.h) {
    const gain = lingotsSi(j)
    if (gain <= 0) return j.son.rate()
    // La refonte : on perd tout sauf les lingots, qui rendent la remontée
    // beaucoup plus rapide. C'est ce qui fait tenir un incrémental.
    j.e.lingots += gain
    j.e.fontes++
    j.e.minerai = 0
    j.e.total = 0
    j.e.n = MACHINES.map(() => 0)
    j.e.ame = []
    j.e.vue = 'usine'
    j.son.record()
    j.fx.secoue(10)
    j.fx.eclat(j.W / 2, 300, C.accent, { n: 40, vitesse: 280 })
    ecrit(j)
  }
}

/** Les trois prochaines améliorations abordables, pas la liste entière. */
function visibles(j) {
  const reste = AMELIORATIONS.filter((a) => !j.e.ame.includes(a.id))
  return reste.slice(0, 6)
}

// --- Calculs -----------------------------------------------------------------

const prise = (j, id) => j.e.ame.includes(id)

function multiplicateur(j, i) {
  return AMELIORATIONS.filter((a) => a.cible === i && prise(j, a.id)).reduce((m, a) => m * a.facteur, 1)
}

function global(j) {
  const ame = AMELIORATIONS.filter((a) => a.global && prise(j, a.id)).reduce((m, a) => m * a.global, 1)
  return ame * (1 + j.e.lingots * 0.05)
}

const mainMult = (j) => AMELIORATIONS.filter((a) => a.main && prise(j, a.id)).reduce((m, a) => m * a.main, 1)

const production = (j) =>
  MACHINES.reduce((s, m, i) => s + m.prod * j.e.n[i] * multiplicateur(j, i), 0) * global(j)

const cout = (j, i) => Math.floor(MACHINES[i].cout * Math.pow(MACHINES[i].taux, j.e.n[i]))

/** Les lingots suivent la racine cubique du minerai extrait depuis la dernière fonte. */
const lingotsSi = (j) => Math.max(0, Math.floor(Math.cbrt(j.e.total / SEUIL_LINGOT)))
const coutProchainLingot = (j) => Math.pow(lingotsSi(j) + 1, 3) * SEUIL_LINGOT

function ecrit(j) {
  j.sauve({
    minerai: j.e.minerai,
    n: j.e.n,
    ame: j.e.ame,
    total: j.e.total,
    lingots: j.e.lingots,
    fontes: j.e.fontes,
    quand: Date.now(),
  })
}

/** 1.2k, 34.5M… sinon les grands nombres débordent de l'écran. */
function nombre(v) {
  if (v < 1000) return v < 10 ? v.toFixed(1) : String(Math.floor(v))
  const suffixes = ['k', 'M', 'G', 'T', 'P', 'E', 'Z']
  let i = -1
  while (v >= 1000 && i < suffixes.length - 1) {
    v /= 1000
    i++
  }
  return v.toFixed(v < 10 ? 2 : 1) + suffixes[i]
}
