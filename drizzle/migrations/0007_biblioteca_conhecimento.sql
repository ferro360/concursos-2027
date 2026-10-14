create extension if not exists vector;

create table public.knowledge_docs (
  id bigserial primary key,
  user_id uuid not null,
  titulo text not null,
  disciplina_id bigint references public.disciplinas(id) on delete set null,
  conteudo text not null,
  created_at timestamptz not null default now()
);

create table public.knowledge_chunks (
  id bigserial primary key,
  doc_id bigint not null references public.knowledge_docs(id) on delete cascade,
  ordem int not null default 0,
  conteudo text not null,
  embedding vector(3072) not null
);

create index if not exists knowledge_chunks_embedding_idx
  on public.knowledge_chunks using hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);

GRANT SELECT ON public.knowledge_docs TO authenticated;
GRANT SELECT, INSERT ON public.knowledge_chunks TO authenticated;
GRANT ALL ON public.knowledge_docs TO service_role;
GRANT ALL ON public.knowledge_chunks TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.knowledge_docs_id_seq, public.knowledge_chunks_id_seq TO authenticated;

alter table public.knowledge_docs enable row level security;
alter table public.knowledge_chunks enable row level security;

create policy "docs leitura para logados"
  on public.knowledge_docs for select to authenticated using (true);
create policy "docs inserir admin"
  on public.knowledge_docs for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));
create policy "docs excluir admin"
  on public.knowledge_docs for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create policy "chunks leitura para logados"
  on public.knowledge_chunks for select to authenticated using (true);
create policy "chunks inserir admin"
  on public.knowledge_chunks for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

create or replace function public.match_knowledge(
  query_embedding vector(3072),
  match_count int default 12,
  filtro_disciplina bigint default null
)
returns table (
  id bigint,
  doc_id bigint,
  titulo text,
  ordem int,
  conteudo text,
  similarity float
)
language sql stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.doc_id,
    d.titulo,
    c.ordem,
    c.conteudo,
    1 - (c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) as similarity
  from public.knowledge_chunks c
  join public.knowledge_docs d on d.id = c.doc_id
  where filtro_disciplina is null or d.disciplina_id = filtro_disciplina
  order by c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  limit match_count;
$$;

grant execute on function public.match_knowledge(vector(3072), int, bigint) to authenticated;
