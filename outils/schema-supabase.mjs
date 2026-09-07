/**
 * Fabrique `supabase/schema.sql` : le schéma à coller dans l'éditeur SQL du
 * projet Supabase.
 *
 * Comme la console d'écoute, ce fichier **n'a pas sa propre copie** de ce
 * qu'il décrit. Les références et les pondérations sortent de
 * `src/classement/coefficients.js`, les jeux de `src/catalogue.js` : le
 * serveur recalcule donc les points avec exactement les nombres que le client
 * affiche. Un barème recopié à la main aurait divergé au premier réglage, et
 * personne ne s'en serait aperçu avant qu'un joueur ne compare deux totaux.
 *
 *   node outils/schema-supabase.mjs [chemin de sortie]
 *
 * Un test rejoue la génération et compare au fichier versionné : le jour où
 * l'on change une référence sans régénérer, `npm test` le dit.
 */
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CATEGORIES } from '../src/catalogue.js'
import { REFERENCES, PONDERATIONS, BASE, PLAFOND, RETENUS, classable } from '../src/classement/coefficients.js'

const ICI = dirname(fileURLToPath(import.meta.url))
const RACINE = resolve(ICI, '..')

/** Un jeu classable, avec sa catégorie — c'est elle qui porte la pondération. */
function jeuxClassables() {
  const lignes = []
  for (const cat of CATEGORIES) {
    for (const def of cat.jeux) {
      if (!classable(def)) continue
      lignes.push({ id: def.id, nom: def.nom, categorie: cat.id, reference: REFERENCES[def.id], ponderation: PONDERATIONS[cat.id] ?? 1 })
    }
  }
  return lignes
}

const guillemets = (s) => `'${String(s).replace(/'/g, "''")}'`

