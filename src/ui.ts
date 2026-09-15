import type { CallStatus, Persona, ScenarioContextView, TranscriptTurn } from "./types.ts";

const STATUS_LABEL: Record<CallStatus, string> = {
  idle: "Bereit",
  connecting: "Verbinde …",
  listening: "Zuhören",
  user_speaking: "Du sprichst",
  ai_speaking: "Gegenstelle spricht",
  switching: "Rolle wechselt …",
  error: "Fehler",
};

export function statusLabel(status: CallStatus): string {
  return STATUS_LABEL[status];
}

export function renderDifficulty(score: number): string {
  return Array.from({ length: 5 }, (_, index) => (index < score ? "●" : "○")).join(" ");
}

export function fillPersonaCard(
  root: HTMLElement,
  persona: Persona,
  context: ScenarioContextView,
): void {
  root.innerHTML = `
    <p class="eyebrow">${escapeHtml(persona.company)}</p>
    <h2>${escapeHtml(persona.name)}</h2>
    <p class="role">${escapeHtml(persona.title)}</p>
    <p class="difficulty" title="Schwierigkeit">${renderDifficulty(persona.difficulty)} <span>${escapeHtml(persona.difficultyLabel)}</span></p>
    <p class="brief">${escapeHtml(persona.brief)}</p>
    <dl>
      <div><dt>Will</dt><dd>${escapeHtml(persona.wants)}</dd></div>
      <div><dt>Härte</dt><dd>${escapeHtml(persona.howHard)}</dd></div>
      <div><dt>Abnahme</dt><dd>${escapeHtml(persona.openingLineHint)}</dd></div>
    </dl>
    <p class="you">Du bist ${escapeHtml(context.userRole.title)} bei ${escapeHtml(context.userRole.company)}.</p>
  `;
}

export function renderTranscript(root: HTMLElement, turns: TranscriptTurn[]): void {
  if (turns.length === 0) {
    root.innerHTML = `<p class="empty">Noch kein Gespräch. Starten, dann erscheinen die letzten Turns hier.</p>`;
    return;
  }
  root.innerHTML = turns
    .map((turn) => {
      const who =
        turn.role === "user" ? "Du (Logicc AE)" : turn.role === "assistant" ? "Gegenstelle" : "System";
      const live = turn.live ? " live" : "";
      return `<article class="turn ${turn.role}${live}"><span>${escapeHtml(who)}</span><p>${escapeHtml(turn.text)}</p></article>`;
    })
    .join("");
  root.scrollTop = root.scrollHeight;
}

export function setActiveRole(buttons: NodeListOf<HTMLButtonElement>, id: Persona["id"]): void {
  buttons.forEach((button) => {
    const active = button.dataset.role === id;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

export function setStatus(el: HTMLElement, status: CallStatus, detail = ""): void {
  el.dataset.status = status;
  el.innerHTML = `<i></i><strong>${statusLabel(status)}</strong>${detail ? `<span>${escapeHtml(detail)}</span>` : ""}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
