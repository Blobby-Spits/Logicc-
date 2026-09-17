# Logicc Call Trainer

Lokal laufende Web-App für **realistische B2B-Vertriebsrollenspiele** mit OpenAI Realtime Voice (`gpt-realtime-2`, `reasoning.effort: low`). Du sprichst ins Mikrofon. Die KI ist im Rollenspiel **nur** Kunde — Empfang oder Entscheider —, kein Sales-Chatbot.

Coaching, Demo und Debrief sind eigene Modi (UI oder Sprachbefehl).

## Start

Node 20+, OpenAI-Key mit Realtime-Zugriff.

```bash
cp .env.example .env.local
# OPENAI_API_KEY=sk-...

npm install
npm run dev
```

Browser: [http://127.0.0.1:5173](http://127.0.0.1:5173)

```bash
OPENAI_REALTIME_MODEL=gpt-realtime-2
OPENAI_REASONING_EFFORT=low
npm test
```

Der lange Key bleibt auf dem Server. Der Browser bekommt ein Ephemeral-Token und verbindet per WebRTC mit `/v1/realtime/calls`.

## Vercel (Hobby)

Lokal läuft `/api/*` über das Vite-Plugin. Auf Vercel übernehmen `api/health.js`, `api/catalog.js`, `api/compose.js` und `api/session.js` dieselbe Logik (`handleApiRequest` via `api/_handler.js`). Build: Vite → `dist`. Function-Timeout: 10 Sekunden.

1. Repo auf Vercel importieren (Framework Vite, Output `dist`, Node 20+).
2. Umgebungsvariablen für **Production und Preview** setzen:
   - `OPENAI_API_KEY` (pflicht)
   - `OPENAI_REALTIME_MODEL` (optional, Default `gpt-realtime-2`, niemals den API-Key hier eintragen)
   - `OPENAI_REASONING_EFFORT` (optional, Default `low`)
3. Deployen. Nach Env-Änderungen neu deployen.

`npm run dev` bleibt unverändert für die lokale Arbeit.

## Prinzip

Trennung der Concerns — **nicht** alles in einen Global-Prompt backen:

| Schicht | Ort |
| --- | --- |
| Simulationsregeln, Stimme, Wissensgrenzen | `prompts/core-simulation.md` |
| SDR- vs. AE-Erwartung | `prompts/sales-sdr.md`, `prompts/sales-ae.md` |
| Gesprächslogik, VMZTA, RRM | `prompts/conversation-logic.md` |
| Empfang / Entscheider | `prompts/gatekeeper.md`, `prompts/decision-maker.md` |
| Modi | `prompts/modes/*.md` |
| Dynamisches Szenario | `scenarios/*.json` |
| Produkt | `modules/product/logicc.json` (Stub) |
| Branche | `modules/industry/regulated-insurance.json` (Stub) |
| Charakterkarten | `personas/empfang.json`, `personas/entscheider.json` |

Der Server komponiert die Session-Instructions mit kurzen, benannten Abschnitten. Die **Innenperspektive** des Entscheiders steht nur im Szenario und nicht auf der Persona-Karte.

## Bedienung

- **SDR | AE** — welche Leistung die Simulation (und das Debrief) erwartet.
- **Szenario** — Default: Cold Outbound RheinSicher AG (regulierte Kompositversicherung). Weitere Gesprächsarten sind als Stub im Dropdown.
- **Schwierigkeit 1–5**
- **Empfang | Entscheider** — Gegenstelle. Umschalten mitten im Call startet eine **neue Realtime-Session** (andere Stimme; der Entscheider bekommt kein Empfangs-Transkript). Stellt der Empfang durch, wechselt die UI automatisch auf Entscheider.
- **Rollenspiel / Pause / Demo / Debrief**

Sprachbefehle: «Ring, Ring» · «Kurz raus aus dem Gespräch» · «Weiter» · «Neustart» · «Mach es schwieriger/einfacher» · «Übernimm beide Rollen» · «Gespräch beenden» · «Gib mir Feedback».

Live-Transkript und lokale Gesprächshistorie (Browser `localStorage`).

## Durchstellung Empfang → Entscheider

Wenn Sandra Keller durchstellt (Realtime-Tool `transfer_to_entscheider` oder erkennbare Durchstell-Floskel), gilt derselbe Pfad wie der teal **Empfang | Entscheider**-Schalter:

1. UI wechselt auf Entscheider (Dr. Markus Weber).
2. Status **«Weiterleitung an Entscheider…»**.
3. Neues Ephemeral-Token / neuer WebRTC-Call mit Stimme `cedar` (Empfang bleibt `coral` in `personas/*.json`).
4. Der Entscheider erhält nur **einen Handoff-Satz** (Nutzen + Name), kein Empfangs-Transkript.

Keine zusätzlichen Env-Variablen. Weiterhin `OPENAI_API_KEY` (pflicht) plus optional `OPENAI_REALTIME_MODEL` und `OPENAI_REASONING_EFFORT`.

## Default-Szenario

Logicc-AE oder -SDR ruft **RheinSicher AG** an (BaFin-Umfeld). Zuerst Sandra Keller (Empfang), dann Dr. Markus Weber (Vorstand Operations). Verborgenes Kaufmotiv des Entscheiders: Kontrolle / Risiko, nicht «Innovation». Produktclaims nur aus dem Logicc-Stub — nichts erfinden.

## Limits

- Produkt- und Branchenmodule sind **Stubs**; Dateien ersetzen, ohne `core-simulation.md` umzuschreiben.
- Stimme nach erstem Audio in **derselben** Realtime-Session nicht wechselbar — deshalb startet die Durchstellung eine neue Session.
- Session ca. 60 Min. «Ring, Ring» ohne Klick startet das Mikrofon in manchen Browsern nicht — erst «Gespräch starten».
- Nicht als reine Statikseite deployen: `/api/health`, `/api/catalog`, `/api/compose` und `/api/session` brauchen die Vercel-Funktion.

## xAI

Umgesetzt ist OpenAI Realtime. xAI hat keine vergleichbare öffentliche Browser-WebRTC-API.
