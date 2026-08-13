/**
 * Les règles de BRÈCHE, au point près.
 *
 * Le jeu est simple à décrire et plein de cas limites : une ligne et une
 * colonne qui se croisent, une bombe prise dans une ligne qui en déclenche une
 * autre, une roche qui encaisse au lieu de partir, une main dont plus rien ne
 * rentre. Chacun est monté à la main et comparé à un nombre exact.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import * as L from '../src/long/breche/logique.js'
import {
  PIECES,
  PIECE,
  TRANSFOS,
  TRANSFO,
  EFFETS,
  encombrement,
  palierDe,
  PAR_PALIER,
} from '../src/long/breche/donnees.js'
import * as Dir from '../src/long/breche/directeur.js'

/** Un plateau vide, à la taille voulue. */
function plateau(taille = 8) {
  const p = L.nouvelle(1)
  p.taille = taille
  p.cases = new Array(taille * taille).fill(0)
  p.spec = new Array(taille * taille).fill('')
  p.gel = new Array(taille * taille).fill(0)
  p.n = 0
  p.score = 0
  p.combo = 0
  p.fini = false
  return p
}

const remplis = (p, cases) => {
  for (const [c, l] of cases) p.cases[L.indice(p, c, l)] = 1
}
const compte = (p) => p.cases.filter((x) => x > 0).length

// --- Les tables --------------------------------------------------------------

test('chaque pièce est cohérente, et aucune n’est en double', () => {
  const vus = new Set()
  const formes = new Set()
  for (const piece of PIECES) {
    assert.ok(!vus.has(piece.id), 'pièce en double : ' + piece.id)
    vus.add(piece.id)
    assert.ok(piece.nom && piece.poids > 0, piece.id)
    assert.ok(piece.cases.length >= 1 && piece.cases.length <= 9, piece.id)
    const { w, h } = encombrement(piece)
    assert.ok(w <= 5 && h <= 5, `${piece.id} fait ${w}×${h}, trop gros pour la plus petite grille`)
    // Une pièce doit toucher les deux bords de son encombrement, sinon elle
    // porte un décalage invisible qui fausse le centrage à l'écran.
    assert.ok(
      piece.cases.some((c) => c[0] === 0) && piece.cases.some((c) => c[1] === 0),
      `${piece.id} n’est pas calée en haut à gauche`,
    )
    const forme = piece.cases
      .map((c) => c.join(','))
      .sort()
      .join(' ')
    assert.ok(!formes.has(forme), `deux pièces ont exactement la même forme : ${piece.id}`)
    formes.add(forme)
  }
})

test('une pièce ne rentre ni sur une case prise ni hors de la grille', () => {
  const p = plateau(8)
  remplis(p, [[3, 3]])
  assert.equal(L.peutPoser(p, 'carre2', 2, 2), false, 'elle recouvre une case prise')
  assert.equal(L.peutPoser(p, 'carre2', 0, 0), true)
  assert.equal(L.peutPoser(p, 'cinq_h', 4, 0), false, 'elle sort à droite')
  assert.equal(L.peutPoser(p, 'cinq_h', 3, 0), true)
  assert.equal(L.peutPoser(p, 'cinq_v', 0, 4), false, 'elle sort en bas')
})

test('poser retire la pièce de la main et remplit exactement ses cases', () => {
  const p = plateau(8)
  p.main = ['carre2', 'unite', 'duo_h']
  const r = L.pose(p, 0, 1, 1)
  assert.ok(r)
  assert.equal(p.main[0], null)
  assert.equal(compte(p), 4)
  for (const [c, l] of [
    [1, 1],
    [2, 1],
    [1, 2],
    [2, 2],
  ])
    assert.ok(L.pleine(p, c, l))
  assert.equal(r.points, 4, 'quatre cases posées, quatre points')
})

test('une ligne pleine éclate, et rien d’autre', () => {
  const p = plateau(8)
  for (let c = 0; c < 7; c++) remplis(p, [[c, 3]])
  remplis(p, [[0, 5]])
  p.main = ['unite', null, null]
  const r = L.pose(p, 0, 7, 3)
  assert.equal(r.lignes, 1)
  assert.equal(r.colonnes, 0)
  assert.equal(compte(p), 1, 'la ligne est partie, le bloc isolé reste')
  assert.ok(L.pleine(p, 0, 5))
})

