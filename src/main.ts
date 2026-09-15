import { composePrompt, createSession, fetchCatalog, fetchHealth } from "./api.ts";
import { loadHistory, saveHistory, turnsForHistory } from "./history.ts";
import { RealtimeCall } from "./realtime.ts";
import { detectVoiceCommand } from "../shared/commands.ts";
import type { AppMode, Catalog, Persona, PersonaId, TraineeRole } from "./types.ts";
import {
  fillPersonaCard,
  modeLabel,
  renderTranscript,
  setModeChip,
  setPressed,
  setStatus,
  escapeHtml,
} from "./ui.ts";

function requireEl<T extends Element>(el: T | null, name: string): T {
  if (!el) throw new Error(`UI-Markup unvollständig: ${name}`);
  return el;
}

const roleButtons = document.querySelectorAll<HTMLButtonElement>("[data-role]");
const traineeButtons = document.querySelectorAll<HTMLButtonElement>("[data-trainee]");
const modeButtons = document.querySelectorAll<HTMLButtonElement>(".modes [data-mode]");
const personaCard = requireEl(document.querySelector<HTMLElement>("#persona-card"), "persona-card");
const statusEl = requireEl(document.querySelector<HTMLElement>("#status"), "status");
const transcriptEl = requireEl(document.querySelector<HTMLElement>("#transcript"), "transcript");
const callButton = requireEl(document.querySelector<HTMLButtonElement>("#call-toggle"), "call-toggle");
const muteButton = requireEl(document.querySelector<HTMLButtonElement>("#mute-toggle"), "mute-toggle");
const endButton = requireEl(document.querySelector<HTMLButtonElement>("#end-call"), "end-call");
const errorEl = requireEl(document.querySelector<HTMLElement>("#error"), "error");
const healthEl = requireEl(document.querySelector<HTMLElement>("#health"), "health");
const promptEl = requireEl(document.querySelector<HTMLElement>("#prompt-preview"), "prompt-preview");
const scenarioSelect = requireEl(document.querySelector<HTMLSelectElement>("#scenario"), "scenario");
const difficultyInput = requireEl(document.querySelector<HTMLInputElement>("#difficulty"), "difficulty");
const difficultyValue = requireEl(document.querySelector<HTMLElement>("#difficulty-value"), "difficulty-value");
const modeChip = requireEl(document.querySelector<HTMLElement>("#mode-chip"), "mode-chip");
const historyEl = requireEl(document.querySelector<HTMLElement>("#history"), "history");

let catalog: Catalog | null = null;
let personas: Persona[] = [];
let personaId: PersonaId = "empfang";
let traineeRole: TraineeRole = "ae";
let mode: AppMode = "roleplay";
let scenarioId = "rheinsicher-outbound";
let difficulty = 3;
let connected = false;
let reasoningEffort = "low";
let handlingCommand = false;

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
  onTranscript: (turns) => renderTranscript(transcriptEl, turns, traineeRole === "sdr" ? "SDR" : "AE"),
  onError: (message) => {
    errorEl.hidden = false;
    errorEl.textContent = message;
  },
  onUserUtterance: (text) => {
    void handleUtterance(text);
  },
});

function currentPersona(): Persona {
  const found = personas.find((persona) => persona.id === personaId);
  if (!found) throw new Error("Persona fehlt.");
  return found;
}

function requestBody() {
  return { personaId, scenarioId, traineeRole, difficulty, mode };
}

function syncUi(): void {
  setPressed(roleButtons, "role", personaId);
  setPressed(traineeButtons, "trainee", traineeRole);
  setPressed(modeButtons, "mode", mode);
  setModeChip(modeChip, mode);
  difficultyValue.textContent = String(difficulty);
  difficultyInput.value = String(difficulty);
  const persona = currentPersona();
  const you =
    traineeRole === "sdr"
      ? "Du bist SDR bei Logicc. Ziel: richtige Person, Anlass, erster Termin — keine volle Discovery."
      : "Du bist Account Executive bei Logicc. Nach der Durchstellung: Status quo, Motiv, belastbarer nächster Schritt.";
  fillPersonaCard(personaCard, persona, you);
}

