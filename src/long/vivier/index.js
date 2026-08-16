/**
 * VIVIER — un bassin qui vit tout seul.
 *
 * Les cinq autres jeux longs de cette série sont portés par le combat ou par
 * une optimisation économique agressive. Celui-ci n'a ni l'un ni l'autre :
 * aucune jauge ne peut tomber à zéro et faire perdre, personne ne meurt,
 * personne n'attaque. Le bassin pond tout seul, même la borne éteinte — la
 * même promesse que le crédit hors ligne d'USINE — et la seule chose à faire
 * est de regarder ce qui en sort, et de le nourrir de temps en temps pour
 * accélérer un peu, jamais pour éviter un malheur.
 */
import { C } from '../../palette.js'
import { TOTAL_COMBOS } from './donnees.js'
import * as L from './logique.js'
import * as V from './vues.js'
import { dispo, dans, creatureIndexDe, caseIndexDe } from './dispo.js'

export default {
  id: 'vivier',
  nom: 'VIVIER',
  pitch: 'Un bassin qui vit tout seul. Croise, observe, complète la collection.',
  couleur: C.rouge,
  unite: 'découvertes',
  persistant: true,

  init(j) {
    const e = L.migre(j.charge()) ?? L.neuf()
    j.e = e
    j.e.depuisSauve = 0
    j.e.horsLigne = L.credite(e, Date.now(), j.hasard)
    j.score = e.decouvertes.length
  },

  maj(j, dt) {
    const ev = {}
    L.avance(j.e, dt, j.hasard, ev)
    if (ev.decouverte) {
      j.score = j.e.decouvertes.length
      j.son.record()
      j.fx.eclat(j.W / 2, j.H / 2, C.rouge, { n: 20, vitesse: 180 })
      if (j.e.decouvertes.length >= TOTAL_COMBOS) j.son.niveau()
    } else if (ev.ne) {
      j.son.clic()
    }

    j.e.depuisSauve += dt
    if (j.e.depuisSauve > 4) {
      j.e.depuisSauve = 0
      j.sauve(L.sauvegarde(j.e))
    }
  },

  quitte: (j) => j.sauve(L.sauvegarde(j.e)),

  dessine(j, ctx) {
    const d = dispo(j)
    V.dessine(ctx, d, j, j.e)
  },

  appui(j, p) {
    const d = dispo(j)

    if (dans(p, d.bouton)) {
      if (L.nourrir(j.e)) {
        j.son.clic()
        j.fx.bulle(j.W / 2, d.bouton.y - 6, '+ NOURRITURE', C.rouge, 13)
      } else {
        j.son.rate()
      }
      return
    }

    const ic = creatureIndexDe(d, p)
    if (ic >= 0 && ic < j.e.bassin.length) {
      const phen = L.phenotype(j.e.bassin[ic].genotype)
      j.son.clic()
      j.fx.bulle(p.x, p.y - 16, V.nomDe(phen), C.faible, 11)
      return
    }

    const igc = caseIndexDe(d, p)
    if (igc >= 0) {
      const phen = L.comboDeIndex(igc)
      if (!j.e.decouvertes.includes(L.comboId(phen))) return j.son.rate()
      j.son.clic()
      j.fx.bulle(p.x, p.y - 16, V.nomDe(phen), C.rouge, 11)
    }
  },
}
