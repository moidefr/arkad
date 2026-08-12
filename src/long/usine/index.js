import { C, ton } from '../../palette.js'
import { texte, rect, lueur, borne } from '../../dessin.js'
import { MACHINES, RECHERCHES, CONTRATS } from './donnees.js'
import * as L from './logique.js'
import * as S from './scene.js'
import * as V from './vues.js'

const GLISSE = 8 // au-delà, c'est un défilement, pas un appui

export default {
  id: 'usine',
  nom: 'USINE',
  pitch: 'Elle tourne même quand tu n’es pas là. Puis on refond tout',
  couleur: C.violet,
  unite: '',
  persistant: true,
  sansScore: true,
  // Pas de `ciel` : la scène peint le sien, et il change avec l'heure. Deux
  // dégradés tramés l'un sur l'autre ne font pas un ciel, ils font du bruit.

  titreHud: (j) => L.nombre(j.e.minerai),

  init(j) {
    const etat = L.migre(j.charge()) ?? L.neuve()
    Object.assign(j.e, etat)
    j.e.vue = 'usine'
    j.e.defile = 0
    j.e.coup = 0
    j.e.depuisSauve = 0
    j.e.avis = null
    j.e.horsLigne = L.credite(j.e)
  },

  maj(j, dt) {
    j.e.coup = Math.max(0, j.e.coup - dt * 3)
    if (j.e.avis) {
      j.e.avis.reste -= dt
      if (j.e.avis.reste <= 0) j.e.avis = null
    }

    // Le défilement suit le doigt tant qu'il est posé.
    if (j.e.drag && j.maintenu) {
      const d = j.pointer.y - j.e.drag.y
      if (Math.abs(d) > GLISSE) j.e.drag.bouge = true
      if (j.e.drag.bouge)
        j.e.defile = borne(j.e.drag.depart - d, 0, Math.max(0, hauteurVue(j.e) - V.fenetreDe(j.e.vue)))
    }

    L.avance(j.e, dt, j.hasard, {
      panne: (i) => {
        j.son.rate()
        avis(j, `${MACHINES[i].nom} EN PANNE`, C.rouge)
      },
      reparee: () => j.son.clic(),
      trouve: (id) => {
        j.son.record()
        avis(j, RECHERCHES.find((r) => r.id === id).nom + ' TROUVÉ', C.cyan)
      },
      contrat: (c, reussi) => {
        j.son[reussi ? 'record' : 'rate']()
        avis(j, CONTRATS[c.m].nom + (reussi ? ' LIVRÉ' : ' PERDU'), reussi ? C.vert : C.rouge)
        if (reussi) j.fx.eclat(180, 400, C.vert, { n: 24, vitesse: 220 })
      },
    })

    j.e.depuisSauve += dt
    if (j.e.depuisSauve > 3) {
      j.e.depuisSauve = 0
      j.sauve(L.sauvegarde(j.e))
    }
  },

  quitte: (j) => j.sauve(L.sauvegarde(j.e)),

  dessine(j, ctx) {
    const e = j.e
    texte(ctx, L.nombre(e.minerai), 180, 82, 30, C.texte, 700, 320)
    ctx.textAlign = 'left'
    texte(ctx, `${L.nombre(L.production(e))} / s`, 16, 104, 13, e.boost > 0 ? C.vert : C.faible, 700, 150)
    ctx.textAlign = 'right'
    if (e.lingots) {
      texte(ctx, `${e.lingots} lingots · tout ×${L.nombre(L.global(e))}`, 344, 104, 12, C.accent, 700, 180)
    }
    ctx.textAlign = 'center'

    S.dessine(j, ctx)
    V.dessineOnglets(j, ctx)

    if (e.vue === 'usine') V.dessineUsine(j, ctx)
    else if (e.vue === 'atelier') V.dessineAtelier(j, ctx)
    else if (e.vue === 'recherche') V.dessineRecherche(j, ctx)
    else V.dessineContrats(j, ctx)

    // Un bandeau d'annonce, posé sur la scène : une panne ou une recherche
    // trouvée pendant qu'on regardait un autre onglet ne doit pas passer inaperçue.
    if (e.avis) {
      const alpha = Math.min(1, e.avis.reste * 2)
      ctx.globalAlpha = alpha
      lueur(ctx, 40, 284, 280, 22, e.avis.couleur, 3, 0.7)
      rect(ctx, 40, 284, 280, 22, ton(C.fond, 0.15))
      texte(ctx, e.avis.texte, 180, 295, 12, e.avis.couleur, 700, 268)
      ctx.globalAlpha = 1
    } else if (e.horsLigne > 1 && j.t < 8) {
      texte(ctx, `pendant ton absence : +${L.nombre(e.horsLigne)}`, 180, 295, 12, C.accent, 700, 300)
    }
  },

  appui(j, p) {
    // Le haut de l'écran répond au doigt qui se pose : la scène et les onglets
    // ne défilent pas, donc rien ne justifierait d'attendre.
    const onglet = V.ongletTouche(p)
    if (onglet) {
      if (onglet !== j.e.vue) j.e.defile = 0
      j.e.vue = onglet
      return j.son.clic()
    }
    if (p.y < V.LISTE.y) return appuiScene(j, p)

    // Dans la liste, on décide au relâchement : sinon un défilement achète.
    j.e.drag = { y: p.y, depart: j.e.defile, bouge: false }
  },

  relache(j, p) {
    const d = j.e.drag
    j.e.drag = null
    if (!d || d.bouge || p.y < V.LISTE.y) return
    if (j.e.vue === 'usine') V.appuiUsine(j, p)
    else if (j.e.vue === 'atelier') V.appuiAtelier(j, p)
    else if (j.e.vue === 'recherche') V.appuiRecherche(j, p)
  },
}

function hauteurVue(e) {
  if (e.vue === 'usine') return V.hauteur(V.lignesUsine(e))
  if (e.vue === 'atelier') return V.hauteur(V.lignesAtelier(e))
  if (e.vue === 'recherche') return V.hauteur(V.lignesRecherche(e))
  return 0
}

function avis(j, texteAvis, couleur) {
  j.e.avis = { texte: texteAvis, couleur, reste: 3.5 }
}

/** La scène est jouable : on frappe la paroi, on répare les machines. */
function appuiScene(j, p) {
  for (const z of S.zones(j.e)) {
    if (p.x < z.x || p.x > z.x + z.w || p.y < z.y || p.y > z.y + z.h) continue
    if (z.quoi === 'roche') {
      const gain = L.gainMain(j.e)
      j.e.minerai += gain
      j.e.total += gain
      j.e.coup = 1
      j.son.rebond()
      j.fx.bulle(z.x + z.w + 14, p.y - 8, '+' + L.nombre(gain), C.accent, 14)
      return
    }
    if (L.enPanne(j.e, z.i)) return V.repare(j, z.i)
    // Une machine en marche qu'on tapote : elle ne fait rien, mais elle le dit.
    j.son.clic()
    j.fx.bulle(z.x + z.w / 2, z.y - 6, MACHINES[z.i].nom, MACHINES[z.i].couleur, 11)
    return
  }
}