export function schema() {
  const jeux = jeuxClassables()
  const seed = jeux
    .map((j) => `  (${guillemets(j.id)}, ${guillemets(j.nom)}, ${guillemets(j.categorie)}, ${j.reference}, ${j.ponderation})`)
    .join(',\n')

  return `-- ARKAD — le schéma des comptes et des classements.
--
-- FICHIER GÉNÉRÉ : ne pas le modifier à la main.
--   node outils/schema-supabase.mjs
-- Les références et les pondérations viennent de src/classement/coefficients.js ;
-- c'est ce qui garantit que le serveur compte les points comme le client les
-- annonce.
--
-- À coller tel quel dans l'éditeur SQL du projet Supabase. Il est rejouable :
-- tout est en « create ... if not exists » ou en « create or replace ».
--
-- Un réglage à faire une fois dans la console, hors SQL :
-- Authentication → Providers → Email, décocher « Confirm email ». ARKAD
-- n'inscrit personne avec une vraie adresse (voir src/classement/compte.js) :
-- une confirmation par courriel n'arriverait nulle part.

-- --- Les joueurs -------------------------------------------------------------
--
-- auth.users garde le secret (le mot de passe, jamais nous) ; profils garde ce
-- qui est public : le pseudo affiché aux classements, et le Snap facultatif.

create table if not exists public.profils (
  id uuid primary key references auth.users on delete cascade,
  pseudo text unique not null check (pseudo ~ '^[A-Za-z0-9_-]{3,16}$'),
  snap text check (snap is null or snap ~ '^[A-Za-z0-9._-]{1,32}$'),
  cree_le timestamptz not null default now()
);

alter table public.profils enable row level security;

-- Un classement se lit à visage découvert : les pseudos sont publics, sinon
-- il n'y a rien à afficher. Le Snap, lui, ne sort jamais d'ici (voir la vue
-- classement_par_jeu) — on ne publie pas le réseau social de quelqu'un parce
-- qu'il a bien joué.
drop policy if exists "profils lisibles" on public.profils;
create policy "profils lisibles" on public.profils for select using (true);

drop policy if exists "chacun crée le sien" on public.profils;
create policy "chacun crée le sien" on public.profils for insert with check (auth.uid() = id);

drop policy if exists "chacun modifie le sien" on public.profils;
create policy "chacun modifie le sien" on public.profils for update using (auth.uid() = id) with check (auth.uid() = id);

-- --- Le barème ---------------------------------------------------------------
--
-- La table que le client ne peut pas mentir : c'est elle qui décide combien
-- vaut un score, pas le navigateur qui le pose.

create table if not exists public.jeux (
  id text primary key,
  nom text not null,
  categorie text not null,
  reference numeric not null check (reference > 0),
  ponderation numeric not null check (ponderation > 0)
);

alter table public.jeux enable row level security;

drop policy if exists "barème public" on public.jeux;
create policy "barème public" on public.jeux for select using (true);

insert into public.jeux (id, nom, categorie, reference, ponderation) values
${seed}
on conflict (id) do update
  set nom = excluded.nom,
      categorie = excluded.categorie,
      reference = excluded.reference,
      ponderation = excluded.ponderation;

-- Un jeu retiré du catalogue disparaît du barème, et ses scores avec lui :
-- sans ça, un classement général traînerait éternellement les points d'un jeu
-- auquel plus personne ne peut jouer.
delete from public.jeux where id not in (${jeux.map((j) => guillemets(j.id)).join(', ')});

-- --- Les scores --------------------------------------------------------------
--
-- Une ligne par joueur et par jeu : son meilleur. Garder tout l'historique
-- serait joli, mais un classement ne lit jamais que le sommet, et la table
-- grossirait d'une ligne à chaque partie perdue.

create table if not exists public.scores (
  joueur uuid not null references public.profils(id) on delete cascade,
  jeu text not null references public.jeux(id) on delete cascade,
  score numeric not null check (score >= 0),
  points numeric not null default 0,
  pose_le timestamptz not null default now(),
  primary key (joueur, jeu)
);

create index if not exists scores_par_jeu on public.scores (jeu, score desc);

alter table public.scores enable row level security;

drop policy if exists "scores lisibles" on public.scores;
create policy "scores lisibles" on public.scores for select using (true);

-- Aucune politique d'écriture : on ne pose pas un score en écrivant dans la
-- table, on passe par poser_score() ci-dessous. C'est ce qui rend impossible
-- d'inscrire 10 000 points à un jeu qui en vaut 40.

-- --- Poser un score ----------------------------------------------------------
--
-- Le seul chemin d'écriture. Il calcule les points lui-même, refuse un jeu
-- inconnu, et ne remplace le score existant que s'il est meilleur : rejouer
-- moins bien ne fait perdre son record à personne.

create or replace function public.poser_score(p_jeu text, p_score numeric)
returns public.scores
language plpgsql
security definer
set search_path = public
as $$
declare
  j public.jeux%rowtype;
  resultat public.scores%rowtype;
  gagnes numeric;
begin
  if auth.uid() is null then
    raise exception 'il faut un compte pour poser un score';
  end if;
  select * into j from public.jeux where id = p_jeu;
  if not found then
    raise exception 'jeu inconnu ou non classable : %', p_jeu;
  end if;
  if p_score is null or p_score < 0 or p_score <> p_score then
    raise exception 'score invalide';
  end if;

  gagnes := round(j.ponderation * ${BASE} * least(p_score / j.reference, ${PLAFOND}));

  insert into public.scores (joueur, jeu, score, points, pose_le)
  values (auth.uid(), p_jeu, p_score, gagnes, now())
  on conflict (joueur, jeu) do update
    set score = excluded.score, points = excluded.points, pose_le = excluded.pose_le
    where excluded.score > public.scores.score
  returning * into resultat;

  -- Rien à renvoyer veut dire « le score existant était meilleur » : on rend
  -- celui-là, pour que le client sache où il en est plutôt que de croire à
  -- une panne.
  if not found then
    select * into resultat from public.scores where joueur = auth.uid() and jeu = p_jeu;
  end if;
  return resultat;
end;
$$;

-- --- Les classements ---------------------------------------------------------
--
-- Par jeu : le score brut, celui que le joueur avait sous les yeux. Traduire
-- un classement de SERPENT en points normalisés n'aurait aucun sens pour
-- celui qui vient de finir sa partie.

create or replace view public.classement_par_jeu
with (security_invoker = on) as
select
  s.jeu,
  p.pseudo,
  s.score,
  s.points,
  s.pose_le,
  rank() over (partition by s.jeu order by s.score desc, s.pose_le asc) as rang
from public.scores s
join public.profils p on p.id = s.joueur;

-- Au général : la somme des ${RETENUS} meilleurs jeux de chacun. Tout
-- additionner ferait un classement d'assiduité — celui qui a tout essayé
-- battrait celui qui joue mieux.

create or replace view public.classement_general
with (security_invoker = on) as
with retenus as (
  select
    s.joueur,
    s.points,
    row_number() over (partition by s.joueur order by s.points desc) as n
  from public.scores s
)
select
  p.pseudo,
  sum(r.points) as points,
  count(*) as jeux,
  rank() over (order by sum(r.points) desc, p.pseudo asc) as rang
from retenus r
join public.profils p on p.id = r.joueur
where r.n <= ${RETENUS}
group by p.pseudo;
`
}

const sortie = process.argv[2] ?? resolve(RACINE, 'supabase/schema.sql')
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(sortie, schema())
  console.log(`${sortie} écrit (${jeuxClassables().length} jeux au barème)`)
}
