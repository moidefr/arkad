/**
 * FRONT — une compagnie qu'on garde, un terrain qui décide.
 *
 * Un jeu de stratégie militaire au tour par tour sur grille hexagonale. Les
 * troupes sont **persistantes** : elles montent en niveau, en grade, et
 * quand elles tombent sur un champ perdu, elles ne rentrent pas.
 *
 * Ce fichier ne fait que router les écrans et traduire les gestes. Toute la
 * règle vit dans `front/`, qui n'importe ni canvas ni stockage et tourne sous
 * `node --test` — c'est ce qui a permis de mesurer cent batailles complètes
 * avant d'en dessiner une seule.
 *
 * Les trois décisions d'ergonomie, prises contre le jeu massif précédent que
 * son auteur a jugé « pas pratique » :
 *   — on fait glisser la carte au doigt, et un geste de plus de dix pixels
 *     n'est jamais pris pour un appui ;
 *   — la moitié basse de l'écran ne montre **que** ce qui est jouable tout de
 *     suite, et la main n'en sort pas ;
 *   — avant de frapper, on lit les dégâts exacts et la riposte exacte, parce
 *     que la résolution n'a aucun aléa.
 */
import { C } from '../palette.js'
import { rect, texte } from '../dessin.js'
import { lis, ecris } from '../stockage.js'
import { cle } from './front/hex.js'
import * as B from './front/bataille.js'
import * as IA from './front/ia.js'
import * as Cie from './front/compagnie.js'
import * as U from './front/unites.js'
import * as V from './front/ville.js'
import { APT } from './front/donnees/aptitudes.js'
import * as VC from './front/vue/champ.js'
import * as VB from './front/vue/bataille.js'
import * as VM from './front/vue/menus.js'
import * as VD from './front/vue/dispo.js'
import * as VV from './front/vue/village.js'
import { bascule } from './front/vue/aptitudes-ui.js'

const CLE_META = 'front.meta'
const metaVide = { meilleurNiveau: 0, batailles: 0, campagnes: 0 }

const litMeta = () => {
  try {
    return { ...metaVide, ...JSON.parse(lis(CLE_META, '{}')) }
  } catch {
    return { ...metaVide }
  }
}
const ecritMeta = (m) => ecris(CLE_META, JSON.stringify(m))

/** Au-delà de ce déplacement du doigt, le geste est un glissement, pas un appui. */
const SEUIL_APPUI = 10

