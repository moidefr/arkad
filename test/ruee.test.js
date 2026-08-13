/**
 * RUÉE, et surtout : **aucun niveau publié n'est infranchissable.**
 *
 * C'est le seul test de ce fichier qui vaut vraiment quelque chose. Dans un jeu
 * qui s'apprend par cœur, un passage impossible ne se distingue pas d'un
 * passage difficile — le joueur suppose qu'il est mauvais, s'entête, et
 * abandonne. Ça ne se voit pas à la relecture, et ça ne se voit pas à l'œil :
 * seul un automate qui essaie toutes les décisions le dit.
 *
 * Le premier jeu de motifs en comptait quatre d'impossibles sur vingt-trois, et
 * deux niveaux sur cinq bloquaient. Ils sont passés inaperçus jusqu'à ce que
 * l'automate tourne.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { fauxCtx, fauxJeu } from './faux.js'
import { resout, marge } from './ruee-solveur.mjs'
import {
  MOTIFS,
  NIVEAUX,
  PAR_ID,
  RANGEES,
  CASES,
  repos,
  reposCouvert,
  NIVEAU_PAR_ID,
} from '../src/long/ruee/donnees.js'
import * as L from '../src/long/ruee/logique.js'
import jeu from '../src/long/ruee/index.js'
import { dispo } from '../src/long/ruee/vues.js'

// --- La matière ---------------------------------------------------------------------

test('chaque motif est bien formé', () => {
  const vus = new Set()
  for (const m of MOTIFS) {
    assert.ok(!vus.has(m.id), 'motif en double : ' + m.id)
    vus.add(m.id)
    assert.equal(m.cases.length, RANGEES, `${m.id} : ${m.cases.length} rangées au lieu de ${RANGEES}`)
    for (const ligne of m.cases) {
      assert.equal(ligne.length, m.large, `${m.id} : rangées de largeurs différentes`)
      for (const c of ligne) assert.ok(CASES[c], `${m.id} : lettre inconnue « ${c} »`)
    }
    assert.ok(['cube', 'vaisseau', 'onde'].includes(m.mode), `${m.id} : véhicule inconnu`)
  }
})

test('aucun niveau ne mélange les véhicules sans portail', () => {
  for (const n of NIVEAUX) {
    let mode = 'cube'
    for (const item of n.suite) {
      if (typeof item === 'object') continue
      const m = PAR_ID[item]
      assert.equal(m.mode, mode, `${n.id} : ${m.id} se joue en ${m.mode}, or on est en ${mode}`)
      // Un motif peut contenir le portail qui change de véhicule pour la suite.
      const plat = m.cases.join('')
      if (plat.includes('S')) mode = 'vaisseau'
      if (plat.includes('W')) mode = 'onde'
      if (plat.includes('C')) mode = 'cube'
    }
    assert.equal(mode, 'cube', `${n.id} : on finit dans un autre véhicule, sans être reposé`)
  }
})

test('chaque niveau pointe sur des motifs qui existent', () => {
  for (const n of NIVEAUX) {
    for (const item of n.suite) {
      if (typeof item === 'object') {
        assert.ok(item.repos > 0, `${n.id} : repos vide`)
        continue
      }
      assert.ok(PAR_ID[item], `${n.id} : motif inconnu ${item}`)
    }
  }
})

// --- Les règles ---------------------------------------------------------------------

test('la simulation est déterministe', () => {
  const joue = () => {
    const e = L.nouvelle('premiere')
    for (let i = 0; i < 900; i++) L.pas(e, i % 37 === 0, L.PAS)
    return [e.x.toFixed(6), e.y.toFixed(6), e.vy.toFixed(6), e.mort]
  }
  assert.deepEqual(joue(), joue())
})

test('le pas est fixe, quelle que soit la cadence d’affichage', () => {
  // Un jeu de précision dont la physique suit le taux de rafraîchissement
  // n'est pas apprenable : le même appui donnerait deux sauts différents.
  const a = L.nouvelle('premiere')
  const b = L.nouvelle('premiere')
  for (let i = 0; i < 60; i++) L.avance(a, 1 / 60, false)
  for (let i = 0; i < 120; i++) L.avance(b, 1 / 120, false)
  assert.ok(Math.abs(a.x - b.x) < 1, `${a.x} contre ${b.x}`)
  assert.ok(Math.abs(a.y - b.y) < 1, `${a.y} contre ${b.y}`)
})

test('toucher un pic tue, poser le pied sur un bloc ne tue pas', () => {
  const e = L.nouvelle('premiere')
  for (let i = 0; i < 2000 && !e.mort && !e.fini; i++) L.pas(e, false, L.PAS)
  assert.ok(e.mort, 'sans jamais appuyer, on devrait mourir sur le premier pic')

  // Le repos du départ fait six cases ; à 100 pas on en a parcouru quatre et
  // demie, donc on est encore sur le plat. À 200 on est déjà dans le pic.
  const f = L.nouvelle('premiere')
  for (let i = 0; i < 100; i++) L.pas(f, false, L.PAS)
  assert.ok(!f.mort && f.sol, 'le plat du départ ne doit tuer personne')
})

test('l’avancement va de zéro à un, sans jamais sortir', () => {
  const e = L.nouvelle('derniere')
  assert.equal(L.avancement(e), 0)
  for (let i = 0; i < 5000 && !e.mort && !e.fini; i++) {
    L.pas(e, i % 20 < 6, L.PAS)
    const a = L.avancement(e)
    assert.ok(a >= 0 && a <= 1, `avancement hors bornes : ${a}`)
  }
})

// --- Ce qui compte ------------------------------------------------------------------

test('chaque motif se franchit seul', () => {
  for (const m of MOTIFS) {
    // Un motif se vérifie dans le véhicule et le sens de gravité qu'il demande :
    // un couloir d'onde essayé à pied ne dit rien sur le motif, et un plafond
    // essayé à l'endroit est un mur.
    const suite =
      m.mode === 'vaisseau'
        ? [repos(4), 'volEntree', 'volPlat', m.id, 'volPlat', repos(4)]
        : m.mode === 'onde'
          ? [repos(4), 'ondeEntree', 'ondePlat', m.id, 'ondePlat', 'ondeSortie', repos(4)]
          : m.id.startsWith('grav') && m.id !== 'gravEntree'
            ? [repos(4), 'gravEntree', reposCouvert(2), m.id, reposCouvert(2), 'gravRetour', repos(4)]
            : [repos(6), m.id, repos(6)]
    const essai = { id: '_essai', nom: 'essai', bande: 'ruee1', vitesse: 1, suite }
    NIVEAUX.push(essai)
    NIVEAU_PAR_ID['_essai'] = essai
    try {
      const r = resout('_essai', { budget: 500000 })
      assert.ok(r.gagne, `${m.id} est infranchissable — bloqué à ${(r.avance * 100).toFixed(0)} %`)
      // La marge ne se demande qu'au cube.
      //
      // Elle mesure de combien d'images on peut se tromper sur un appui — ce
      // qui suppose que l'appui soit un engagement. C'est vrai d'un saut ; ce
      // ne l'est pas du vaisseau ni de l'onde, qu'on pilote en continu et où
      // le joueur corrige à chaque instant. Sur ceux-là la mesure rend la
      // prudence de la trajectoire *trouvée par le solveur*, pas la largeur du
      // passage — et le solveur n'a aucune raison de voler au milieu du
      // couloir. On mesure donc autre chose pour eux, juste en dessous.
      // Et pas non plus sur un motif qui **contient** un portail de véhicule :
      // il est déclaré « cube » parce qu'on y entre à pied, mais on le finit
      // en vaisseau ou en onde, donc la trajectoire mesurée est déjà celle
      // d'un pilotage continu.
      const portail = m.cases.join('')
      if (m.mode === 'cube' && !portail.includes('S') && !portail.includes('W')) {
        assert.ok(marge('_essai', r.appuis) >= 2, `${m.id} : fenêtre d’appui trop étroite`)
      }
    } finally {
      NIVEAUX.pop()
      delete NIVEAU_PAR_ID['_essai']
    }
  }
})

test('les couloirs des véhicules pilotés laissent de la place', () => {
  // Ce que la marge ne peut pas dire pour le vaisseau et l'onde, la donnée le
  // dit directement : dans chaque colonne d'un couloir, il doit rester une
  // trouée d'au moins quatre cases. C'est une mesure du niveau et non du
  // chemin, donc elle ne dépend d'aucune heuristique de recherche.
  const MINIMUM = 4
  for (const m of MOTIFS) {
    if (m.mode === 'cube') continue
    for (let x = 0; x < m.large; x++) {
      let libre = 0
      let plusLong = 0
      for (let y = 0; y < RANGEES; y++) {
        libre = m.cases[y][x] === '#' ? 0 : libre + 1
        plusLong = Math.max(plusLong, libre)
      }
      assert.ok(plusLong >= MINIMUM, `${m.id}, colonne ${x} : seulement ${plusLong} cases de passage`)
    }
  }
})

test('chaque niveau se franchit en entier', () => {
  for (const n of NIVEAUX) {
    const r = resout(n.id, { budget: 3000000 })
    assert.ok(r.gagne, `${n.id} est infranchissable — bloqué à ${(r.avance * 100).toFixed(0)} %`)
  }
})

test('un niveau ne se franchit pas en laissant le doigt appuyé', () => {
  // Le contre-test du précédent : si maintenir suffit, le niveau n'est pas un
  // niveau, c'est un couloir.
  for (const n of NIVEAUX) {
    const e = L.nouvelle(n.id)
    for (let i = 0; i < 20000 && !e.mort && !e.fini; i++) L.pas(e, true, L.PAS)
    assert.ok(!e.fini, `${n.id} se termine en gardant le doigt appuyé`)
  }
})

// --- La progression et l’écran --------------------------------------------------------

test('les niveaux s’ouvrent l’un après l’autre', () => {
  const p = L.progressionNeuve()
  assert.ok(L.ouvert(p, NIVEAUX[0].id))
  assert.ok(!L.ouvert(p, NIVEAUX[1].id), 'le deuxième niveau devrait être fermé')
  p.finis.add(NIVEAUX[0].id)
  assert.ok(L.ouvert(p, NIVEAUX[1].id))
})

test('la sauvegarde fait l’aller-retour', () => {
  const p = L.progressionNeuve()
  p.records.premiere = 0.42
  p.essais.premiere = 17
  p.finis.add('premiere')
  const relu = L.migre(JSON.parse(JSON.stringify(L.sauvegarde(p))))
  assert.equal(relu.records.premiere, 0.42)
  assert.equal(relu.essais.premiere, 17)
  assert.ok(relu.finis.has('premiere'))
})

test('une sauvegarde d’une autre version est refusée plutôt que mal lue', () => {
  assert.equal(L.migre({ v: 99, records: {} }), null)
  assert.equal(L.migre(null), null)
})

test('le jeu s’ouvre, se joue et se dessine dans les deux formats', () => {
  for (const format of ['portrait', 'paysage']) {
    const j = fauxJeu(jeu, { format })
    jeu.init(j)
    const ctx = fauxCtx()
    jeu.dessine(j, ctx)
    assert.ok(ctx.ops.length > 10, `${format} : le menu est vide`)

    // On ouvre le premier niveau par le vrai chemin d'appui.
    const d = dispo(j)
    const z = d.carte(0, NIVEAUX[0])
    jeu.appui(j, { x: z.x + z.w / 2, y: z.y + z.h / 2 })
    assert.equal(j.e.vue, 'course', `${format} : le niveau ne s’ouvre pas`)

    for (let i = 0; i < 120; i++) jeu.maj(j, 1 / 60)
    const ctx2 = fauxCtx()
    jeu.dessine(j, ctx2)
    assert.ok(ctx2.ops.length > 10, `${format} : la course ne dessine rien`)
  }
})

test('mourir ne perd pas le record, et l’entraînement ne le gonfle pas', () => {
  const j = fauxJeu(jeu)
  jeu.init(j)
  j.e.p.records.premiere = 0.5
  j.e.vue = 'course'
  j.e.entrainement = true
  j.e.course = L.nouvelle('premiere')
  // On avance loin en entraînement : le record ne doit pas bouger.
  for (let i = 0; i < 300; i++) jeu.maj(j, 1 / 60)
  assert.equal(j.e.p.records.premiere, 0.5, 'l’entraînement a écrit un record')
})

test('chaque motif tient aussi à la vitesse des niveaux qui l’emploient', () => {
  // Un motif vérifié à vitesse 1 n'est pas vérifié à 1,15 : le saut couvre
  // quinze pour cent de distance en plus, donc il retombe ailleurs. C'est
  // exactement comme ça que LES DENTS bloquait « TOUT EN MÊME TEMPS » à 80 %
  // alors qu'il passait seul.
  const vitesses = [...new Set(NIVEAUX.map((n) => n.vitesse ?? 1))]
  for (const v of vitesses) {
    for (const m of MOTIFS) {
      if (m.mode !== 'cube' || m.id.startsWith('grav')) continue
      const essai = { id: '_v', nom: 'v', bande: 'ruee1', vitesse: v, suite: [repos(6), m.id, repos(6)] }
      NIVEAUX.push(essai)
      NIVEAU_PAR_ID['_v'] = essai
      try {
        const r = resout('_v', { budget: 500000 })
        assert.ok(r.gagne, `${m.id} est infranchissable à la vitesse ${v}`)
      } finally {
        NIVEAUX.pop()
        delete NIVEAU_PAR_ID['_v']
      }
    }
  }
})

test('les sections à gravité inversée sont couvertes de bout en bout', () => {
  // Une colonne sans plafond dans une section retournée est un trou par le
  // haut : le joueur monte et sort de la grille. Ça ne se voit pas en relisant
  // les motifs, parce que le trou est dans le *repos* entre deux d'entre eux.
  for (const n of NIVEAUX) {
    let inverse = false
    for (const item of n.suite) {
      if (typeof item === 'object') {
        assert.ok(!inverse || item.couvert, `${n.id} : un repos sans plafond en gravité inversée`)
        continue
      }
      const plat = PAR_ID[item].cases
      if (inverse) {
        for (let x = 0; x < PAR_ID[item].large; x++) {
          assert.equal(plat[0][x], '#', `${n.id} / ${item}, colonne ${x} : pas de plafond alors qu’on est à l’envers`)
        }
      }
      if (plat.join('').includes('G')) inverse = !inverse
    }
    assert.equal(inverse, false, `${n.id} : le niveau se termine la tête en bas`)
  }
})
