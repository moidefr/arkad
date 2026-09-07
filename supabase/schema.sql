-- ARKAD — le schéma des comptes et des classements.
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
  ('esquive', 'ESQUIVE', 'court', 600, 1),
  ('voltige', 'VOLTIGE', 'court', 700, 1),
  ('grimpe', 'GRIMPE', 'court', 400, 1),
  ('slalom', 'SLALOM', 'court', 60, 1),
  ('fusee', 'FUSÉE', 'court', 1500, 1),
  ('casse-brique', 'BRIQUES', 'court', 3000, 1),
  ('serpent', 'SERPENT', 'court', 300, 1),
  ('orbite', 'ORBITE', 'court', 400, 1),
  ('balance', 'BALANCE', 'court', 900, 1),
  ('pile', 'PILE', 'court', 40, 1),
  ('corde', 'CORDE', 'court', 120, 1),
  ('cibles', 'CIBLES', 'court', 800, 1),
  ('rythme', 'RYTHME', 'court', 900, 1),
  ('gardien', 'GARDIEN', 'court', 40, 1),
  ('tri', 'TRI', 'court', 500, 1),
  ('memoire', 'MÉMOIRE', 'court', 400, 1),
  ('couleur', 'COULEUR', 'court', 600, 1),
  ('calcul', 'CALCUL', 'court', 500, 1),
  ('visee', 'VISÉE', 'court', 60, 1),
  ('geste', 'GESTE', 'court', 60, 1),
  ('trace', 'TRACÉ', 'court', 400, 1),
  ('eclair', 'ÉCLAIR', 'court', 40, 1),
  ('paires', 'PAIRES', 'court', 30, 1),
  ('dedale', 'DÉDALE', 'court', 25, 1),
  ('demineur', 'DÉMINEUR', 'moyen', 12000, 1.4),
  ('mille', '2048', 'moyen', 20000, 1.4),
  ('taquin', 'TAQUIN', 'moyen', 2200, 1.4),
  ('picross', 'PICROSS', 'moyen', 3000, 1.4),
  ('sudoku', 'SUDOKU', 'moyen', 3200, 1.4),
  ('lumieres', 'LUMIÈRES', 'moyen', 1600, 1.4),
  ('code', 'CODE', 'moyen', 2000, 1.4),
  ('solitaire', 'SOLITAIRE', 'moyen', 1000, 1.4),
  ('flux', 'FLUX', 'moyen', 3000, 1.4),
  ('expedition', 'EXPÉDITION', 'long', 4000, 2),
  ('breche', 'BRÈCHE', 'long', 2000, 2),
  ('abyme', 'ABYME', 'long', 60, 2),
  ('caravane', 'CARAVANE', 'long', 20000, 2),
  ('vivier', 'VIVIER', 'long', 40, 2)
on conflict (id) do update
  set nom = excluded.nom,
      categorie = excluded.categorie,
      reference = excluded.reference,
      ponderation = excluded.ponderation;

-- Un jeu retiré du catalogue disparaît du barème, et ses scores avec lui :
-- sans ça, un classement général traînerait éternellement les points d'un jeu
-- auquel plus personne ne peut jouer.
delete from public.jeux where id not in ('esquive', 'voltige', 'grimpe', 'slalom', 'fusee', 'casse-brique', 'serpent', 'orbite', 'balance', 'pile', 'corde', 'cibles', 'rythme', 'gardien', 'tri', 'memoire', 'couleur', 'calcul', 'visee', 'geste', 'trace', 'eclair', 'paires', 'dedale', 'demineur', 'mille', 'taquin', 'picross', 'sudoku', 'lumieres', 'code', 'solitaire', 'flux', 'expedition', 'breche', 'abyme', 'caravane', 'vivier');

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

  gagnes := round(j.ponderation * 1000 * least(p_score / j.reference, 2.5));

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

-- Au général : la somme des 5 meilleurs jeux de chacun. Tout
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
where r.n <= 5
group by p.pseudo;