export default {
  id: 'front',
  nom: 'FRONT',
  pitch: 'Une compagnie persistante, une grille hexagonale. Tour par tour',
  couleur: C.accent,
  unite: '',
  persistant: true,
  sansScore: true,
  ciel: C.vert,
  // Une grille de 19 × 15 mesure 33,8 R de large pour 23 R de haut. Debout,
  // la fenêtre du champ est carrée et la carte n'y entre qu'en rapetissant les
  // hexagones sous le doigt ; couchée, elle a exactement la forme de la carte,
  // et le panneau d'ordres passe à droite au lieu de manger la moitié basse.
  paysage: true,
  confort: 'paysage',

  titreHud: (j) => {
    const e = j.e
    if (e.vue === 'bataille' && e.bat) return e.bat.titre ?? 'BATAILLE'
    return e.c ? `NIVEAU ${e.c.niveau}` : 'FRONT'
  },
  finTitre: () => ({ texte: 'COMPAGNIE DISSOUTE', couleur: C.rouge }),

  init(j) {
    j.e.meta = litMeta()
    j.e.zones = []
    j.e.sel = {}
    j.e.defile = 0
    j.e.defileMax = 0
    j.e.attente = 0
    j.e.geste = null
    j.e.choix = null
    j.e.selTroupe = null
    j.e.rapport = null
    j.e.bat = null

    const brut = Cie.migre(j.charge())
    if (brut) {
      j.e.c = brut.c
      j.e.bat = brut.bat
      if (j.e.bat) {
        j.e.vueChamp = VC.nouvelleVue(VD.bataille(j).champ, j.e.bat)
        j.e.vue = 'bataille'
      } else j.e.vue = 'village'
    } else {
      j.e.c = null
      j.e.vue = 'titre'
    }
  },

  quitte: (j) => sauve(j),

  /**
   * L'écran a tourné en pleine partie. Le rayon qui cadrait la carte ne la
   * cadre plus et la caméra pointe hors de la nouvelle fenêtre ; un défilement
   * de liste mesuré dans l'autre gabarit ne désigne plus rien ; et le doigt en
   * cours a été posé sur des coordonnées qui n'existent plus.
   */
  redim(j) {
    const e = j.e
    e.geste = null
    e.defile = 0
    if (!e.bat || !e.vueChamp) return
    const ch = VD.bataille(j).champ
    VC.recadre(ch, e.vueChamp, e.bat.carte)
    const u = e.sel?.unite ?? B.vivantes(e.bat, 0)[0]
    if (u) VC.centreSur(ch, e.vueChamp, e.bat.carte, u.q, u.r)
  },

  // --- Le temps ----------------------------------------------------------------

  maj(j, dt) {
    const e = j.e
    glisse(j)
    if (e.vue !== 'bataille' || !e.bat) return

    if (e.bat.fini) return termine(j)
    if (e.bat.camp !== 1) return

    e.attente -= dt
    if (e.attente > 0) return

    // Le tour adverse se joue **une troupe à la fois**, caméra dessus : on
    // voit ce qui arrive au lieu de découvrir un champ de bataille changé.
    const u = IA.prochaine(e.bat, 1)
    if (!u) {
      B.finTour(e.bat)
      e.attente = 0.25
      sauve(j)
      return
    }
    VC.centreSur(VD.bataille(j).champ, e.vueChamp, e.bat.carte, u.q, u.r)
    const acte = IA.joueUne(e.bat, u)
    e.attente = acte?.attaque || acte?.ordre ? 0.62 : 0.28
    if (acte?.attaque) {
      const d = acte.attaque.degats ?? 0
      j.son.casse(Math.min(11, 3 + Math.floor(d / 6)))
      j.fx.secoue(acte.attaque.mort ? 7 : 3)
    }
  },

  // --- Dessin ------------------------------------------------------------------

  dessine(j, ctx) {
    const e = j.e
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    // Purgé avant l'aiguillage, bataille comprise : sinon le cadre de la
    // dernière liste survit à l'entrée au combat, et un glissement dans le
    // panneau d'ordres se croit encore en train de faire défiler la caserne.
    e.defileMax = 0
    e.listeRect = null
    if (e.vue === 'bataille' && e.bat) return dessineBataille(j, ctx)

    if (e.vue === 'titre') e.zones = VM.titre(ctx, j, !!e.c, e.meta)
    else if (e.vue === 'village') e.zones = VV.village(ctx, j, e.c)
    else if (e.vue === 'campagne') e.zones = VM.campagne(ctx, j, e.c, e.choix)
    else if (e.vue === 'caserne') e.zones = defilante(e, VM.caserne(ctx, j, e.c, e.defile))
    else if (e.vue === 'uniques') e.zones = defilante(e, VM.uniques(ctx, j, e.c, e.defile))
    else if (e.vue === 'compagnie') e.zones = defilante(e, VM.compagnie(ctx, j, e.c, e.selTroupe, e.defile))
    else if (e.vue === 'ville') e.zones = defilante(e, VM.ville(ctx, j, e.c, e.defile))
    else if (e.vue === 'batiment') e.zones = defilante(e, VM.batiment(ctx, j, e.c, e.batimentId, e.defile))
    else if (e.vue === 'fiche') e.zones = defilante(e, ficheOuRetour(j, ctx))
    else if (e.vue === 'bilan') e.zones = VM.bilan(ctx, j, e.c, e.rapport)
    ctx.textAlign = 'center'
  },

  appui(j, p) {
    const e = j.e
    e.geste = {
      x: p.x,
      y: p.y,
      bouge: 0,
      cam: e.vueChamp ? { ...e.vueChamp.cam } : null,
      defile: e.defile,
      champ: e.vue === 'bataille' && VC.dansChamp(VD.bataille(j).champ, p),
      liste: e.defileMax > 0 && !!e.listeRect && p.y >= e.listeRect.y && p.y <= e.listeRect.y + e.listeRect.h,
    }
  },

  /**
   * Tout se joue au relâchement, et seulement si le doigt n'a pas voyagé.
   * C'est la règle qui permet de faire glisser la carte sans déclencher un
   * assaut, et de faire défiler une liste sans acheter la ligne du dessous.
   */
  relache(j, p) {
    const e = j.e
    const g = e.geste
    e.geste = null
    if (!g || g.bouge > SEUIL_APPUI) return

    const z = e.zones.find((x) => p.x >= x.x && p.x <= x.x + x.w && p.y >= x.y && p.y <= x.y + x.h)
    if (z) return actions(j, z)
    if (e.vue === 'bataille' && g.champ) appuiChamp(j, p)
  },
}