test('une ligne et une colonne qui se croisent comptent deux fois, pas trois', () => {
  const p = plateau(8)
  for (let c = 0; c < 8; c++) if (c !== 4) remplis(p, [[c, 4]])
  for (let l = 0; l < 8; l++) if (l !== 4) remplis(p, [[4, l]])
  p.main = ['unite', null, null]
  const r = L.pose(p, 0, 4, 4)
  assert.equal(r.lignes, 1)
  assert.equal(r.colonnes, 1)
  assert.equal(compte(p), 0, 'la croix entière est partie')
  // Quinze cases posées d'avance plus une : le point de croisement ne doit pas
  // être compté deux fois dans ce qui est emporté.
  assert.equal(new Set(r.emportees).size, 15)
})

test('la chaîne monte tant qu’on éclate, et retombe dès qu’on ne le fait plus', () => {
  const p = plateau(8)
  p.main = ['unite', 'unite', 'unite']
  for (let c = 0; c < 7; c++) remplis(p, [[c, 0]])
  assert.equal(L.pose(p, 0, 7, 0).combo, 0)
  assert.equal(p.combo, 1)
  for (let c = 0; c < 7; c++) remplis(p, [[c, 1]])
  assert.equal(L.pose(p, 1, 7, 1).combo, 1, 'le deuxième éclat profite de la chaîne')
  assert.equal(p.combo, 2)
  L.pose(p, 2, 0, 5)
  assert.equal(p.combo, 0, 'une pose sans éclat casse la chaîne')
})

test('deux lignes d’un coup rapportent plus que deux fois une ligne', () => {
  const seule = L.points(1, 8, 0)
  const double = L.points(2, 8, 0)
  assert.ok(double > seule * 2, `${double} contre ${seule * 2}`)
  assert.ok(L.points(1, 8, 4) > L.points(1, 8, 0), 'la chaîne ne rapporte rien')
  assert.equal(L.points(0, 8, 3), 0)
})

// --- Les transformations -------------------------------------------------------

test('une bombe prise dans une ligne emporte ses voisines', () => {
  const p = plateau(8)
  for (let c = 0; c < 7; c++) remplis(p, [[c, 4]])
  p.spec[L.indice(p, 3, 4)] = 'bombe'
  remplis(p, [
    [3, 3],
    [3, 5],
    [2, 3],
  ])
  p.main = ['unite', null, null]
  L.pose(p, 0, 7, 4)
  assert.equal(L.pleine(p, 3, 3), false, 'la case au-dessus de la bombe a survécu')
  assert.equal(L.pleine(p, 3, 5), false)
  assert.equal(L.pleine(p, 2, 3), false)
})

test('un rayon emporte toute sa ligne et toute sa colonne', () => {
  const p = plateau(8)
  for (let c = 0; c < 7; c++) remplis(p, [[c, 2]])
  p.spec[L.indice(p, 5, 2)] = 'rayon'
  for (let l = 0; l < 8; l++) remplis(p, [[5, l]])
  p.main = ['unite', null, null]
  L.pose(p, 0, 7, 2)
  for (let l = 0; l < 8; l++) assert.equal(L.pleine(p, 5, l), false, `la colonne du rayon tient encore en ${l}`)
})

test('une roche encaisse le premier éclat et part au second', () => {
  const p = plateau(8)
  const pose = () => {
    for (let c = 0; c < 7; c++) remplis(p, [[c, 6]])
    p.main = ['unite', null, null]
    L.pose(p, 0, 7, 6)
  }
  remplis(p, [[3, 6]])
  p.spec[L.indice(p, 3, 6)] = 'roche'
  p.gel[L.indice(p, 3, 6)] = 1
  pose()
  assert.ok(L.pleine(p, 3, 6), 'la roche est partie du premier coup')
  assert.equal(p.spec[L.indice(p, 3, 6)], '', 'elle n’est plus une roche après avoir encaissé')
  pose()
  assert.equal(L.pleine(p, 3, 6), false, 'la roche a tenu deux éclats')
})

test('un lingot rapporte plus qu’un bloc ordinaire', () => {
  const monte = (avec) => {
    const p = plateau(8)
    for (let c = 0; c < 7; c++) remplis(p, [[c, 1]])
    if (avec) p.spec[L.indice(p, 2, 1)] = 'lingot'
    p.main = ['unite', null, null]
    return L.pose(p, 0, 7, 1).points
  }
  assert.ok(monte(true) > monte(false))
})

// --- La fin, les outils, la progression ------------------------------------------

test('la partie s’arrête quand plus aucune pièce ne rentre', () => {
  const p = plateau(8)
  for (let i = 0; i < p.cases.length; i++) p.cases[i] = 1
  p.cases[0] = 0
  p.main = ['carre2', 'carre2', 'carre2']
  assert.equal(L.bloque(p), true)
  p.main = ['unite', null, null]
  assert.equal(L.bloque(p), false, 'une case libre laisse encore passer l’unité')
})