function renderHistory(): void {
  const items = loadHistory();
  if (items.length === 0) {
    historyEl.innerHTML = `<p class="empty">Lokal im Browser. Wird beim Beenden/Debrief gespeichert.</p>`;
    return;
  }
  historyEl.innerHTML = items
    .map((item) => {
      const when = new Date(item.endedAt).toLocaleString("de-DE");
      return `<article class="history-item"><strong>${escapeHtml(item.scenarioTitle)}</strong><span>${escapeHtml(when)} · ${item.traineeRole.toUpperCase()} · ${escapeHtml(item.personaName)} · ${escapeHtml(modeLabel(item.mode))}</span></article>`;
    })
    .join("");
}

function persistCall(finalMode: AppMode): void {
  const persona = currentPersona();
  const scenarioTitle = catalog?.scenarios.find((item) => item.id === scenarioId)?.title ?? scenarioId;
  saveHistory({
    id: `${Date.now()}`,
    endedAt: new Date().toISOString(),
    scenarioTitle,
    traineeRole,
    personaName: persona.name,
    mode: finalMode,
    turns: turnsForHistory(call.snapshot()),
  });
  renderHistory();
}

async function pushSession(note: string, extra: { opening?: boolean; transfer?: boolean } = {}): Promise<void> {
  const composed = await composePrompt({ ...requestBody(), ...extra });
  promptEl.textContent = composed.preview;
  personas = personas.map((persona) => (persona.id === composed.persona.id ? composed.persona : persona));
  if (!call.isConnected) return;
  call.applyInstructions(composed.instructions, composed.cue, note, reasoningEffort);
}

async function selectPersona(id: PersonaId): Promise<void> {
  personaId = id;
  syncUi();
  if (call.isConnected) {
    await pushSession(`Rolle wechselt zu ${currentPersona().name}.`, { transfer: true });
  } else {
    try {
      const composed = await composePrompt(requestBody());
      promptEl.textContent = composed.preview;
    } catch {
      /* Preview optional */
    }
  }
}

async function setMode(next: AppMode, note?: string): Promise<void> {
  mode = next;
  syncUi();
  if (call.isConnected) {
    await pushSession(note ?? `Modus: ${modeLabel(next)}.`);
  }
}

async function handleUtterance(text: string): Promise<void> {
  if (handlingCommand) return;
  const command = detectVoiceCommand(text);
  if (!command) return;
  handlingCommand = true;
  try {
    if (command === "start") {
      if (!call.isConnected) {
        errorEl.hidden = false;
        errorEl.textContent = "Fürs Mikrofon bitte zuerst «Gespräch starten» klicken.";
        return;
      }
      mode = "roleplay";
      syncUi();
      await pushSession("Neustart der Szene.", { opening: true });
      return;
    }
    if (command === "coaching") {
      await setMode("coaching");
      return;
    }
    if (command === "resume") {
      await setMode("roleplay", "Weiter an derselben Stelle.");
      return;
    }
    if (command === "restart") {
      mode = "roleplay";
      syncUi();
      await pushSession("Neustart.", { opening: true });
      return;
    }
    if (command === "harder") {
      difficulty = Math.min(5, difficulty + 1);
      syncUi();
      await pushSession(`Schwierigkeit jetzt ${difficulty}. In der Rolle bleiben.`);
      return;
    }
    if (command === "easier") {
      difficulty = Math.max(1, difficulty - 1);
      syncUi();
      await pushSession(`Schwierigkeit jetzt ${difficulty}. In der Rolle bleiben.`);
      return;
    }
    if (command === "demo") {
      await setMode("demo");
      return;
    }
    if (command === "end") {
      persistCall("roleplay");
      await setMode("debrief", "Gespräch beendet, Debrief.");
      return;
    }
    if (command === "debrief") {
      persistCall("debrief");
      await setMode("debrief");
    }
  } finally {
    handlingCommand = false;
  }
}

