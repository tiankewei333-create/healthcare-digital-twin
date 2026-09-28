import { useMemo, useState } from "react";
import { BEDS } from "./domain/ward";
import { downloadBundle } from "./fhir/export";
import { useTwin } from "./hooks/useTwin";
import { WardScene, type Selection } from "./scene/WardScene";
import { AlertPanel } from "./ui/AlertPanel";
import { DetailPanel } from "./ui/DetailPanel";
import { TopBar } from "./ui/TopBar";
import "./styles.css";

export function App() {
  const { samples, alerts, activeAlerts, criticalCount, elapsedSec, acknowledge } =
    useTwin();
  const [selection, setSelection] = useState<Selection>(null);

  const alarmedIds = useMemo(() => {
    const set = new Set<string>();
    for (const a of activeAlerts) if (a.conditionActive) set.add(a.deviceId);
    return set;
  }, [activeAlerts]);

  const occupiedBeds = BEDS.filter((b) => b.status === "occupied").length;
  const deviceOnline = Object.values(samples).filter((s) => s.status !== "offline").length;

  return (
    <div className="app">
      <TopBar
        activeAlerts={activeAlerts}
        criticalCount={criticalCount}
        occupiedBeds={occupiedBeds}
        deviceOnline={deviceOnline}
        elapsedSec={elapsedSec}
        onExport={() => downloadBundle(Object.values(samples))}
      />
      <div className="workspace">
        <AlertPanel
          alerts={alerts}
          onFocus={(deviceId) => setSelection({ kind: "device", id: deviceId })}
          onAck={(alertId) => acknowledge(alertId)}
        />
        <div className="scene-shell">
          <div className="banner">Synthetic data only · no PHI · FHIR R4-shaped export</div>
          <WardScene
            samples={samples}
            alarmedIds={alarmedIds}
            selection={selection}
            onSelect={setSelection}
          />
        </div>
        <DetailPanel selection={selection} samples={samples} />
      </div>
    </div>
  );
}
