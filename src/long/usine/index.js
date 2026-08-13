import { C, ton } from '../../palette.js'
import { texte, rect, lueur, borne } from '../../dessin.js'
import { MACHINES, RECHERCHES, CONTRATS } from './donnees.js'
import * as D from './dispo.js'
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
  // Un incrémental se joue à deux endroits en même temps : la scène qui montre
  // ce qu'on a bâti, et la liste où on l'achète. Debout ils se partagent la
  // hauteur et sont tous deux à l'étroit ; couché, chacun tient une moitié de
  // l'écran et on les voit ensemble — c'est là que ce jeu est chez lui.
  paysage: true,
  confort: 'paysage',
  // Pas de `ciel` : la scène peint le sien, et il change avec l'heure. Deux
  // dégradés tramés l'un sur l'autre ne font pas un ciel, ils font du bruit.

  // Le bandeau porte le compteur **depuis toujours** : celui qui ne retombe
  // jamais, pas même à la refonte. C'est le seul chiffre qui dise ce qu'on a
  // fait de cette usine en entier, et il n'a rien à faire au milieu de l'écran
  // où l'on regarde ce qu'on peut dépenser tout de suite.
  titreHud: (j) => `${L.nombre(j.e.jamais ?? j.e.total)} EN TOUT`,

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

  /**
   * L'écran a tourné. Le défilement d'un gabarit ne veut rien dire dans
   * l'autre — la fenêtre n'a pas la même hauteur, et un défilement conservé
   * pointerait au milieu de nulle part. On remonte en haut de liste, et on
   * oublie le doigt en cours : il a été posé sur des coordonnées qui
   * n'existent plus.
   */
  redim(j) {
    j.e.defile = 0
    j.e.drag = null
  },

  maj(j, dt) {
    const d = D.dispo(j)
    j.e.coup = Math.max(0, j.e.coup - dt * 3)
    if (j.e.avis) {
      j.e.avis.reste -= dt
      if (j.e.avis.reste <= 0) j.e.avis = null
    }

    // Le défilement suit le doigt tant qu'il est posé.
    if (j.e.drag && j.maintenu) {
      const dy = j.pointer.y - j.e.drag.y
      if (Math.abs(dy) > GLISSE) j.e.drag.bouge = true
      if (j.e.drag.bouge)
        j.e.defile = borne(j.e.drag.depart - dy, 0, Math.max(0, hauteurVue(j.e) - D.fenetreDe(d, j.e.vue)))
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
        if (reussi) j.fx.eclat(d.ligne.centre, d.liste.y + 50, C.vert, { n: 24, vitesse: 220 })
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
    const d = D.dispo(j)
    const en = d.entete
    // Et la scène porte la caisse : ce qu'on a là, maintenant, à dépenser.
    // Les deux affichaient le même nombre, ce qui donnait deux compteurs pour
    // une seule information. Pas de libellé ici : la ligne sous le chiffre est
    // déjà prise par le débit, et le bandeau dit « EN TOUT », ce qui suffit à
    // distinguer les deux.
    texte(ctx, L.nombre(e.minerai), en.cx, en.y, 30, C.texte, 700, en.max)
    ctx.textAlign = 'left'
    const rythme = `${L.nombre(L.production(e))} / s`
    texte(ctx, rythme, en.gauche, en.yBas, 13, e.boost > 0 ? C.vert : C.faible, 700, en.prod)
    ctx.textAlign = 'right'
    if (e.lingots) {
      const dit = `${e.lingots} lingots · tout ×${L.nombre(L.global(e))}`
      texte(ctx, dit, en.droite, en.yBas, 12, C.accent, 700, en.lingots)
    }
    ctx.textAlign = 'center'

    S.dessine(j, ctx, d)
    // Couché, une règle sépare l'atelier de la liste : sans elle, les deux
    // moitiés flottent dans le même noir.
    if (d.separateur) rect(ctx, d.separateur.x, d.separateur.y, d.separateur.w, d.separateur.h, C.bord)
    V.dessineOnglets(j, ctx, d)

    if (e.vue === 'usine') V.dessineUsine(j, ctx, d)
    else if (e.vue === 'atelier') V.dessineAtelier(j, ctx, d)
    else if (e.vue === 'recherche') V.dessineRecherche(j, ctx, d)
    else V.dessineContrats(j, ctx, d)

    // Un bandeau d'annonce, posé sur la scène : une panne ou une recherche
    // trouvée pendant qu'on regardait un autre onglet ne doit pas passer inaperçue.
    const a = d.avis
    if (e.avis) {
      ctx.globalAlpha = Math.min(1, e.avis.reste * 2)
      lueur(ctx, a.x, a.y, a.w, a.h, e.avis.couleur, 3, 0.7)
      rect(ctx, a.x, a.y, a.w, a.h, ton(C.fond, 0.15))
      texte(ctx, e.avis.texte, a.x + a.w / 2, a.y + 11, 12, e.avis.couleur, 700, a.w - 12)
      ctx.globalAlpha = 1
    } else if (e.horsLigne > 1 && j.t < 8) {
      const dit = `pendant ton absence : +${L.nombre(e.horsLigne)}`
      texte(ctx, dit, a.x + a.w / 2, a.y + 11, 12, C.accent, 700, a.w - 12)
    }
  },

  appui(j, p) {
    const d = D.dispo(j)
    // La scène et les onglets répondent au doigt qui se pose : ils ne défilent
    // pas, donc rien ne justifierait d'attendre.
    const onglet = V.ongletTouche(d, p)
    if (onglet) {
      if (onglet !== j.e.vue) j.e.defile = 0
      j.e.vue = onglet
      return j.son.clic()
    }
    if (!D.dansListe(d, p)) return appuiScene(j, p, d)

    // Dans la liste, on décide au relâchement : sinon un défilement achète.
    j.e.drag = { y: p.y, depart: j.e.defile, bouge: false }
  },

  relache(j, p) {
    const d = D.dispo(j)
    const drag = j.e.drag
    j.e.drag = null
    if (!drag || drag.bouge || !D.dansListe(d, p)) return
    if (j.e.vue === 'usine') V.appuiUsine(j, p, d)
    else if (j.e.vue === 'atelier') V.appuiAtelier(j, p, d)
    else if (j.e.vue === 'recherche') V.appuiRecherche(j, p, d)
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
function appuiScene(j, p, d) {
  for (const z of S.zones(j)) {
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
    if (L.enPanne(j.e, z.i)) return V.repare(j, z.i, d)
    // Une machine en marche qu'on tapote : elle ne fait rien, mais elle le dit.
    j.son.clic()
    j.fx.bulle(z.x + z.w / 2, z.y - 6, MACHINES[z.i].nom, MACHINES[z.i].couleur, 11)
    return
  }
}
