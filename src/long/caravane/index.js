/**
 * CARAVANE — commerce sur un réseau de marchés, distinct d'EXPÉDITION.
 *
 * EXPÉDITION est un couloir : une jauge de survie qui descend, un point
 * d'arrivée. CARAVANE est un graphe — neuf marchés, quatorze routes — et rien
 * n'y meurt jamais d'une jauge à zéro. Le risque est financier (l'entretien de
 * la flotte impayé mène à la banqueroute) et logistique (vol ou taxe sur un
 * trajet, selon son risque déclaré). L'intérêt du jeu est ailleurs : acheter
 * là où c'est abondant, vendre là où ça manque, et regarder les prix locaux
 * dériver — chaque achat pousse un prix, chaque vente le tire, et le temps
 * les ramène doucement vers leur niveau normal, que la borne soit ouverte ou
 * non (`L.credite`, comme dans `usine`).
 */
import { C } from '../../palette.js'
import { MARCHES, LOT_ECHANGE } from './donnees.js'
import * as L from './logique.js'
import * as V from './vues.js'
import * as D from './dispo.js'

const texteIncident = (inc) =>
  inc.type === 'vol' ? `PILLÉ EN ROUTE : ${inc.perte} unités perdues` : `TAXÉ EN ROUTE : ${L.nombre(inc.perte)} or`

function avis(j, texte, couleur) {
  j.e.avis = { texte, couleur, reste: 3.5 }
}

export default {
  id: 'caravane',
  nom: 'CARAVANE',
  pitch: 'Achète bas, vends haut, ne te fais pas voler en chemin',
  couleur: C.accent,
  unite: 'OR',
  persistant: true,

  init(j) {
    const e = L.migre(j.charge()) ?? L.neuf()
    Object.assign(j.e, e)
    j.e.vue = 'marche'
    j.e.avis = null
    j.e.depuisSauve = 0

    // Le temps a continué de tourner sans nous : la conjoncture a dérivé, et
    // un trajet en cours a pu s'achever, incident compris.
    const ev = L.credite(j.e, j.hasard)
    if (ev.banqueroute) avis(j, 'BANQUEROUTE : une charrette saisie', C.rouge)
    else if (ev.incident) avis(j, texteIncident(ev.incident), C.rouge)
    else if (ev.ecoule > 30) avis(j, `pendant ton absence, le marché a bougé`, C.faible)

    j.score = Math.floor(L.patrimoine(j.e))
  },

  dessine(j, ctx) {
    const d = D.dispo(j)
    V.dessine(ctx, d, j, j.e)
  },

  maj(j, dt) {
    const e = j.e
    if (e.avis) {
      e.avis.reste -= dt
      if (e.avis.reste <= 0) e.avis = null
    }

    const ev = L.avance(e, dt, j.hasard)
    if (ev.banqueroute) {
      j.son.rate()
      avis(j, 'BANQUEROUTE : une charrette saisie', C.rouge)
    } else if (ev.incident) {
      j.son.rate()
      avis(j, texteIncident(ev.incident), C.rouge)
      j.fx.eclat(j.W / 2, j.H / 2 - 40, C.rouge, { n: 16, vitesse: 160 })
    }

    j.score = Math.floor(L.patrimoine(e))
    e.depuisSauve += dt
    if (e.depuisSauve > 3) {
      e.depuisSauve = 0
      j.sauve(L.sauvegarde(e))
    }
  },

  quitte: (j) => j.sauve(L.sauvegarde(j.e)),

  appui(j, p) {
    const e = j.e
    const d = D.dispo(j)

    const onglet = V.ongletTouche(d, p)
    if (onglet) {
      e.vue = onglet
      return j.son.clic()
    }

    if (e.vue === 'marche') {
      const geste = V.appuiMarche(j, p, d, e)
      if (!geste) return
      if (geste.action === 'achat') {
        const r = L.achete(e, geste.g, LOT_ECHANGE)
        if (r.qte > 0) {
          j.son.clic()
          j.fx.bulle(j.W / 2, D.dispo(j).corps.y - 4, `-${r.cout} or`, C.rouge, 13)
        } else j.son.rate()
      } else {
        const r = L.vend(e, geste.g, LOT_ECHANGE)
        if (r.qte > 0) {
          j.son.touche(4)
          j.fx.bulle(j.W / 2, D.dispo(j).corps.y - 4, `+${r.gain} or`, C.vert, 13)
        } else j.son.rate()
      }
    } else if (e.vue === 'route') {
      const vers = V.appuiRoute(j, p, d, e)
      if (vers === null) return
      if (L.partir(e, vers)) {
        j.son.clic()
        avis(j, `en route vers ${MARCHES[vers].nom}`, C.cyan)
      } else j.son.rate()
    } else {
      if (!V.appuiFlotte(j, p, d, e)) return
      if (L.acheteCharrette(e)) {
        j.son.record()
        j.fx.eclat(j.W / 2, D.dispo(j).boutonCharrette.y + 20, C.accent, { n: 18, vitesse: 180 })
      } else j.son.rate()
    }

    j.score = Math.floor(L.patrimoine(e))
    j.sauve(L.sauvegarde(e))
  },
}
