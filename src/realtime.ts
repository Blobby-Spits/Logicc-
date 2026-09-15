import type { CallStatus, TranscriptTurn } from "./types.ts";

const REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";

export interface RealtimeHandlers {
  onStatus: (status: CallStatus) => void;
  onTranscript: (turns: TranscriptTurn[]) => void;
  onError: (message: string) => void;
  onUserUtterance?: (text: string) => void;
}

function waitForIce(pc: RTCPeerConnection, timeoutMs = 2500): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(), timeoutMs);
    const onChange = () => {
      if (pc.iceGatheringState === "complete") {
        window.clearTimeout(timer);
        pc.removeEventListener("icegatheringstatechange", onChange);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", onChange);
  });
}

export class RealtimeCall {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private mic: MediaStream | null = null;
  private remoteAudio: HTMLAudioElement;
  private turns: TranscriptTurn[] = [];
  private assistantBuffer = "";
  private userLiveId: string | null = null;
  private muted = false;
  private closing = false;

  constructor(private readonly handlers: RealtimeHandlers) {
    this.remoteAudio = document.createElement("audio");
    this.remoteAudio.autoplay = true;
    this.remoteAudio.setAttribute("playsinline", "true");
    this.remoteAudio.style.display = "none";
    document.body.append(this.remoteAudio);
  }

  get isConnected(): boolean {
    return this.dc?.readyState === "open";
  }

  get isMuted(): boolean {
    return this.muted;
  }

  async connect(ephemeralKey: string, config: { instructions: string; cue: string; reasoningEffort?: string }): Promise<void> {
    await this.disconnect();
    this.closing = false;
    this.turns = [];
    this.assistantBuffer = "";
    this.userLiveId = null;
    this.emitTranscript();
    this.handlers.onStatus("connecting");

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    this.pc = pc;

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) {
        this.remoteAudio.srcObject = stream;
        void this.remoteAudio.play().catch(() => {
          /* Autoplay nach User-Geste; der Start-Button gilt als Geste. */
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (this.closing) return;
      if (pc.connectionState === "failed") {
        this.handlers.onError("WebRTC-Verbindung unterbrochen.");
        this.handlers.onStatus("error");
      }
    };

    try {
      this.mic = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch {
      this.handlers.onError("Mikrofonzugriff verweigert. Bitte im Browser erlauben und erneut starten.");
      this.handlers.onStatus("error");
      await this.disconnect();
      throw new Error("mic-denied");
    }

    for (const track of this.mic.getTracks()) {
      pc.addTrack(track, this.mic);
    }

    const dc = pc.createDataChannel("oai-events");
    this.dc = dc;
    dc.addEventListener("message", (event) => this.onServerEvent(event.data));

    const opened = new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("Data-Channel Timeout")), 15000);
      dc.addEventListener("open", () => {
        window.clearTimeout(timer);
        resolve();
      });
      dc.addEventListener("error", () => {
        window.clearTimeout(timer);
        reject(new Error("Data-Channel Fehler"));
      });
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIce(pc);

    const sdp = pc.localDescription?.sdp;
    if (!sdp) throw new Error("Kein lokales SDP.");

    const sdpResponse = await fetch(REALTIME_CALLS_URL, {
      method: "POST",
      body: sdp,
      headers: {
        Authorization: `Bearer ${ephemeralKey}`,
        "Content-Type": "application/sdp",
      },
    });

    const answerSdp = await sdpResponse.text();
    if (!sdpResponse.ok) {
      let detail = answerSdp.slice(0, 280);
      try {
        const parsed = JSON.parse(answerSdp) as { error?: { message?: string } };
        if (parsed.error?.message) detail = parsed.error.message;
      } catch {
        /* SDP-Fehlertext belassen */
      }
      this.handlers.onError(`Realtime-Call fehlgeschlagen: ${detail}`);
      this.handlers.onStatus("error");
      await this.disconnect();
      throw new Error(detail);
    }

    await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
    await opened;

    this.sendSessionUpdate(config.instructions, config.cue, config.reasoningEffort);
    this.handlers.onStatus("listening");
  }

  applyInstructions(instructions: string, cue: string, note: string, reasoningEffort = "low"): void {
    if (!this.isConnected) return;
    this.handlers.onStatus("switching");
    this.pushTurn("system", note);
    this.send({ type: "response.cancel" });
    this.sendSessionUpdate(instructions, cue, reasoningEffort);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.mic?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }

