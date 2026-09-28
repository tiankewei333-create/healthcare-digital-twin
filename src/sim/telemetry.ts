import type { MetricKey } from "../domain/metrics";
import type { Device, DeviceStatus } from "../domain/ward";
import { DEVICES } from "../domain/ward";

export type MetricValues = Partial<Record<MetricKey, number>>;

export interface DeviceSample {
  deviceId: string;
  ts: number;
  status: DeviceStatus;
  metrics: MetricValues;
}

/**
 * Scripted clinical incidents (seconds since engine start). Cycles so every
 * visitor sees the full alert loop within the first ~2 minutes.
 */
export const SCENARIOS = {
  spo2Drop: { deviceId: "dev-mon-303a", cycle: 120, start: 18, duration: 22 },
  fridgeWarm: { deviceId: "dev-fridge-meds", cycle: 150, start: 40, duration: 28 },
  pressureLoss: { deviceId: "dev-press-303", cycle: 180, start: 65, duration: 35 },
  o2Dip: { deviceId: "dev-o2-corridor", cycle: 200, start: 90, duration: 25 },
  infusionEmpty: { deviceId: "dev-pump-304a", cycle: 160, start: 55, duration: 40 },
} as const;

export type ScenarioKey = keyof typeof SCENARIOS;

export function inWindow(
  elapsedSec: number,
  s: { cycle: number; start: number; duration: number },
): boolean {
  const phase = elapsedSec % s.cycle;
  return phase >= s.start && phase < s.start + s.duration;
}

function hash(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function noise(seed: number, t: number): number {
  const i = Math.floor(t);
  const f = t - i;
  const a = hash(seed * 1013.7 + i);
  const b = hash(seed * 1013.7 + i + 1);
  const u = f * f * (3 - 2 * f);
  return (a + (b - a) * u) * 2 - 1;
}

function round(n: number, digits: number) {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

interface Baseline {
  seed: number;
  values: MetricValues;
}

const BASELINES: Record<string, Baseline> = {
  "dev-vent-303": { seed: 11, values: { fio2: 40, peep: 5, tidalVolume: 450, respRate: 16 } },
  "dev-mon-301a": { seed: 21, values: { heartRate: 78, spo2: 97, respRate: 15 } },
  "dev-mon-301b": { seed: 22, values: { heartRate: 92, spo2: 96, respRate: 18 } },
  "dev-mon-302a": { seed: 23, values: { heartRate: 71, spo2: 98, respRate: 14 } },
  "dev-mon-303a": { seed: 24, values: { heartRate: 88, spo2: 94, respRate: 20 } },
  "dev-mon-304a": { seed: 25, values: { heartRate: 75, spo2: 97, respRate: 15 } },
  "dev-pump-302a": { seed: 31, values: { infusionRate: 50, volumeRemaining: 220 } },
  "dev-pump-304a": { seed: 32, values: { infusionRate: 25, volumeRemaining: 80 } },
  "dev-fridge-meds": { seed: 41, values: { fridgeTemp: 4.2 } },
  "dev-press-303": { seed: 51, values: { roomPressure: -12 } },
  "dev-o2-corridor": { seed: 61, values: { o2Pressure: 420 } },
};

function sampleDevice(device: Device, ts: number, jitter = 0): DeviceSample {
  const base = BASELINES[device.id] ?? { seed: 99, values: {} };
  const metrics: MetricValues = {};
  const tSlow = ts / 120_000;
  const tFast = ts / 8_000;

  for (const key of device.metrics) {
    const mean = base.values[key];
    if (mean === undefined) continue;
    const slow = noise(base.seed, tSlow);
    const fast = noise(base.seed + 17, tFast);
    const j = (Math.random() * 2 - 1) * jitter;

    let value = mean + slow * amplitude(key) + fast * amplitude(key) * 0.35 + j;
    if (key === "volumeRemaining") {
      // Slowly depleting bag, replaced every ~12 minutes before it runs low.
      const cycle = 720_000;
      const phase = (ts + base.seed * 10_000) % cycle;
      const floor = 40;
      value = floor + (mean - floor) * (1 - phase / cycle) + slow * 2;
    }
    metrics[key] = round(clampMetric(key, value), digits(key));
  }

  return { deviceId: device.id, ts, status: "online", metrics };
}

function amplitude(key: MetricKey): number {
  switch (key) {
    case "heartRate":
      return 4;
    case "spo2":
      return 0.6;
    case "respRate":
      return 1.2;
    case "fio2":
      return 1;
    case "peep":
      return 0.2;
    case "tidalVolume":
      return 8;
    case "infusionRate":
      return 0.5;
    case "volumeRemaining":
      return 1;
    case "fridgeTemp":
      return 0.25;
    case "roomPressure":
      return 0.6;
    case "o2Pressure":
      return 4;
  }
}

function digits(key: MetricKey): number {
  switch (key) {
    case "peep":
    case "infusionRate":
    case "fridgeTemp":
    case "roomPressure":
      return 1;
    default:
      return 0;
  }
}

function clampMetric(key: MetricKey, value: number): number {
  switch (key) {
    case "spo2":
    case "fio2":
      return clamp(value, 0, 100);
    case "heartRate":
      return clamp(value, 20, 220);
    case "respRate":
      return clamp(value, 0, 60);
    case "volumeRemaining":
    case "tidalVolume":
    case "infusionRate":
    case "o2Pressure":
      return Math.max(0, value);
    default:
      return value;
  }
}

export function applyScenarios(
  sample: DeviceSample,
  elapsedSec: number,
): DeviceSample {
  const next: DeviceSample = {
    ...sample,
    metrics: { ...sample.metrics },
  };

  if (sample.deviceId === SCENARIOS.spo2Drop.deviceId && inWindow(elapsedSec, SCENARIOS.spo2Drop)) {
    next.metrics.spo2 = round(84 + Math.random() * 2, 0);
    next.metrics.heartRate = round(142 + Math.random() * 6, 0);
    next.status = "alarm";
  }
  if (sample.deviceId === SCENARIOS.fridgeWarm.deviceId && inWindow(elapsedSec, SCENARIOS.fridgeWarm)) {
    next.metrics.fridgeTemp = round(10.5 + Math.random() * 0.8, 1);
    next.status = "alarm";
  }
  if (sample.deviceId === SCENARIOS.pressureLoss.deviceId && inWindow(elapsedSec, SCENARIOS.pressureLoss)) {
    next.metrics.roomPressure = round(-1.5 + Math.random() * 1.2, 1);
    next.status = "alarm";
  }
  if (sample.deviceId === SCENARIOS.o2Dip.deviceId && inWindow(elapsedSec, SCENARIOS.o2Dip)) {
    next.metrics.o2Pressure = round(310 + Math.random() * 15, 0);
    next.status = "alarm";
  }
  if (sample.deviceId === SCENARIOS.infusionEmpty.deviceId && inWindow(elapsedSec, SCENARIOS.infusionEmpty)) {
    next.metrics.volumeRemaining = round(8 + Math.random() * 4, 0);
    next.status = "alarm";
  }
  return next;
}

export function sampleFleet(ts: number, elapsedSec: number, jitter = 0.4): DeviceSample[] {
  return DEVICES.map((d) => applyScenarios(sampleDevice(d, ts, jitter), elapsedSec));
}

/** Deterministic history point (no scenario overlay) for charts / FHIR export. */
export function historySample(deviceId: string, ts: number): DeviceSample {
  const device = DEVICES.find((d) => d.id === deviceId);
  if (!device) return { deviceId, ts, status: "offline", metrics: {} };
  return sampleDevice(device, ts, 0);
}
