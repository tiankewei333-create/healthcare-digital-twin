import { BEDS, DEVICES, WARD } from "../domain/ward";
import type { AlertRecord } from "../sim/alerts";

export function TopBar({
  activeAlerts,
  criticalCount,
  occupiedBeds,
  deviceOnline,
  elapsedSec,
  onExport,
}: {
  activeAlerts: AlertRecord[];
  criticalCount: number;
  occupiedBeds: number;
  deviceOnline: number;
  elapsedSec: number;
  onExport: () => void;
}) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">HDT</div>
        <div>
          <h1>{WARD.name}</h1>
          <p>
            {WARD.building} · {WARD.floorLabel} · synthetic FHIR twin
          </p>
        </div>
      </div>
      <div className="kpi-row">
        <Kpi label="Beds occupied" value={`${occupiedBeds}/${BEDS.length}`} />
        <Kpi label="Devices live" value={`${deviceOnline}/${DEVICES.length}`} />
        <Kpi
          label="Open alerts"
          value={String(activeAlerts.length)}
          tone={criticalCount > 0 ? "critical" : activeAlerts.length ? "warn" : "ok"}
        />
        <Kpi label="Sim clock" value={`${Math.floor(elapsedSec)}s`} />
      </div>
      <div className="topbar-actions">
        <button type="button" className="btn" onClick={onExport}>
          Export FHIR Bundle
        </button>
      </div>
    </header>
  );
}

function Kpi({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "ok" | "warn" | "critical";
}) {
  return (
    <div className={`kpi kpi-${tone}`}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
    </div>
  );
}
