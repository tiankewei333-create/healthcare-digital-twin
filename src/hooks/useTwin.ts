import { useEffect, useState } from "react";
import { twinEngine } from "../sim/engine";
import type { AlertRecord } from "../sim/alerts";
import type { DeviceSample } from "../sim/telemetry";

export function useTwin() {
  const [samples, setSamples] = useState<Record<string, DeviceSample>>({});
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    return twinEngine.subscribe((event) => {
      if (event.type === "tick") {
        setSamples((prev) => {
          const next = { ...prev };
          for (const s of event.samples) next[s.deviceId] = s;
          return next;
        });
        setElapsedSec(event.elapsedSec);
        setTick((t) => t + 1);
      } else if (event.type === "alerts") {
        setAlerts(event.alerts);
      }
    });
  }, []);

  const activeAlerts = alerts.filter((a) => a.state === "active" || a.state === "acked");
  const criticalCount = activeAlerts.filter((a) => a.severity === "critical").length;

  function acknowledge(alertId: string) {
    return twinEngine.acknowledge(alertId);
  }

  return {
    samples,
    alerts,
    activeAlerts,
    criticalCount,
    elapsedSec,
    tick,
    acknowledge,
  };
}