// --- Gestes -----------------------------------------------------------------------

function glisse(j) {
  const e = j.e
  const g = e.geste
  if (!g || !j.maintenu) return
  const dx = j.pointer.x - g.x
  const dy = j.pointer.y - g.y
  g.bouge = Math.max(g.bouge, Math.hypot(dx, dy))
  if (g.champ && g.cam && e.vueChamp) {
    e.vueChamp.cam.x = g.cam.x - dx
    e.vueChamp.cam.y = g.cam.y - dy
    VC.borneCamera(VD.bataille(j).champ, e.vueChamp, e.bat.carte)
  } else if (g.liste) {
    e.defile = Math.max(0, Math.min(e.defileMax, g.defile - dy))
  }
}

const defilante = (e, r) => {
  e.defileMax = r.max
  e.listeRect = r.rect
  e.defile = Math.max(0, Math.min(r.max, e.defile))
  return r.zones
}

/** La fiche n'existe que si la troupe existe : réformer depuis la fiche la fait disparaître. */
function ficheOuRetour(j, ctx) {
  const e = j.e
  const u = Cie.trouve(e.c, e.selTroupe)
  if (!u) {
    e.vue = 'compagnie'
    e.selTroupe = null
    return VM.compagnie(ctx, j, e.c, e.selTroupe, e.defile)
  }
  return VM.fiche(ctx, j, e.c, u, e.defile, e.selEquip, e.aptOuvertes)
}

// --- Bataille ---------------------------------------------------------------------

function dessineBataille(j, ctx) {
  const e = j.e
  const sel = e.sel
  const bat = e.bat
  const d = VD.bataille(j)
  VC.dessine(ctx, d.champ, e.vueChamp, bat, {
    unite: sel.unite,
    visee: sel.visee,
    deplacements: sel.deplacements,
    cibles: sel.mode === 'ordre' ? sel.casesOrdre : sel.cibles,
    chemin: sel.chemin,
  })
  const zb = VB.bandeau(ctx, d, bat, e.vueChamp)
  const zp = VB.panneauBas(ctx, d, bat, { ...sel, confirmeRetraite: e.confirmeRetraite })
  e.zones = [...zb, ...zp]
  if (bat.camp === 1) {
    const t = d.tourAdverse
    rect(ctx, t.x, t.y, t.w, t.h, C.rouge)
    ctx.textAlign = 'center'
    texte(ctx, 'TOUR ADVERSE', t.x + t.w / 2, t.y + t.h / 2, 12, C.fond, 700, 300)
    ctx.textAlign = 'left'
  }
}

