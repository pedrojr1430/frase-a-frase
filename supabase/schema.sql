-- Frase a Frase — banco do login (Supabase)
-- Rodar uma vez em: Supabase > SQL Editor > New query > colar tudo > Run.

-- Progresso: uma linha por chave salva no aparelho (fraseafrase.v2, fraseafrase.curso, ...).
create table if not exists public.progresso (
  user_id       uuid        not null references auth.users (id) on delete cascade,
  chave         text        not null check (chave like 'fraseafrase.%' and length(chave) <= 80),
  dados         text        not null check (length(dados) <= 2000000),
  atualizado_em timestamptz not null default now(),
  primary key (user_id, chave)
);

-- Segurança: cada pessoa só lê e grava o próprio progresso.
alter table public.progresso enable row level security;

drop policy if exists "ler o proprio progresso"     on public.progresso;
drop policy if exists "criar o proprio progresso"   on public.progresso;
drop policy if exists "alterar o proprio progresso" on public.progresso;
drop policy if exists "apagar o proprio progresso"  on public.progresso;

create policy "ler o proprio progresso"     on public.progresso for select to authenticated using ((select auth.uid()) = user_id);
create policy "criar o proprio progresso"   on public.progresso for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "alterar o proprio progresso" on public.progresso for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "apagar o proprio progresso"  on public.progresso for delete to authenticated using ((select auth.uid()) = user_id);

-- Só quem está logado acessa a tabela (as regras acima limitam ao próprio progresso).
revoke all on public.progresso from anon;
grant select, insert, update, delete on public.progresso to authenticated;

-- Excluir conta: apaga o usuário (o progresso some junto, pelo "on delete cascade").
create or replace function public.excluir_minha_conta()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.excluir_minha_conta() from public, anon;
grant execute on function public.excluir_minha_conta() to authenticated;