test('une main neuve contient toujours au moins une pièce jouable', () => {
  for (let g = 0; g < 60; g++) {
    const p = L.nouvelle(g * 977)
    // On bouche presque tout, en laissant deux cases isolées.
    for (let i = 0; i < p.cases.length; i++) p.cases[i] = 1
    p.cases[0] = 0
    p.cases[p.cases.length - 1] = 0
    L.tireMain(p)
    assert.ok(!L.bloque(p), `graine ${g} : main morte sur un plateau qui a encore de la place`)
  }
})

test('le marteau enlève une case, et seulement si on en a un', () => {
  const p = plateau(8)
  remplis(p, [[2, 2]])
  p.outils.marteau = 1
  assert.equal(L.marteau(p, 5, 5), false, 'on ne martèle pas le vide')
  assert.equal(L.marteau(p, 2, 2), true)
  assert.equal(compte(p), 0)
  assert.equal(p.outils.marteau, 0)
  remplis(p, [[3, 3]])
  assert.equal(L.marteau(p, 3, 3), false, 'sans marteau, rien')
})

test('l’échange change la main sans avancer la crue', () => {
  const p = L.nouvelle(11)
  p.outils.echange = 1
  const avant = [...p.main]
  const poses = p.poses
  assert.ok(L.echange(p))
  assert.notDeepEqual(p.main, avant)
  assert.equal(p.poses, poses, 'l’échange a fait avancer le compteur de poses')
  assert.equal(L.echange(p), false)
})

// --- Sauvegarde et parties entières ---------------------------------------------------

test('la sauvegarde se relit à l’identique', () => {
  const p = L.nouvelle(77)
  p.main = ['carre2', 'unite', 'duo_h']
  L.pose(p, 0, 0, 0)
  const relu = L.migre(JSON.parse(JSON.stringify(L.sauvegarde(p))))
  assert.ok(relu)
  assert.deepEqual(relu.cases, p.cases)
  assert.deepEqual(relu.main, p.main)
  assert.equal(L.migre({ v: 999 }), null)
  assert.equal(L.migre(null), null)
})

test('le tirage est reproductible : fermer l’application ne change pas la main', () => {
  const a = L.nouvelle(1234)
  const b = L.migre(JSON.parse(JSON.stringify(L.sauvegarde(a))))
  a.main = [null, null, null]
  b.main = [null, null, null]
  L.tireMain(a)
  L.tireMain(b)
  assert.deepEqual(a.main, b.main)
})

test('deux cents parties automatiques : aucune ne casse un invariant', () => {
  let finies = 0
  let plusHaut = 0
  for (let g = 0; g < 200; g++) {
    const p = L.nouvelle(g * 5081 + 3)
    let coups = 0
    while (!p.fini && coups < 400) {
      const k = p.main.findIndex((id) => id && L.placeExiste(p, id))
      if (k < 0) break
      const id = p.main[k]
      let pose = false
      for (let l = 0; l < p.taille && !pose; l++) {
        for (let c = 0; c < p.taille && !pose; c++) if (L.peutPoser(p, id, c, l)) pose = !!L.pose(p, k, c, l)
      }
      if (!pose) break
      coups++
      plusHaut = Math.max(plusHaut, L.palier(p))
      assert.equal(p.cases.length, p.taille * p.taille, 'la grille a changé de taille toute seule')
      assert.ok(p.score >= 0)
      assert.ok(p.main.length === L.EN_MAIN)
      for (const i of p.cases) assert.ok(i >= 0 && i <= 5, 'teinte de bloc hors palette')
      for (const s of p.spec) assert.ok(s === '' || TRANSFO[s], 'transformation inconnue sur la grille')
    }
    if (p.fini) finies++
  }
  assert.ok(finies > 150, `seulement ${finies} parties sur 200 se terminent`)
  // L'automate le plus bête qui soit — première pièce, première place — ne
  // doit pas aller loin dans les paliers de musique. Il en franchit un de temps
  // en temps sur deux cents parties, et c'est très bien : ce qu'on interdit,
  // c'est qu'il en enchaîne, ce qui voudrait dire que les cinquante bandes sont
  // à portée de n'importe quoi.
  assert.ok(plusHaut <= 2, `l’automate le plus bête atteint le palier ${plusHaut}`)
})

// --- Le directeur de difficulté ----------------------------------------------------

