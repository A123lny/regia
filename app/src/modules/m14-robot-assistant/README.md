# M14 · Robot Assistant

Assistente AI in-app per la Regìa: una pallina fluttuante 🤖 nell'angolo in basso a destra, con due anime: **tutor** (spiega come si fa una cosa) e **agente** (la fa al posto dell'utente, rispettando ruoli, conferme e policy del capitolato).

- **Design**: [2026-11-16-robottino-ai-regia-design.md](../../../../docs/superpowers/specs/2026-11-16-robottino-ai-regia-design.md)
- **Plan**: [2026-11-16-robottino-ai-regia.md](../../../../docs/superpowers/plans/2026-11-16-robottino-ai-regia.md)

## Confini

- Un solo export pubblico oggi: `RobotWidget` (da inserire nel layout protetto)
- Tipi pubblici: `RobotMessage`, `RobotToolCall`, `RobotConversation`, `RobotPageContext`
- Dipendenze cross-modulo: solo via `public.ts` (M01 data-hub per Contatti, M11 admin per budget AI, lib/auth per sessione e capability, lib/audit per log)

## Vincoli dal capitolato

Il modulo rispetta RA-8.6 (il modello propone, il codice dispone), RA-8.7 (input esterno non fidato), §8.2 (categorie mai autonome) e RF-6.15..6.20 (regole commerciali fisse). Le policy sono applicate nei tool server-side, mai nel system prompt del modello.