/** Remet à jour ce que la troupe choisie peut faire. Un seul endroit, jamais deux. */
function rafraichitSel(j) {
  const e = j.e
  const sel = e.sel
  const u = sel.unite
  if (!u || u.pv <= 0) return deselectionne(j)
  sel.deplacements = VC.casesDeplacement(e.bat, u)
  sel.ciblesUnite = B.cibles(e.bat, u)
  sel.cibles = new Set(sel.ciblesUnite.map((c) => cle(c.q, c.r)))
  // Trois boutons au plus s'affichent : les ordres jouables tout de suite
  // passent devant ceux en recharge, sinon une troupe à quatre ordres pouvait
  // n'en montrer que des indisponibles.
  const dispo = new Set(B.ordresJouables(e.bat, u).map((a) => a.id))
  sel.ordres = U.ordres(u)
    .slice()
    .sort((a, b) => (dispo.has(b.id) ? 1 : 0) - (dispo.has(a.id) ? 1 : 0))
    .slice(0, 3)
  sel.chemin = null
}

function deselectionne(j) {
  j.e.sel = {}
}

function choisit(j, u) {
  const e = j.e
  e.sel = { unite: u }
  rafraichitSel(j)
  VC.centreSur(VD.bataille(j).champ, e.vueChamp, e.bat.carte, u.q, u.r)
  j.son.clic()
}

function appuiChamp(j, p) {
  const e = j.e
  const bat = e.bat
  const sel = e.sel
  if (bat.camp !== 0 || bat.fini) return
  const h = VC.hexSous(VD.bataille(j).champ, e.vueChamp, p)
  if (!h) return
  const sous = B.uniteA(bat, h.q, h.r)

  // Un ordre en attente de cible : on ouvre sa prévision, on ne le lance pas
  // encore. « Aucun coup à l'aveugle » vaut aussi pour une grenade.
  if (sel.mode === 'ordre' && sel.unite && sel.apt) {
    if (sel.casesOrdre?.has(cle(h.q, h.r))) {
      sel.previsionOrdre = h
      return j.son.clic()
    }
    sel.mode = null
    sel.casesOrdre = null
    return j.son.rate()
  }

  // Une troupe adverse à portée : on passe directement à la prévision. C'est
  // le geste le plus fréquent du jeu, il ne coûte qu'un appui.
  if (sous && sous.camp === 1 && sel.unite && sel.ciblesUnite?.includes(sous)) {
    sel.visee = sous
    sel.mode = null
    return j.son.clic()
  }
  if (sous && sous.camp === 0 && sous.pv > 0) return choisit(j, sous)
  if (sous && sous.camp === 1) {
    e.sel = { inspect: sous }
    return j.son.clic()
  }

  if (sel.unite && sel.deplacements?.has(cle(h.q, h.r))) {
    const r = B.deplace(bat, sel.unite, h.q, h.r)
    if (r) {
      j.son.touche(3)
      if (r.piege) {
        j.son.casse(8)
        j.fx.secoue(7)
      }
      VC.centreSur(VD.bataille(j).champ, e.vueChamp, bat.carte, h.q, h.r)
      rafraichitSel(j)
      sauve(j)
    }
    return
  }
  // Un tap qui ne touche rien de jouable, alors qu'une troupe était choisie
  // ou un ennemi inspecté : ce n'est pas un geste neutre, c'est une
  // sélection perdue — contrairement à toute autre action invalide du jeu,
  // ce point de chute ne jouait aucun son.
  if (sel.unite || sel.inspect) j.son.rate()
  deselectionne(j)
}

