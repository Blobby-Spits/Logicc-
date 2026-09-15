import { createSession, fetchHealth, fetchPersonas } from "./api.ts";
import { RealtimeCall } from "./realtime.ts";
import type { Persona } from "./types.ts";
import { fillPersonaCard, renderTranscript, setActiveRole, setStatus } from "./ui.ts";

function requireEl<T extends Element>(el: T | null, name: string): T {
  if (!el) throw new Error(`UI-Markup unvollständig: ${name}`);
  return el;
}

const roleButtons = document.querySelectorAll<HTMLButtonElement>("[data-role]");
const personaCard = requireEl(document.querySelector<HTMLElement>("#persona-card"), "persona-card");
const statusEl = requireEl(document.querySelector<HTMLElement>("#status"), "status");
const transcriptEl = requireEl(document.querySelector<HTMLElement>("#transcript"), "transcript");
const callButton = requireEl(document.querySelector<HTMLButtonElement>("#call-toggle"), "call-toggle");
const muteButton = requireEl(document.querySelector<HTMLButtonElement>("#mute-toggle"), "mute-toggle");
const errorEl = requireEl(document.querySelector<HTMLElement>("#error"), "error");
const healthEl = requireEl(document.querySelector<HTMLElement>("#health"), "health");
const promptEl = requireEl(document.querySelector<HTMLElement>("#prompt-preview"), "prompt-preview");

let personas: Persona[] = [];
let activeId: Persona["id"] = "empfang";
let connected = false;
let contextRef: Awaited<ReturnType<typeof fetchPersonas>>["context"] | undefined;

const call = new RealtimeCall({
  onStatus: (status) => {
    setStatus(statusEl, status);
    callButton.disabled = status === "connecting" || status === "switching";
    if (status === "connecting") callButton.textContent = "Verbinde …";
    if (status === "listening" || status === "user_speaking" || status === "ai_speaking") {
      callButton.textContent = "Auflegen";
      connected = true;
    }
    if (status === "idle") {
      callButton.textContent = "Gespräch starten";
      connected = false;
    }
    if (status === "error") {
      callButton.textContent = "Erneut versuchen";
      connected = false;
    }
  },
  onTranscript: (turns) => renderTranscript(transcriptEl, turns),
  onError: (message) => {
    errorEl.hidden = false;
    errorEl.textContent = message;
  },
  onPersonaApplied: (persona) => {
    errorEl.hidden = true;
    promptEl.textContent = persona.instructionsPlaceholder;
  },
});

function currentPersona(): Persona {
  const found = personas.find((persona) => persona.id === activeId);
  if (!found) throw new Error("Persona fehlt.");
  return found;
}

function selectRole(id: Persona["id"]): void {
  if (!contextRef) return;
  activeId = id;
  setActiveRole(roleButtons, id);
  const persona = currentPersona();
  fillPersonaCard(personaCard, persona, contextRef);
  promptEl.textContent = persona.instructionsPlaceholder;
  if (call.isConnected) {
    call.applyPersona(persona);
  }
}

async function boot(): Promise<void> {
  setStatus(statusEl, "idle");
  renderTranscript(transcriptEl, []);

  try {
    const health = await fetchHealth();
    healthEl.textContent = health.hasApiKey
      ? `Key geladen · Modell ${health.model}`
      : "Kein OPENAI_API_KEY — .env.local setzen";
    healthEl.dataset.ok = String(health.hasApiKey);
  } catch {
    healthEl.textContent = "API nicht erreichbar";
    healthEl.dataset.ok = "false";
  }

  const payload = await fetchPersonas();
  personas = payload.personas;
  contextRef = payload.context;
  selectRole("empfang");
}

callButton.addEventListener("click", async () => {
  errorEl.hidden = true;
  if (connected || call.isConnected) {
    await call.disconnect();
    connected = false;
    call.setMuted(false);
    muteButton.classList.remove("is-on");
    muteButton.setAttribute("aria-pressed", "false");
    muteButton.textContent = "Mikro stumm";
    setStatus(statusEl, "idle", "Aufgelegt");
    callButton.textContent = "Gespräch starten";
    return;
  }

  callButton.disabled = true;
  setStatus(statusEl, "connecting");
  try {
    const secret = await createSession(activeId);
    await call.connect(secret.value, currentPersona());
    connected = true;
    callButton.textContent = "Auflegen";
    setStatus(statusEl, "listening");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verbindung fehlgeschlagen.";
    if (message !== "mic-denied") {
      errorEl.hidden = false;
      errorEl.textContent = message;
    }
    setStatus(statusEl, "error");
    callButton.textContent = "Erneut versuchen";
    connected = false;
  } finally {
    callButton.disabled = false;
  }
});

muteButton.addEventListener("click", () => {
  const next = !call.isMuted;
  call.setMuted(next);
  muteButton.classList.toggle("is-on", next);
  muteButton.setAttribute("aria-pressed", String(next));
  muteButton.textContent = next ? "Mikro an" : "Mikro stumm";
});

roleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const id = button.dataset.role;
    if (id === "empfang" || id === "entscheider") selectRole(id);
  });
});

void boot().catch((error: unknown) => {
  errorEl.hidden = false;
  errorEl.textContent = error instanceof Error ? error.message : "Start fehlgeschlagen.";
});
