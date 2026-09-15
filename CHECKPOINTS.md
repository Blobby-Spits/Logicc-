# CHECKPOINTS

## CP-002 [15.09.2026 - 19:20]
- Browser-Check auf http://127.0.0.1:5173: Rollenwechsel Empfang/Entscheider aktualisiert die Persona-Karte ohne Reload.
- Fehlender Key: Status «Fehler», Button «Erneut versuchen», deutsche Meldung zu `.env.local`.
- Header-Health und Prompt-Summary nach dem Check nachgeschärft (kein Full-Uppercase, Health in eigener Zeile).

## CP-001 [15.09.2026 - 18:56]
- Greenfield-Scaffold **Logicc Call Trainer**: Vite + TypeScript, deutsche UI, Document-Title dreiteilig.
- Personas Empfang (Sandra Keller) und Entscheider (Dr. Markus Weber) als JSON plus gemeinsamem `personas/context.json`.
- Localhost-Pfad: `npm install && npm run dev`, `OPENAI_API_KEY` nur in `.env.local`, Ephemeral-Token über `/api/session`.
