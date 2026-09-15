# Logicc Call Trainer

Localhost-Webapp für **Cold-Call-Rollenspiele** von Logicc-Account-Executives. Du sprichst ins Mikrofon, die Gegenstelle antwortet mit OpenAI Realtime Audio (GPT Live / Realtime API, WebRTC).

v0 ist ein Gerüst: zwei Default-Personas (**Empfang**, **Entscheider**), editierbare JSON-Prompts, Rollenwechsel ohne Reload. Vollständigere Personas folgen später.

## Start

Voraussetzung: Node 20+, ein OpenAI-API-Key mit Zugriff auf die Realtime API.

```bash
cp .env.example .env.local
# OPENAI_API_KEY=sk-... eintragen

npm install
npm run dev
```

Browser: [http://127.0.0.1:5173](http://127.0.0.1:5173)

Der lange API-Key bleibt auf dem Vite-Dev-Server. Der Browser bekommt nur ein kurzlebiges Ephemeral-Token (`ek_…`) und verbindet sich per WebRTC mit `https://api.openai.com/v1/realtime/calls`.

Optional:

```bash
OPENAI_REALTIME_MODEL=gpt-realtime   # Alias statt Snapshot gpt-realtime-2.1
npm test
```

## Rollen wechseln

Oben **Empfang** | **Entscheider**:

| Rolle        | Default-Figur                         | Datei                         |
| ------------ | ------------------------------------- | ----------------------------- |
| Empfang      | Sandra Keller, Gatekeeperin Nordwerk  | `personas/empfang.json`       |
| Entscheider  | Dr. Markus Weber, Geschäftsführer     | `personas/entscheider.json`   |

Gemeinsamer Szenario-Rahmen: `personas/context.json` (Logicc AE ruft Nordwerk an; Angebot ist Platzhalter).

- **Vor dem Gespräch:** die aktive Rolle bestimmt Token-Session und Stimme (`coral` / `cedar`).
- **Während des Gesprächs:** `session.update` + kurze Durchstellungs-Cue, ohne Seiten-Reload. Die **Stimme bleibt**, sobald die Session schon Audio erzeugt hat (Limit der Realtime API). Für eine neue Stimme: auflegen und neu starten.

Typischer Ablauf zum Üben: Empfang → durchgestellt fühlen → Tab **Entscheider**.

## UI-Zustände

Bereit · Verbinde · Zuhören · Du sprichst · Gegenstelle spricht · Rolle wechselt · Fehler (Mikro verweigert, fehlender Key, OpenAI-Fehler).

Gespräch ist **vollduplex** (Semantic VAD), nicht Push-to-Talk. Großer Button startet/beendet den Call; optional Mikro stumm.

## Architektur

```
Browser  --POST /api/session-->  Vite-Plugin (OPENAI_API_KEY)
                                 --POST /v1/realtime/client_secrets--> OpenAI
Browser  <-- ek_ token ---------
Browser  --SDP WebRTC---------->  /v1/realtime/calls
Events (Transkript, session.update) über Data-Channel `oai-events`
```

Personas liegen als JSON, werden serverseitig geladen, an `/api/personas` gegeben und in die Session-Instructions geschrieben.

## Bekannte Limits (v0)

- Prompts sind **Platzhalter**. Inhalt und Härte später schärfen; UI zeigt den Rohprompt unter dem Klapptext.
- Realtime-Session max. ~60 Minuten; Ephemeral-Tokens sind kurzlebig — pro Gespräch neu minten.
- Stimme nach erstem Audio in der Session nicht wechselbar.
- Transkript ist eine Hilfe, kein juristisches Call-Recording.
- Localhost / `127.0.0.1` (Mikrofon-Permission). Nicht als statische Netlify-Seite deployen: der Token-Endpoint braucht eine Server-Funktion. Intendierter Name, falls später Functions: `draft-logicc-call-trainer-v1`.
- Ohne gültigen Key startet die UI, der Call endet mit einer deutschen Fehlermeldung.

## xAI

Umgesetzt ist **OpenAI Realtime** (WebRTC). xAI hat in den Grok-Produkten Voice, aber keine vergleichbare öffentliche Browser-Realtime-API mit Ephemeral-WebRTC wie OpenAI. Kein Blocker — OpenAI ist der Pfad.

## Prompts als Nächstes

Erwartet: konkretes Logicc-Angebot, Einwandbibliothek, Scoring. Bis dahin Dateien in `personas/` editieren und Dev-Server neu laden (JSON wird beim Request gelesen).
