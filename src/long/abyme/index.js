/**
 * ABYME — un roguelite au tour par tour, successeur pensé de DONJON.
 *
 * DONJON reposait sur de l'équipement plat (+X dégâts/armure), menait
 * toujours vers le même stuff optimal, et n'avait jamais été mesuré. Ici, les
 * reliques changent des règles — voir `donnees.js` — et `logique.js` tourne
 * entièrement sous `node --test`, hasard compris : c'est ce qui a permis de
 * mesurer l'équilibre au banc plutôt que de le deviner.
 *
 * La descente en cours vit dans `j.sauve()/j.charge()` (persistant : on peut
 * fermer l'appli entre deux étages). La méta-progression — les ossements
 * ramenés d'une mort à l'autre, qui débloquent des reliques — survit elle à
 * `j.efface()` : elle passe par `stockage.js`, comme le fait déjà BRÈCHE pour
 * ses records.
 */
import { C } from '../../palette.js'
import { lis, ecris } from '../../stockage.js'
import { RELIQUES, MONSTRES } from './donnees.js'
import * as L from './logique.js'
import * as V from './vues.js'
import { dispo, dansZone } from './dispo.js'

const CLE_META = 'abyme.meta'
const metaVide = { ossements: 0, morts: 0, profondeurMax: 0 }

const litMeta = () => {
  try {
    return { ...metaVide, ...JSON.parse(lis(CLE_META, '{}')) }
  } catch {
    return { ...metaVide }
  }
}
const ecritMeta = (m) => ecris(CLE_META, JSON.stringify(m))

export default {
  id: 'abyme',
  nom: 'ABYME',
  pitch: 'Descends. Les reliques changent la partie, pas seulement les chiffres',
  couleur: C.violet,
  unite: 'étages',
  persistant: true,

  init(j) {
    const meta = litMeta()
    j.e.meta = meta
    const brut = L.migre(j.charge())
    const e = brut ?? L.neuf(j.hasard, L.reliquesDeMeta(meta.ossements))
    j.e.e = e
    j.e.dernier = e.profondeur > 1 ? 'tu poursuis la descente' : 'tu descends dans l’Abyme'
    j.score = e.profondeur
  },

  dessine(j, ctx) {
    V.dessine(ctx, dispo(j), j, j.e.e)
  },

  appui(j, p) {
    const e = j.e.e
    if (e.fin) return
    const d = dispo(j)

    if (e.offre) {
      const i = e.offre.findIndex((_, k) => dansZone(p, d.offre[k]))
      if (i < 0) return
      const id = e.offre[i]
      L.choisis(e, id, j.hasard)
      j.son.record()
      j.fx.eclat(j.W / 2, d.grille.y + d.grille.h / 2, C.violet, { n: 22, vitesse: 210 })
      j.e.dernier = `relique : ${RELIQUES.find((r) => r.id === id)?.nom}`
      return j.sauve(e)
    }

    const dir = Object.keys(d.dpad).find((k) => dansZone(p, d.dpad[k]))
    if (!dir) return

    const ev = L.tour(e, dir, j.hasard)
    reagit(j, e, ev)

    if (e.fin) {
      const meta = j.e.meta
      meta.ossements += L.ossements(e)
      meta.morts += 1
      meta.profondeurMax = Math.max(meta.profondeurMax, e.profondeur)
      ecritMeta(meta)
      j.score = e.profondeur
      j.efface()
      return j.perdu()
    }
    j.sauve(e)
  },
}

function reagit(j, e, ev) {
  if (ev.bloque) {
    j.son.rate()
    j.e.dernier = 'un mur, infranchissable'
    return
  }
  if (ev.esquive) {
    j.son.rate()
    j.e.dernier = 'il esquive ton coup'
  }
  if (ev.tues) {
    j.son.record()
    j.e.dernier = `${MONSTRES[ev.tueType]?.nom ?? 'ennemi'} vaincu`
  } else if (ev.tir || ev.sacrifice) {
    j.son.touche(5)
    j.e.dernier = 'un tir en pleine ligne'
  } else if (ev.traverse) {
    j.son.clic()
    j.e.dernier = 'tu traverses le mur'
  } else if (ev.piege) {
    j.son.rate()
    j.e.dernier = ev.ralenti ? 'un piège te ralentit' : 'un piège te blesse'
  } else if (ev.repos) {
    j.son.clic()
    j.e.dernier = 'tu reprends ton souffle'
  } else if (ev.echoDevore) {
    j.son.record()
    j.e.dernier = 'ton écho se change en vie'
  } else if (ev.ralentiJoue) {
    j.e.dernier = 'tu titubes encore'
  }
  if (ev.allieInvoque) j.e.dernier = 'un allié rejoint ta cause'
  if (ev.degatsSubis) {
    j.son.rate()
    j.fx.secoue(3 + Math.min(6, ev.degatsSubis))
  }
  if (ev.sauve) {
    j.son.record()
    j.e.dernier = 'tu survis de justesse'
  }
  if (ev.etageFranchi) {
    j.son.niveau()
    j.fx.eclat(j.W / 2, j.H / 2, C.violet, { n: 26, vitesse: 220 })
  }
  if (ev.mort) {
    j.son.rate()
    j.fx.secoue(9)
    j.e.dernier = 'l’Abyme te retient'
  }
}
