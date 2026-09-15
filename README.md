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

Der lange Key bleibt auf dem Vite-Server. Der Browser bekommt ein Ephemeral-Token und verbindet per WebRTC mit `/v1/realtime/calls`.

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
- **Empfang | Entscheider** — Gegenstelle; Wechsel mitten im Call per `session.update`.
- **Rollenspiel / Pause / Demo / Debrief**

Sprachbefehle: «Ring, Ring» · «Kurz raus aus dem Gespräch» · «Weiter» · «Neustart» · «Mach es schwieriger/einfacher» · «Übernimm beide Rollen» · «Gespräch beenden» · «Gib mir Feedback».

Live-Transkript und lokale Gesprächshistorie (Browser `localStorage`).

## Default-Szenario

Logicc-AE oder -SDR ruft **RheinSicher AG** an (BaFin-Umfeld). Zuerst Sandra Keller (Empfang), dann Dr. Markus Weber (Vorstand Operations). Verborgenes Kaufmotiv des Entscheiders: Kontrolle / Risiko, nicht «Innovation». Produktclaims nur aus dem Logicc-Stub — nichts erfinden.

## Limits

- Produkt- und Branchenmodule sind **Stubs**; Dateien ersetzen, ohne `core-simulation.md` umzuschreiben.
- Stimme nach erstem Audio in der Session nicht wechselbar.
- Session ca. 60 Min. «Ring, Ring» ohne Klick startet das Mikrofon in manchen Browsern nicht — erst «Gespräch starten».
- Localhost; nicht als reine Netlify-Statikseite. Intendierter Name später: `draft-logicc-call-trainer-v1`.

## xAI

Umgesetzt ist OpenAI Realtime. xAI hat keine vergleichbare öffentliche Browser-WebRTC-API.
