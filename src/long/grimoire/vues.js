import { C } from '../../palette.js'
import { texte, rect, cadre, bloc, pastille, lueur } from '../../dessin.js'
import { COULEUR_TYPE, ENERGIE_BASE } from './donnees.js'
import * as L from './logique.js'
import { zoneCarte } from './dispo.js'

/** Le résumé chiffré d'une carte, dans l'ordre où un joueur soupèse un choix :
 * ce qu'elle fait tout de suite, puis ce qu'elle installe pour plus tard. */
export function resumeCarte(carte) {
  const b = []
  if (carte.degats) b.push(`${carte.degats}${carte.fois > 1 ? ` ×${carte.fois}` : ''} DÉG.`)
  if (carte.bloc) b.push(`${carte.bloc} BLOC`)
  if (carte.soin) b.push(`+${carte.soin} PV`)
  if (carte.recul) b.push(`-${carte.recul} PV`)
  if (carte.pioche) b.push(`PIOCHE ${carte.pioche}`)
  if (carte.energieBonus) b.push(`+${carte.energieBonus} ÉNER.`)
  if (carte.force) b.push(`+${carte.force} FORCE`)
  if (carte.fragile) b.push(`FRAGILE ${carte.fragile}`)
  if (carte.vulnerable) b.push(`VULN. ${carte.vulnerable}`)
  if (carte.faible) b.push(`FAIBLE ${carte.faible}`)
  if (carte.poison) b.push(`POISON ${carte.poison}`)
  if (carte.comboParCarte) b.push(`+${carte.comboParCarte}/CARTE`)
  if (carte.finisseur) b.push(`+${carte.finisseurBonus} SI <30%`)
  if (carte.defausseMain) b.push('DÉFAUSSE LA MAIN')
  return b.join(' · ')
}

/** Ce que l'adversaire s'apprête à faire — visible avant qu'il ne le fasse,
 * pour que jouer un bloc ou une pioche soit une vraie décision. */
function intentionDe(co) {
  const coup = co.pattern[co.tour % co.pattern.length]
  if (coup.type === 'attaque') {
    const d = Math.round((co.attaque + co.forceEnnemi) * coup.mult)
    return { texte: `ATTAQUE ~${d}`, couleur: C.rouge }
  }
  if (coup.type === 'buff') return { texte: 'SE RENFORCE', couleur: C.violet }
  if (coup.type === 'soin') return { texte: 'SE SOIGNE', couleur: C.vert }
  return { texte: 'SE PROTÈGE', couleur: C.cyan }
}

function carteRect(ctx, z, carte, ouverte, accent) {
  rect(ctx, z.x, z.y, z.w, z.h, C.panneau)
  cadre(ctx, z.x, z.y, z.w, z.h, ouverte ? (accent ?? COULEUR_TYPE[carte.type]) : C.bord)
  ctx.textAlign = 'center'
  const cx = z.x + z.w / 2
  pastille(ctx, z.x + 12, z.y + 12, 8, ouverte ? COULEUR_TYPE[carte.type] : C.bord)
  texte(ctx, String(carte.cout), z.x + 12, z.y + 13, 10, C.fond, 700)
  texte(ctx, carte.nom, cx, z.y + 30, 11, ouverte ? C.texte : C.faible, 700, z.w - 10)
  lignesCarte(ctx, resumeCarte(carte), cx, z.y + 50, z.w - 10, 9, ouverte ? C.faible : C.bord)
}

/** Découpe le résumé d'une carte sur plusieurs lignes, centrées, sans déborder. */
function lignesCarte(ctx, phrase, cx, y, large, taille, couleur) {
  const mots = phrase.split(' ')
  let ligne = ''
  let n = 0
  for (const mot of mots) {
    const essai = ligne ? ligne + ' ' + mot : mot
    ctx.font = `700 ${taille}px ui-monospace, monospace`
    if (ctx.measureText(essai).width > large && ligne) {
      texte(ctx, ligne, cx, y + n * (taille + 4), taille, couleur, 700, large)
      n++
      ligne = mot
    } else ligne = essai
  }
  if (ligne) texte(ctx, ligne, cx, y + n * (taille + 4), taille, couleur, 700, large)
}

export function dessine(ctx, d, j, s) {
  const run = s.run
  ctx.textAlign = 'left'
  texte(ctx, `COMBAT ${run.profondeur + 1}`, 20, 78, 14, C.faible, 700)
  ctx.textAlign = 'right'
  texte(ctx, `${L.tailleDeck(run)} CARTES · ${s.meta.victoires} VICTOIRES`, j.W - 20, 78, 11, C.faible, 700, 220)
  ctx.textAlign = 'center'

  if (run.phase === 'combat') dessineCombat(ctx, d, j, run)
  else dessineRecompense(ctx, d, j, run)
}