  async disconnect(): Promise<void> {
    this.closing = true;
    this.dc?.close();
    this.dc = null;
    this.pc?.getSenders().forEach((sender) => sender.track?.stop());
    this.pc?.close();
    this.pc = null;
    this.mic?.getTracks().forEach((track) => track.stop());
    this.mic = null;
    this.remoteAudio.srcObject = null;
    this.muted = false;
  }

  snapshot(): TranscriptTurn[] {
    return this.turns.filter((turn) => !turn.live);
  }

  private send(event: Record<string, unknown>): void {
    if (this.dc?.readyState !== "open") return;
    this.dc.send(JSON.stringify(event));
  }

  private sendSessionUpdate(instructions: string, cue: string, reasoningEffort = "low"): void {
    this.send({
      type: "session.update",
      session: {
        type: "realtime",
        instructions,
        output_modalities: ["audio"],
        reasoning: { effort: reasoningEffort },
        audio: {
          input: {
            transcription: { model: "gpt-4o-mini-transcribe", language: "de" },
            turn_detection: { type: "semantic_vad" },
          },
        },
      },
    });

    this.send({
      type: "response.create",
      response: {
        output_modalities: ["audio"],
        instructions: cue,
      },
    });
  }

  private onServerEvent(raw: string): void {
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }

    const type = String(event.type ?? "");

    if (type === "error" || type === "response.failed") {
      const error = event.error;
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: unknown }).message)
          : "Realtime-Fehler";
      this.handlers.onError(message);
      this.handlers.onStatus("error");
      return;
    }

    if (type === "input_audio_buffer.speech_started") {
      this.assistantBuffer = "";
      this.userLiveId = `u-${Date.now()}`;
      this.upsertTurn({ id: this.userLiveId, role: "user", text: "…", live: true });
      this.handlers.onStatus("user_speaking");
      return;
    }

    if (type === "input_audio_buffer.speech_stopped") {
      this.handlers.onStatus("listening");
      return;
    }

    if (
      type === "conversation.item.input_audio_transcription.delta" ||
      type === "conversation.item.input_audio_transcription.completed"
    ) {
      const text =
        type.endsWith("completed") && typeof event.transcript === "string"
          ? event.transcript
          : typeof event.delta === "string"
            ? event.delta
            : "";
      if (!text) return;
      const id = this.userLiveId ?? `u-${Date.now()}`;
      const existing = this.turns.find((turn) => turn.id === id && turn.role === "user");
      const nextText =
        type.endsWith("completed")
          ? text.trim()
          : `${existing && existing.text !== "…" ? existing.text : ""}${text}`;
      this.upsertTurn({
        id,
        role: "user",
        text: nextText.trim(),
        live: !type.endsWith("completed"),
      });
      if (type.endsWith("completed")) {
        this.userLiveId = null;
        if (nextText) this.handlers.onUserUtterance?.(nextText);
      }
      return;
    }

    if (
      type === "response.output_audio_transcript.delta" ||
      type === "response.audio_transcript.delta"
    ) {
      const delta = typeof event.delta === "string" ? event.delta : "";
      this.assistantBuffer += delta;
      this.upsertTurn({
        id: "assistant-live",
        role: "assistant",
        text: this.assistantBuffer,
        live: true,
      });
      this.handlers.onStatus("ai_speaking");
      return;
    }

    if (
      type === "response.output_audio_transcript.done" ||
      type === "response.audio_transcript.done"
    ) {
      const finalText =
        (typeof event.transcript === "string" && event.transcript) || this.assistantBuffer;
      if (finalText.trim()) {
        this.turns = this.turns.filter((turn) => turn.id !== "assistant-live");
        this.pushTurn("assistant", finalText.trim());
      }
      this.assistantBuffer = "";
      return;
    }

    if (type === "response.done" || type === "response.output_audio.done") {
      if (this.assistantBuffer.trim()) {
        this.turns = this.turns.filter((turn) => turn.id !== "assistant-live");
        this.pushTurn("assistant", this.assistantBuffer.trim());
        this.assistantBuffer = "";
      }
      this.handlers.onStatus("listening");
    }
  }

  private pushTurn(role: TranscriptTurn["role"], text: string): void {
    this.turns = [
      ...this.turns.slice(-18),
      { id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`, role, text },
    ];
    this.emitTranscript();
  }

  private upsertTurn(turn: TranscriptTurn): void {
    const index = this.turns.findIndex((item) => item.id === turn.id);
    if (index === -1) {
      this.turns = [...this.turns.slice(-18), turn];
    } else {
      const next = this.turns.slice();
      next[index] = turn;
      this.turns = next;
    }
    this.emitTranscript();
  }

  private emitTranscript(): void {
    this.handlers.onTranscript(this.turns);
  }
}
