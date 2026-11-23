-- signup_landings.slug: la rotta pubblica /iscriviti/[slug] e' anonima
-- (nessuna org nel path). Due organizzazioni che registrano lo stesso slug
-- creano una collisione cross-tenant: un tenant puo' "squattare" lo slug
-- dell'altro, e la lookup diventa ambigua.
--
-- Fix: UNIQUE globale su slug (oltre al vincolo (org,slug) esistente).
-- Se ci sono duplicati pre-esistenti, la migration fallisce esplicita:
-- vanno rinominati a mano prima di applicarla.

do $$
declare
  dup_count int;
begin
  select count(*) into dup_count
  from (
    select slug
    from public.signup_landings
    group by slug
    having count(*) > 1
  ) s;
  if dup_count > 0 then
    raise exception
      'Esistono % slug duplicati in signup_landings cross-tenant. Risolvili prima di applicare il constraint UNIQUE globale.',
      dup_count;
  end if;
end$$;

alter table public.signup_landings
  add constraint signup_landings_slug_global_unique unique (slug);