function joueOrdre(j, h) {
  const e = j.e
  const sel = e.sel
  const r = B.lanceOrdre(e.bat, sel.unite, sel.apt, h)
  sel.mode = null
  sel.casesOrdre = null
  sel.previsionOrdre = null
  if (!r) return j.son.rate()
  j.son.niveau()
  const somme = (r.degats ?? []).reduce((s, x) => s + x.degats, 0)
  if (somme) {
    j.fx.secoue(6)
    const p = VC.place(VD.bataille(j).champ, e.vueChamp, h.q, h.r)
    j.fx.bulle(p.x, p.y - 10, '−' + somme, C.rouge, 17)
  }
  rafraichitSel(j)
  if (B.aFini(sel.unite)) deselectionne(j)
  sauve(j)
}

/**
 * Une fois FRAPPER (ou LANCER, pour un ordre) confirmé, il n'y a plus de
 * retour arrière — choix assumé, pas un oubli. CONFIRMER/RENONCER couvre
 * déjà l'erreur avant l'engagement, puisque la prévision montre exactement
 * ce qui va tomber ; l'irréversibilité après est cohérente avec la promesse
 * du jeu (« la résolution n'a aucun aléa »), et un REVENIR après coup
 * romprait cette promesse en laissant annuler un résultat déjà connu.
 */
function frappe(j) {
  const e = j.e
  const sel = e.sel
  const u = sel.unite
  const c = sel.visee
  if (!u || !c) return
  const ch = VD.bataille(j).champ
  const p = VC.place(ch, e.vueChamp, c.q, c.r)
  const r = B.attaque(e.bat, u, c)
  sel.visee = null
  if (!r) return j.son.rate()
  j.son.casse(Math.min(11, 3 + Math.floor(r.degats / 6)))
  j.fx.secoue(r.mort ? 8 : 4)
  j.fx.bulle(p.x, p.y - 10, '−' + r.degats, r.mort ? C.vert : C.accent, r.mort ? 19 : 15)
  if (r.riposte) {
    const q = VC.place(ch, e.vueChamp, u.q, u.r)
    j.fx.bulle(q.x, q.y - 10, '−' + r.riposte, C.rouge, 13)
  }
  if (B.aFini(u) || u.pv <= 0) deselectionne(j)
  else rafraichitSel(j)
  sauve(j)
}

function termine(j) {
  const e = j.e
  e.rapport = Cie.bilan(e.c, e.bat)
  e.rapport.titre = e.bat.titre
  e.bat = null
  e.sel = {}
  e.vue = 'bilan'
  e.meta.batailles = (e.meta.batailles ?? 0) + 1
  if (e.c.niveau > (e.meta.meilleurNiveau ?? 0)) e.meta.meilleurNiveau = e.c.niveau
  ecritMeta(e.meta)
  j.son[e.rapport.gagne ? 'record' : 'mort']()
  sauve(j)
}

// --- Les actions des écrans ----------------------------------------------------------