function barre(ctx, x, y, w, h, v, vMax, couleur) {
  rect(ctx, x, y, w, h, C.panneau)
  if (v > 0 && vMax > 0) bloc(ctx, x, y, w * Math.min(1, v / vMax), h, couleur, 2)
}

function dessineCombat(ctx, d, j, run) {
  const co = run.combat
  const e = d.ennemi

  rect(ctx, e.x, e.y, e.w, e.h, C.panneau)
  cadre(ctx, e.x, e.y, e.w, e.h, C.bord)
  ctx.textAlign = 'left'
  texte(ctx, co.nom, e.x + 12, e.y + 20, 16, C.texte, 700, e.w - 90)
  ctx.textAlign = 'right'
  const intent = intentionDe(co)
  texte(ctx, intent.texte, e.x + e.w - 12, e.y + 20, 11, intent.couleur, 700, 110)
  ctx.textAlign = 'left'
  barre(ctx, e.x + 12, e.y + 32, e.w - 24, 10, co.pv, co.pvMax, C.rouge)
  texte(ctx, `${Math.max(0, Math.round(co.pv))} / ${co.pvMax}`, e.x + 12, e.y + 58, 11, C.faible, 700)

  const badges = []
  if (co.forceEnnemi) badges.push([`FORCE ${co.forceEnnemi}`, C.violet])
  if (co.vulnerableEnnemi) badges.push([`VULN. ${co.vulnerableEnnemi}`, C.rouge])
  if (co.faibleEnnemi) badges.push([`FAIBLE ${co.faibleEnnemi}`, C.cyan])
  if (co.poisonEnnemi) badges.push([`POISON ${co.poisonEnnemi}`, C.vert])
  if (co.blocEnnemi) badges.push([`BLOC ${co.blocEnnemi}`, C.cyan])
  badges.forEach(([texteBadge, couleur], i) => texte(ctx, texteBadge, e.x + 12 + i * 74, e.y + 78, 9, couleur, 700, 72))

  // Le joueur : force/fragile/bloc et l'énergie du tour, sur une seule ligne.
  const p = d.joueur
  ctx.textAlign = 'left'
  const soi = []
  if (co.forceJoueur) soi.push([`FORCE ${co.forceJoueur}`, C.violet])
  if (co.fragileJoueur) soi.push([`FRAGILE ${co.fragileJoueur}`, C.rouge])
  if (co.bloc) soi.push([`BLOC ${co.bloc}`, C.cyan])
  soi.forEach(([texteBadge, couleur], i) => texte(ctx, texteBadge, p.x + i * 74, p.y + 10, 10, couleur, 700, 72))

  ctx.textAlign = 'right'
  for (let i = 0; i < Math.max(ENERGIE_BASE, run.energie); i++) {
    pastille(ctx, p.x + p.w - 10 - i * 16, p.y + 6, 6, i < run.energie ? C.accent : C.panneau)
  }
  ctx.textAlign = 'left'
  texte(ctx, `${Math.floor(run.pv)} / ${run.pvMax} PV`, p.x, p.y + 24, 12, run.pv < run.pvMax * 0.3 ? C.rouge : C.texte, 700)

  const main = L.mainDe(run)
  main.forEach((carte, i) => {
    const z = zoneCarte(d, j, i, Math.max(1, main.length))
    const ouverte = L.estJouable(run, carte)
    carteRect(ctx, z, carte, ouverte)
  })

  const f = d.finTour
  rect(ctx, f.x, f.y, f.w, f.h, C.panneau)
  cadre(ctx, f.x, f.y, f.w, f.h, C.accent)
  ctx.textAlign = 'center'
  texte(ctx, 'FIN DE TOUR', f.x + f.w / 2, f.y + f.h / 2 + 4, 11, C.accent, 700)

  if (run.pv < run.pvMax * 0.3) lueur(ctx, p.x, p.y, p.w, 20, C.rouge, 2, 0.5)
}

function dessineRecompense(ctx, d, j, run) {
  ctx.textAlign = 'center'
  texte(ctx, 'CHOISIS UNE CARTE', j.W / 2, d.ennemi.y + 40, 18, C.accent, 700)
  texte(ctx, 'ou passe ton tour de récompense : un deck léger reste un choix', j.W / 2, d.ennemi.y + 64, 11, C.faible, 700, j.W - 60)

  const options = [...run.recompense.map((id) => L.carteDe(id)), null]
  options.forEach((carte, i) => {
    const z = zoneCarte(d, j, i, options.length)
    if (!carte) {
      rect(ctx, z.x, z.y, z.w, z.h, C.panneau)
      cadre(ctx, z.x, z.y, z.w, z.h, C.bord)
      texte(ctx, 'AUCUNE', z.x + z.w / 2, z.y + z.h / 2 + 4, 11, C.faible, 700, z.w - 10)
      return
    }
    carteRect(ctx, z, carte, true, C.accent)
  })
}
