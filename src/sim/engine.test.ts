import { describe, expect, it } from "vitest";
import { ALERT_RULES, DEVICES } from "../domain/ward";
import { buildBundle } from "../fhir/export";
import { AlertEngine } from "./alerts";
import { applyScenarios, inWindow, sampleFleet, SCENARIOS } from "./telemetry";

describe("telemetry scenarios", () => {
  it("fires SpO2 drop inside the scripted window", () => {
    const elapsed = SCENARIOS.spo2Drop.start + 2;
    expect(inWindow(elapsed, SCENARIOS.spo2Drop)).toBe(true);
    const fleet = sampleFleet(Date.now(), elapsed, 0);
    const mon = fleet.find((s) => s.deviceId === SCENARIOS.spo2Drop.deviceId);
    expect(mon?.metrics.spo2).toBeLessThan(90);
    expect(mon?.status).toBe("alarm");
  });

  it("keeps baseline SpO2 outside the window", () => {
    const elapsed = SCENARIOS.spo2Drop.start - 5;
    expect(inWindow(elapsed, SCENARIOS.spo2Drop)).toBe(false);
    const fleet = sampleFleet(1_700_000_000_000, elapsed, 0);
    const mon = fleet.find((s) => s.deviceId === SCENARIOS.spo2Drop.deviceId);
    expect(mon?.metrics.spo2).toBeGreaterThan(90);
  });

  it("applies fridge warm scenario", () => {
    const base = {
      deviceId: SCENARIOS.fridgeWarm.deviceId,
      ts: Date.now(),
      status: "online" as const,
      metrics: { fridgeTemp: 4.2 },
    };
    const hot = applyScenarios(base, SCENARIOS.fridgeWarm.start + 1);
    expect(hot.metrics.fridgeTemp).toBeGreaterThan(8);
  });
});

describe("alert engine", () => {
  it("raises, acks and clears on threshold recovery", () => {
    const engine = new AlertEngine();
    const rule = ALERT_RULES.find((r) => r.id === "spo2-low")!;
    const deviceId = "dev-mon-303a";

    const raised = engine.evaluate({
      deviceId,
      ts: 1000,
      status: "alarm",
      metrics: { spo2: 85 },
    });
    expect(raised).toHaveLength(1);
    expect(raised[0].ruleId).toBe(rule.id);
    expect(raised[0].state).toBe("active");
    expect(engine.openCount()).toBe(1);

    const acked = engine.acknowledge(raised[0].alertId, "RN Test");
    expect("error" in acked).toBe(false);
    if (!("error" in acked)) expect(acked.state).toBe("acked");

    const cleared = engine.evaluate({
      deviceId,
      ts: 2000,
      status: "online",
      metrics: { spo2: 96 },
    });
    expect(cleared.some((a) => a.state === "cleared")).toBe(true);
    expect(engine.openCount()).toBe(0);
  });

  it("latches an unacknowledged alert and keeps the worst value", () => {
    const engine = new AlertEngine();
    const deviceId = "dev-mon-303a";
    const [raised] = engine.evaluate({ deviceId, ts: 1, status: "alarm", metrics: { spo2: 88 } });
    engine.evaluate({ deviceId, ts: 2, status: "alarm", metrics: { spo2: 84 } });
    engine.evaluate({ deviceId, ts: 3, status: "online", metrics: { spo2: 97 } });

    const latched = engine.get(raised.alertId)!;
    expect(latched.state).toBe("active");
    expect(latched.conditionActive).toBe(false);
    expect(latched.peak).toBe(84);
    expect(latched.value).toBe(97);
  });
});

describe("baseline telemetry", () => {
  it("raises no alerts outside scripted incident windows", () => {
    const engine = new AlertEngine();
    const quietSec = 5;
    for (const s of Object.values(SCENARIOS)) {
      expect(inWindow(quietSec, s)).toBe(false);
    }
    const start = 1_790_000_000_000;
    for (let i = 0; i < 2000; i++) {
      const raised = sampleFleet(start + i * 37_000, quietSec, 0).flatMap((s) =>
        engine.evaluate(s),
      );
      expect(raised).toEqual([]);
    }
  });

  it("flags isolation pressure loss when the room stops being negative", () => {
    const engine = new AlertEngine();
    const elapsed = SCENARIOS.pressureLoss.start + 1;
    const fleet = sampleFleet(Date.now(), elapsed, 0);
    const raised = fleet.flatMap((s) => engine.evaluate(s));
    expect(raised.map((a) => a.ruleId)).toContain("pressure-loss");
  });
});

describe("FHIR export", () => {
  it("emits Location, Device and Observation entries", () => {
    const samples = sampleFleet(Date.now(), 0, 0);
    const bundle = buildBundle(samples);
    expect(bundle.resourceType).toBe("Bundle");
    expect(bundle.type).toBe("collection");
    const types = new Set(bundle.entry.map((e) => e.resource.resourceType));
    expect(types.has("Location")).toBe(true);
    expect(types.has("Device")).toBe(true);
    expect(types.has("Observation")).toBe(true);
    expect(DEVICES.length).toBeGreaterThan(0);
    const obs = bundle.entry.filter((e) => e.resource.resourceType === "Observation");
    expect(obs.length).toBeGreaterThan(DEVICES.length);
  });
});