function actions(j, z) {
  const e = j.e
  const c = e.c
  const suites = {
    // Titre
    nouvelle: () => {
      e.c = Cie.nouvelle((j.hasard() * 4294967296) >>> 0)
      e.meta.campagnes = (e.meta.campagnes ?? 0) + 1
      ecritMeta(e.meta)
      e.vue = 'village'
      j.son.niveau()
      sauve(j)
    },
    reprendre: () => ((e.vue = 'village'), j.son.clic()),

    // Le village
    campagne: () => va(j, 'campagne'),
    caserne: () => va(j, 'caserne'),
    uniques: () => va(j, 'uniques'),
    compagnie: () => va(j, 'compagnie'),
    ville: () => va(j, 'ville'),
    retour: () => {
      if (e.vue === 'fiche') return va(j, 'compagnie')
      // Le détail d'un bâtiment se rejoint depuis deux endroits — un
      // emplacement du village qui y va tout droit, ou la liste des neuf
      // bâtiments — et RETOUR doit revenir par où on est vraiment venu.
      if (e.vue === 'batiment') return va(j, e.batimentRetour ?? 'ville')
      va(j, 'village')
    },

    // La ville et ses bâtiments
    batiment: () => {
      e.batimentId = z.id
      e.batimentRetour = e.vue === 'village' ? 'village' : 'ville'
      va(j, 'batiment')
    },
    construire: () => (V.construit(c, e.batimentId) ? (j.son.record(), sauve(j)) : j.son.rate()),
    entraine: () => (V.entraine(c, z.id) ? (j.son.record(), sauve(j)) : j.son.rate()),
    achete: () => (Cie.acheteObjet(c, z.id) ? (j.son.record(), sauve(j)) : j.son.rate()),
    ameliore: () =>
      Cie.ameliore(c, z.id, z.emp, V.niveauBat(c, 'forge') + 1) ? (j.son.record(), sauve(j)) : j.son.rate(),
    focus: () => (V.choisisFocus(c, z.id) ? (j.son.clic(), sauve(j)) : j.son.rate()),

    // Engagements
    offre: () => ((e.choix = e.choix === z.k ? null : z.k), j.son.clic()),
    engager: () => engage(j),

    // Caserne et état-major
    recrute: () => {
      const u = Cie.recruteGenerique(c, z.cl)
      if (!u) return j.son.rate()
      Cie.enrole(c, u.id)
      j.son.record()
      sauve(j)
    },
    recruteUnique: () => {
      const u = Cie.recruteUnique(c, z.uq)
      if (!u) return j.son.rate()
      j.son.record()
      const ou = VD.uniques(j).eclat
      j.fx.eclat(ou.x, ou.y, C.violet, { n: 30, vitesse: 220 })
      // Un unique recruté rejoint le front tout de suite s'il reste une place :
      // sans ça, on paie très cher un dossier qui dort au dépôt.
      Cie.enrole(c, u.id)
      sauve(j)
    },

    // Compagnie
    troupe: () => ((e.selTroupe = e.selTroupe === z.id ? null : z.id), j.son.clic()),
    affecte: () => {
      if (!e.selTroupe) return
      Cie.affecte(c, c.escouades[z.k], e.selTroupe) ? j.son.clic() : j.son.rate()
      sauve(j)
    },
    depot: () => (e.selTroupe && Cie.retireDe(c, e.selTroupe) ? (j.son.clic(), sauve(j)) : j.son.rate()),
    nouvelleEscouade: () => (Cie.creeEscouade(c) ? (j.son.clic(), sauve(j)) : j.son.rate()),
    fiche: () => (e.selTroupe ? ((e.selEquip = null), (e.aptOuvertes = new Set()), va(j, 'fiche')) : j.son.rate()),
    soigne: () => (Cie.soigne(c, e.selTroupe) ? (j.son.record(), sauve(j)) : j.son.rate()),

    // La fiche : équipement et aptitudes
    equipSlot: () => {
      e.selEquip = e.selEquip === z.slot ? null : z.slot
      e.defile = 0
      j.son.clic()
    },
    poseEquip: () => {
      if (!Cie.equipeObjet(c, e.selTroupe, e.selEquip, z.i)) return j.son.rate()
      e.selEquip = null
      j.son.record()
      sauve(j)
    },
    deposeEquip: () => {
      if (!Cie.deposeObjet(c, e.selTroupe, e.selEquip)) return j.son.rate()
      e.selEquip = null
      j.son.record()
      sauve(j)
    },
    aptToggle: () => {
      e.aptOuvertes = bascule(e.aptOuvertes ?? new Set(), z.id)
      j.son.clic()
    },
    reforme: () => {
      Cie.reforme(c, e.selTroupe)
      e.selTroupe = null
      e.vue = 'compagnie'
      j.son.clic()
      sauve(j)
    },

    // Bilan
    suite: () => {
      e.rapport = null
      if (Cie.aneantie(c)) {
        j.efface()
        return j.perdu()
      }
      va(j, 'village')
    },

    // Bataille
    zoom: () => {
      const v = e.vueChamp
      const ch = VD.bataille(j).champ
      const u = e.sel.unite ?? B.vivantes(e.bat, 0)[0]
      v.zoom = v.zoom ? 0 : 1
      v.R = VC.rayonPour(ch, e.bat.carte, v.zoom)
      if (u) VC.centreSur(ch, v, e.bat.carte, u.q, u.r)
      else VC.borneCamera(ch, v, e.bat.carte)
      j.son.clic()
    },
    finTour: () => {
      deselectionne(j)
      B.finTour(e.bat)
      e.attente = 0.4
      j.son.niveau()
      sauve(j)
    },
    retraite: () => {
      // Rompre est irréversible et coûte la prime : deux appuis, comme le
      // bouton « nouvelle partie » du moteur.
      if (!e.confirmeRetraite) {
        e.confirmeRetraite = true
        return j.son.rate()
      }
      e.confirmeRetraite = false
      B.retraite(e.bat)
      j.son.mort()
    },
    attaquer: () => {
      if (!e.sel.ciblesUnite?.length) return j.son.rate()
      if (e.sel.ciblesUnite.length === 1) {
        e.sel.visee = e.sel.ciblesUnite[0]
        return j.son.clic()
      }
      e.sel.mode = 'cible'
      j.son.clic()
    },
    tenir: () => {
      if (!B.tient(e.bat, e.sel.unite)) return j.son.rate()
      j.son.touche(2)
      deselectionne(j)
      sauve(j)
    },
    ordre: () => {
      const apt = APT[z.id]
      const u = e.sel.unite
      if (!apt || B.froidDe(u, apt.id) > 0 || u.aAgi) return j.son.rate()
      const legales = B.ciblesOrdre(e.bat, u, apt)
      if (!legales.length) return j.son.rate()
      // joueOrdre() lit sel.apt : il doit être posé avant qu'un ordre à soi
      // ne parte tout de suite, sinon lanceOrdre() reçoit un apt indéfini.
      e.sel.apt = apt
      if (apt.ordre.forme === 'soi') return joueOrdre(j, legales[0])
      e.sel.mode = 'ordre'
      e.sel.casesOrdre = new Set(legales.map((h) => cle(h.q, h.r)))
      j.son.clic()
    },
    annuler: () => (B.annuleDeplacement(e.bat, e.sel.unite) ? (rafraichitSel(j), j.son.clic()) : j.son.rate()),
    ferme: () => (deselectionne(j), j.son.clic()),
    confirme: () => frappe(j),
    annuleCible: () => ((e.sel.visee = null), j.son.clic()),
    confirmeOrdre: () => joueOrdre(j, e.sel.previsionOrdre),
    renonceOrdre: () => {
      e.sel.previsionOrdre = null
      e.sel.mode = null
      e.sel.casesOrdre = null
      j.son.clic()
    },
  }
  // La vignette d'une troupe, dans le panneau du bas, choisit **et** recentre.
  if (z.quoi === 'troupe' && e.vue === 'bataille') {
    const u = B.parRef(e.bat, z.ref)
    return u && u.pv > 0 ? choisit(j, u) : j.son.rate()
  }
  if (z.quoi !== 'retraite') e.confirmeRetraite = false
  suites[z.quoi]?.()
}

function va(j, vue) {
  j.e.vue = vue
  j.e.defile = 0
  j.e.choix = vue === 'campagne' ? j.e.choix : null
  j.son.clic()
  sauve(j)
}

function engage(j) {
  const e = j.e
  if (e.choix == null) return j.son.rate()
  const bat = Cie.prepare(e.c, e.choix)
  if (!bat) return j.son.rate()
  e.bat = bat
  e.vueChamp = VC.nouvelleVue(VD.bataille(j).champ, bat)
  e.sel = {}
  e.attente = 0.3
  e.vue = 'bataille'
  e.choix = null
  j.son.niveau()
  sauve(j)
}

function sauve(j) {
  if (!j.e.c) return
  j.sauve(Cie.sauvegarde(j.e.c, j.e.bat))
}
