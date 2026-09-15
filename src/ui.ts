import type { CallStatus, Persona, TranscriptTurn } from "./types.ts";

const MODE_LABEL: Record<string, string> = {
  roleplay: "Rollenspiel",
  coaching: "Coaching-Pause",
  demo: "Demonstration",
  debrief: "Debrief",
};

const STATUS_LABEL: Record<CallStatus, string> = {
  idle: "Bereit",
  connecting: "Verbinde …",
  listening: "Zuhören",
  user_speaking: "Du sprichst",
  ai_speaking: "Gegenstelle spricht",
  switching: "Aktualisiere …",
  error: "Fehler",
};

export function statusLabel(status: CallStatus): string {
  return STATUS_LABEL[status];
}

export function modeLabel(mode: string): string {
  return MODE_LABEL[mode] ?? mode;
}

export function renderDifficulty(score: number): string {
  return Array.from({ length: 5 }, (_, index) => (index < score ? "●" : "○")).join(" ");
}

export function fillPersonaCard(root: HTMLElement, persona: Persona, you: string): void {
  root.innerHTML = `
    <p class="eyebrow">${escapeHtml(persona.company)}</p>
    <h2>${escapeHtml(persona.name)}</h2>
    <p class="role">${escapeHtml(persona.title)}</p>
    <p class="difficulty" title="Persona-Grundhärte">${renderDifficulty(persona.defaultDifficulty)} <span>${escapeHtml(persona.difficultyLabel)}</span></p>
    <p class="brief">${escapeHtml(persona.brief)}</p>
    <dl>
      <div><dt>Will</dt><dd>${escapeHtml(persona.wants)}</dd></div>
      <div><dt>Härte</dt><dd>${escapeHtml(persona.howHard)}</dd></div>
      <div><dt>Abnahme</dt><dd>${escapeHtml(persona.openingLineHint)}</dd></div>
    </dl>
    <p class="you">${escapeHtml(you)}</p>
  `;
}

export function renderTranscript(root: HTMLElement, turns: TranscriptTurn[], traineeLabel: string): void {
  if (turns.length === 0) {
    root.innerHTML = `<p class="empty">Noch kein Gespräch. «Gespräch starten» oder «Ring, Ring» nach dem Verbinden.</p>`;
    return;
  }
  root.innerHTML = turns
    .map((turn) => {
      const who =
        turn.role === "user" ? `Du (${traineeLabel})` : turn.role === "assistant" ? "Gegenstelle" : "System";
      const live = turn.live ? " live" : "";
      return `<article class="turn ${turn.role}${live}"><span>${escapeHtml(who)}</span><p>${escapeHtml(turn.text)}</p></article>`;
    })
    .join("");
  root.scrollTop = root.scrollHeight;
}

export function setPressed(buttons: NodeListOf<HTMLButtonElement>, key: string, value: string): void {
  buttons.forEach((button) => {
    const active = button.dataset[key] === value;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

export function setStatus(el: HTMLElement, status: CallStatus, detail = ""): void {
  el.dataset.status = status;
  el.innerHTML = `<i></i><strong>${statusLabel(status)}</strong>${detail ? `<span>${escapeHtml(detail)}</span>` : ""}`;
}

export function setModeChip(el: HTMLElement, mode: string): void {
  el.dataset.mode = mode;
  el.textContent = modeLabel(mode);
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
