# CHECKPOINTS

## CP-005 [16.09.2026 - 10:00]
- Produktions-Fix für logicc-peach: explizite Vercel-Routen `api/health|catalog|personas|compose|session` plus Catch-all, alle rufen `handleApiRequest`.
- `vercel.json`: Vite → `dist`, SPA-Rewrite ohne `/api/*`, `includeFiles` für JSON/MD, Hobby `maxDuration` 10.
- Serverless findet Personas/Prompts über `process.cwd()` / `LAMBDA_TASK_ROOT`; README mit `OPENAI_API_KEY` plus optionalem Modell und Reasoning-Effort.

## CP-004 [15.09.2026 - 22:42]
- `buildRealtimeSessionConfig` setzt `session.audio.output.format.rate` auf `24000` (OpenAI GA PCM, analog zum Input).
- Typ `RealtimePcmAudioFormat` in `server/types.ts` für Input- und Output-Format; Konstante `PCM_AUDIO_FORMAT` in `server/session.ts`.
- Unit-Test prüft den Client-Secrets-Payload-Pfad `session.audio.output.format.rate`.

## CP-003 [15.09.2026 - 19:33]
- Modulare Prompt-Architektur: Core, SDR/AE, Szenario, Produkt- und Branchen-Stub, getrennte Modi (Rollenspiel, Coaching, Demo, Debrief).
- Default-Szenario RheinSicher Outbound (regulierte Versicherung) mit verborgener Entscheider-Innenlage; Empfang/Entscheider bleiben.
- UI: SDR|AE, Szenario, Schwierigkeit, Modusanzeige, Sprachbefehle, lokale Historie; Modell `gpt-realtime-2` mit `reasoning.effort: low`.

## CP-002 [15.09.2026 - 19:20]
- Browser-Check auf http://127.0.0.1:5173: Rollenwechsel Empfang/Entscheider aktualisiert die Persona-Karte ohne Reload.
- Fehlender Key: Status «Fehler», Button «Erneut versuchen», deutsche Meldung zu `.env.local`.
- Header-Health und Prompt-Summary nach dem Check nachgeschärft (kein Full-Uppercase, Health in eigener Zeile).

## CP-001 [15.09.2026 - 18:56]
- Greenfield-Scaffold **Logicc Call Trainer**: Vite + TypeScript, deutsche UI, Document-Title dreiteilig.
- Personas Empfang (Sandra Keller) und Entscheider (Dr. Markus Weber) als JSON plus gemeinsamem `personas/context.json`.
- Localhost-Pfad: `npm install && npm run dev`, `OPENAI_API_KEY` nur in `.env.local`, Ephemeral-Token über `/api/session`.