test('le directeur ne donne jamais une main dont rien n’entre', () => {
  // La promesse la plus importante du jeu : perdre doit venir du plateau qu'on
  // a construit, jamais du tirage. On remplit des plateaux jusqu'au bord et on
  // vérifie que tant qu'une pièce peut entrer, la main en contient une.
  for (let g = 0; g < 300; g++) {
    const p = L.nouvelle(g * 7717 + 11)
    let coups = 0
    while (!p.fini && coups++ < 300) {
      const jouable = PIECES.some((x) => L.placeExiste(p, x.id))
      if (jouable) {
        assert.ok(
          p.main.some((id) => id && L.placeExiste(p, id)),
          `graine ${g}, coup ${coups} : une pièce entrait, la main n’en proposait aucune`,
        )
      }
      const k = p.main.findIndex((id) => id && L.placeExiste(p, id))
      if (k < 0) break
      const id = p.main[k]
      let pose = false
      for (let l = 0; l < p.taille && !pose; l++) {
        for (let c = 0; c < p.taille && !pose; c++) if (L.peutPoser(p, id, c, l)) pose = !!L.pose(p, k, c, l)
      }
      if (!pose) break
    }
  }
})

test('l’aisance monte quand on dégage, et baisse quand on s’enlise', () => {
  const vide = plateau(8)
  vide.main = ['unite', 'unite', 'unite']
  const large = Dir.lecture(vide, 2, 30)

  const charge = plateau(8)
  for (let i = 0; i < 52; i++) charge.cases[i] = 1
  charge.main = ['unite', 'unite', 'unite']
  const serre = Dir.lecture(charge, 0, 1)

  assert.ok(large > serre + 0.3, `plateau dégagé ${large.toFixed(2)} contre encombré ${serre.toFixed(2)}`)
})

test('la difficulté ne redescend jamais sous le plancher de la partie', () => {
  const p = L.nouvelle(1)
  p.aisance = 0
  p.poses = 0
  const debut = Dir.difficulte(p)
  p.poses = 400
  assert.ok(Dir.difficulte(p) > debut, 'une longue partie ne durcit pas le jeu')
  assert.ok(Dir.difficulte(p) >= 0.6 - 1e-9, 'le plancher ne monte pas jusqu’à 0,6')
})

test('à difficulté haute les grosses pièces sortent plus, sans que rien disparaisse', () => {
  const facile = L.nouvelle(1)
  facile.aisance = 0
  facile.poses = 0
  const dur = L.nouvelle(1)
  dur.aisance = 1
  dur.poses = 0

  const part = (p) => {
    const v = Dir.vivier(p)
    const total = v.reduce((s, e) => s + e.poids, 0)
    const gros = v.filter((e) => e.piece.cases.length >= 4).reduce((s, e) => s + e.poids, 0)
    return gros / total
  }
  assert.ok(part(dur) > part(facile) * 1.3, `${part(dur).toFixed(3)} contre ${part(facile).toFixed(3)}`)
  // Et aucune pièce n'est jamais exclue : un contenu qui ne sort plus est un
  // contenu perdu.
  for (const p of [facile, dur]) for (const e of Dir.vivier(p)) assert.ok(e.poids > 0, `${e.piece.id} : poids nul`)
})

test('le directeur reste reproductible depuis la graine', () => {
  const joue = (g) => {
    const p = L.nouvelle(g)
    for (let i = 0; i < 40; i++) {
      const k = p.main.findIndex((id) => id && L.placeExiste(p, id))
      if (k < 0) break
      const id = p.main[k]
      let pose = false
      for (let l = 0; l < p.taille && !pose; l++) {
        for (let c = 0; c < p.taille && !pose; c++) if (L.peutPoser(p, id, c, l)) pose = !!L.pose(p, k, c, l)
      }
      if (!pose) break
    }
    return [p.score, p.aisance.toFixed(9), p.main.join(',')]
  }
  assert.deepEqual(joue(4242), joue(4242))
})

test('l’aisance survit à la sauvegarde', () => {
  const p = L.nouvelle(9)
  p.aisance = 0.813
  const relu = L.migre(JSON.parse(JSON.stringify(L.sauvegarde(p))))
  assert.equal(relu.aisance, 0.813, 'reprendre une partie repart au mauvais niveau de jeu')
})

test('la partie n’a plus ni objectif ni monde', () => {
  assert.equal(L.objectif, undefined)
  assert.equal(L.suivant, undefined)
  assert.equal(L.monde, undefined)
  const p = L.nouvelle(1)
  assert.equal(p.n, undefined, 'un numéro de monde traîne encore dans l’état')
  assert.equal(p.taille, 8)
})
