import { KokoroTTS } from "https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js";

const VOICE = { bella: "af_bella", puck: "am_puck" };

let engine = null;
let loading = null;
let ctx = null;
let playing = null;

function setStatus(s) {
  window.MRJ_KOKORO.status = s;
  window.dispatchEvent(new CustomEvent("mrj-kokoro-status", { detail: s }));
}

async function ensure() {
  if (engine) return engine;
  if (loading) return loading;
  setStatus("loading");
  loading = (async () => {
    engine = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
      dtype: "q8",
      device: "wasm",
    });
    window.MRJ_KOKORO.ready = true;
    setStatus("ready");
    return engine;
  })().catch((err) => {
    loading = null;
    setStatus("fail");
    throw err;
  });
  return loading;
}

function stop() {
  try {
    if (playing) {
      playing.stop();
      playing.disconnect();
    }
  } catch (_) {}
  playing = null;
}

async function playRaw(raw) {
  const sr = raw.sampling_rate || raw.samplerate || 24000;
  let data = raw.audio || raw.data;
  if (!data) throw new Error("no audio");
  if (data.audio) data = data.audio;
  const samples = data instanceof Float32Array ? data : Float32Array.from(data);
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") await ctx.resume();
  stop();
  const buf = ctx.createBuffer(1, samples.length, sr);
  buf.copyToChannel(samples, 0);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  playing = src;
  await new Promise((resolve) => {
    src.onended = () => {
      if (playing === src) playing = null;
      resolve();
    };
    src.start();
  });
}

window.MRJ_KOKORO = {
  ready: false,
  status: "boot",
  boot: ensure,
  stop,
  async speak(text, voiceName) {
    const t = String(text || "").trim();
    if (!t) return false;
    const tts = await ensure();
    const voice = VOICE[voiceName] || VOICE.puck;
    const raw = await tts.generate(t, { voice, speed: 1 });
    await playRaw(raw);
    return true;
  },
};

ensure().catch((e) => console.error("Kokoro boot", e));
