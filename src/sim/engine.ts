import { AlertEngine, type AlertRecord } from "./alerts";
import { sampleFleet, type DeviceSample } from "./telemetry";

export type EngineListener = (event: EngineEvent) => void;

export type EngineEvent =
  | { type: "tick"; samples: DeviceSample[]; elapsedSec: number }
  | { type: "alerts"; alerts: AlertRecord[]; changed: AlertRecord[] };

/**
 * Browser-side twin engine: 1 Hz telemetry + alert evaluation.
 * Survives React remounts via module singleton.
 */
class TwinEngine {
  private listeners = new Set<EngineListener>();
  private samples = new Map<string, DeviceSample>();
  private alerts = new AlertEngine();
  private startedAt = 0;
  private timer: number | undefined;
  private seeded = false;

  subscribe(listener: EngineListener): () => void {
    this.ensureStarted();
    this.listeners.add(listener);
    // Push current snapshot so new subscribers paint immediately.
    listener({ type: "tick", samples: [...this.samples.values()], elapsedSec: this.elapsed() });
    listener({ type: "alerts", alerts: this.alerts.list(), changed: [] });
    return () => {
      this.listeners.delete(listener);
    };
  }

  acknowledge(alertId: string, ackedBy = "Operator"): AlertRecord | { error: string } {
    this.ensureStarted();
    const result = this.alerts.acknowledge(alertId, ackedBy);
    if (!("error" in result)) {
      this.emit({ type: "alerts", alerts: this.alerts.list(), changed: [result] });
    }
    return result;
  }

  latest(deviceId: string): DeviceSample | undefined {
    this.ensureStarted();
    return this.samples.get(deviceId);
  }

  allSamples(): DeviceSample[] {
    this.ensureStarted();
    return [...this.samples.values()];
  }

  listAlerts(): AlertRecord[] {
    this.ensureStarted();
    return this.alerts.list();
  }

  private ensureStarted() {
    if (this.timer !== undefined) return;
    const now = Date.now();
    this.startedAt = now;
    if (!this.seeded) {
      this.alerts.seedHistory(now);
      this.seeded = true;
    }
    this.tick();
    this.timer = window.setInterval(() => this.tick(), 1000);
  }

  private elapsed() {
    return (Date.now() - this.startedAt) / 1000;
  }

  private tick() {
    const now = Date.now();
    const elapsedSec = this.elapsed();
    const batch = sampleFleet(now, elapsedSec);
    for (const s of batch) this.samples.set(s.deviceId, s);
    this.emit({ type: "tick", samples: batch, elapsedSec });

    const changed: AlertRecord[] = [];
    for (const s of batch) changed.push(...this.alerts.evaluate(s));
    if (changed.length) {
      this.emit({ type: "alerts", alerts: this.alerts.list(), changed });
    }
  }

  private emit(event: EngineEvent) {
    for (const l of this.listeners) l(event);
  }
}

export const twinEngine = new TwinEngine();
