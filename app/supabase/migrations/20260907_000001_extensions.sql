-- 20260907_000001_extensions.sql
-- Estensioni di sistema attese dalla piattaforma.
-- pgcrypto: gen_random_uuid() per chiavi primarie.
-- pg_trgm: ricerca fuzzy nomi/etichette (RF-12.2).
-- vector: memoria dell'agente (RA-8.11) — pgvector nativo di Supabase.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists vector;