async function hangUp(): Promise<void> {
  await call.disconnect();
  connected = false;
  muteButton.classList.remove("is-on");
  muteButton.setAttribute("aria-pressed", "false");
  muteButton.textContent = "Mikro stumm";
  setStatus(statusEl, "idle", "Aufgelegt");
  callButton.textContent = "Gespräch starten";
  mode = "roleplay";
  syncUi();
}

async function boot(): Promise<void> {
  setStatus(statusEl, "idle");
  renderTranscript(transcriptEl, [], "AE");
  renderHistory();

  try {
    const health = await fetchHealth();
    reasoningEffort = health.reasoningEffort || "low";
    healthEl.textContent = health.hasApiKey
      ? `Key geladen · ${health.model} · reasoning ${health.reasoningEffort}`
      : "Kein OPENAI_API_KEY — .env.local setzen";
    healthEl.dataset.ok = String(health.hasApiKey);
  } catch {
    healthEl.textContent = "API nicht erreichbar";
    healthEl.dataset.ok = "false";
  }

  catalog = await fetchCatalog();
  personas = catalog.personas;
  scenarioSelect.innerHTML = catalog.scenarios
    .map((item) => {
      const disabled = item.enabled ? "" : " disabled";
      const selected = item.id === scenarioId && item.enabled ? " selected" : "";
      return `<option value="${escapeHtml(item.id)}"${disabled}${selected}>${escapeHtml(item.title)}</option>`;
    })
    .join("");
  const firstEnabled = catalog.scenarios.find((item) => item.enabled);
  if (firstEnabled) scenarioId = firstEnabled.id;
  scenarioSelect.value = scenarioId;
  syncUi();
  const composed = await composePrompt(requestBody());
  promptEl.textContent = composed.preview;
}

callButton.addEventListener("click", async () => {
  errorEl.hidden = true;
  if (connected || call.isConnected) {
    persistCall(mode);
    await hangUp();
    return;
  }

  callButton.disabled = true;
  setStatus(statusEl, "connecting");
  mode = "roleplay";
  syncUi();
  try {
    const secret = await createSession(requestBody());
    promptEl.textContent = secret.preview;
    await call.connect(secret.value, {
      instructions: secret.instructions,
      cue: secret.cue,
      reasoningEffort,
    });
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

endButton.addEventListener("click", async () => {
  if (!call.isConnected) {
    await hangUp();
    return;
  }
  persistCall("debrief");
  await setMode("debrief", "Gespräch beendet.");
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
    if (id === "empfang" || id === "entscheider") void selectPersona(id);
  });
});

traineeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const id = button.dataset.trainee;
    if (id === "sdr" || id === "ae") {
      traineeRole = id;
      syncUi();
      if (call.isConnected) void pushSession(`Nutzerrolle jetzt ${id.toUpperCase()}.`);
    }
  });
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const id = button.dataset.mode;
    if (id === "roleplay" || id === "coaching" || id === "demo" || id === "debrief") {
      void setMode(id);
    }
  });
});

scenarioSelect.addEventListener("change", () => {
  scenarioId = scenarioSelect.value;
  if (call.isConnected) void pushSession("Szenario aktualisiert.", { opening: true });
  else void composePrompt(requestBody()).then((composed) => {
    promptEl.textContent = composed.preview;
  });
});

difficultyInput.addEventListener("input", () => {
  difficulty = Number(difficultyInput.value);
  difficultyValue.textContent = String(difficulty);
});

difficultyInput.addEventListener("change", () => {
  if (call.isConnected) void pushSession(`Schwierigkeit ${difficulty}.`);
});

void boot().catch((error: unknown) => {
  errorEl.hidden = false;
  errorEl.textContent = error instanceof Error ? error.message : "Start fehlgeschlagen.";
});
