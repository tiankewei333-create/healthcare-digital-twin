import { ALERT_RULES, type AlertSeverity, type AlertState } from "../domain/ward";
import type { MetricKey } from "../domain/metrics";
import type { DeviceSample } from "./telemetry";

export interface AlertRecord {
  alertId: string;
  deviceId: string;
  ruleId: string;
  metric: MetricKey;
  title: string;
  severity: AlertSeverity;
  state: AlertState;
  value: number;
  /** Worst value observed while the alert was open. */
  peak: number;
  /** False once the reading is back in range but the latched alert still awaits ack. */
  conditionActive: boolean;
  threshold: number;
  raisedAt: number;
  ackedAt?: number;
  ackedBy?: string;
  clearedAt?: number;
}

export class AlertEngine {
  private alerts = new Map<string, AlertRecord>();
  private openByKey = new Map<string, string>();

  list(): AlertRecord[] {
    return [...this.alerts.values()].sort((a, b) => b.raisedAt - a.raisedAt);
  }

  activeCount(): number {
    let n = 0;
    for (const a of this.alarmsValues()) if (a.state === "active") n += 1;
    return n;
  }

  openCount(): number {
    return this.openByKey.size;
  }

  get(alertId: string): AlertRecord | undefined {
    return this.alerts.get(alertId);
  }

  /** Seed a few cleared historical alerts so the panel is never empty on first paint. */
  seedHistory(now: number) {
    const seeds: Array<Omit<AlertRecord, "alertId"> & { alertId?: string }> = [
      {
        deviceId: "dev-mon-301b",
        ruleId: "hr-high",
        metric: "heartRate",
        title: "Tachycardia",
        severity: "warning",
        state: "cleared",
        value: 138,
        peak: 138,
        conditionActive: false,
        threshold: 130,
        raisedAt: now - 3.2 * 3_600_000,
        ackedAt: now - 3.1 * 3_600_000,
        ackedBy: "RN Chen",
        clearedAt: now - 3.05 * 3_600_000,
      },
      {
        deviceId: "dev-fridge-meds",
        ruleId: "fridge-high",
        metric: "fridgeTemp",
        title: "Cold-chain excursion",
        severity: "critical",
        state: "cleared",
        value: 9.4,
        peak: 9.4,
        conditionActive: false,
        threshold: 8,
        raisedAt: now - 14 * 3_600_000,
        ackedAt: now - 13.8 * 3_600_000,
        ackedBy: "Pharmacy",
        clearedAt: now - 13.6 * 3_600_000,
      },
    ];
    for (const s of seeds) {
      const alertId = s.alertId ?? `alm_${s.deviceId}_${s.ruleId}_${s.raisedAt}`;
      this.upsert({ ...s, alertId });
    }
  }

  evaluate(sample: DeviceSample): AlertRecord[] {
    const changed: AlertRecord[] = [];
    for (const rule of ALERT_RULES) {
      const value = sample.metrics[rule.metric];
      if (value === undefined) continue;
      const fired = rule.high ? value > rule.threshold : value < rule.threshold;
      const open = this.findOpen(sample.deviceId, rule.id);

      if (fired) {
        if (!open) {
          changed.push(
            this.upsert({
              alertId: `alm_${sample.deviceId}_${rule.id}_${sample.ts}`,
              deviceId: sample.deviceId,
              ruleId: rule.id,
              metric: rule.metric,
              title: rule.title,
              severity: rule.severity,
              state: "active",
              value,
              peak: value,
              conditionActive: true,
              threshold: rule.threshold,
              raisedAt: sample.ts,
            }),
          );
        } else {
          const peak = rule.high ? Math.max(open.peak, value) : Math.min(open.peak, value);
          this.upsert({ ...open, value, peak, conditionActive: true, threshold: rule.threshold });
        }
        continue;
      }

      if (open?.state === "acked") {
        changed.push(
          this.upsert({
            ...open,
            state: "cleared",
            value,
            conditionActive: false,
            threshold: rule.threshold,
            clearedAt: Date.now(),
          }),
        );
      } else if (open?.state === "active") {
        this.upsert({ ...open, value, conditionActive: false, threshold: rule.threshold });
      }
    }
    return changed;
  }

  acknowledge(alertId: string, ackedBy: string): AlertRecord | { error: string } {
    const alert = this.alerts.get(alertId);
    if (!alert) return { error: "not_found" };
    if (alert.state !== "active") return { error: "not_active" };
    const now = Date.now();
    return this.upsert({ ...alert, state: "acked", ackedAt: now, ackedBy });
  }

  private findOpen(deviceId: string, ruleId: string): AlertRecord | undefined {
    const id = this.openByKey.get(`${deviceId}:${ruleId}`);
    return id ? this.alerts.get(id) : undefined;
  }

  private upsert(alert: AlertRecord): AlertRecord {
    this.alerts.set(alert.alertId, alert);
    const key = `${alert.deviceId}:${alert.ruleId}`;
    if (alert.state === "cleared") {
      if (this.openByKey.get(key) === alert.alertId) this.openByKey.delete(key);
    } else {
      this.openByKey.set(key, alert.alertId);
    }
    return alert;
  }

  private alarmsValues() {
    return this.alerts.values();
  }
}
