import { formatMetric } from "../domain/metrics";
import { deviceById, roomById } from "../domain/ward";
import type { AlertRecord } from "../sim/alerts";

export function AlertPanel({
  alerts,
  onFocus,
  onAck,
}: {
  alerts: AlertRecord[];
  onFocus: (deviceId: string) => void;
  onAck: (alertId: string) => void;
}) {
  const open = alerts.filter((a) => a.state !== "cleared");
  const history = alerts.filter((a) => a.state === "cleared").slice(0, 6);

  return (
    <aside className="panel alerts-panel">
      <div className="panel-head">
        <h2>Clinical alerts</h2>
        <span className="badge">{open.length} open</span>
      </div>
      <ul className="alert-list">
        {open.length === 0 && (
          <li className="empty">No active alerts — scripted incidents cycle every ~2 min.</li>
        )}
        {open.map((a) => (
          <li key={a.alertId} className={`alert-card sev-${a.severity} state-${a.state}`}>
            <div className="alert-top">
              <strong>{a.title}</strong>
              <span className={`sev sev-${a.severity}`}>{a.severity}</span>
            </div>
            <div className="alert-meta">
              {deviceById(a.deviceId)?.name ?? a.deviceId}
              {" · peak "}
              {formatMetric(a.metric, a.peak)}
              {" / thr "}
              {formatMetric(a.metric, a.threshold)}
            </div>
            {a.state === "active" && !a.conditionActive && (
              <div className="alert-recovered">
                Now {formatMetric(a.metric, a.value)} · recovered, awaiting ack
              </div>
            )}
            <div className="alert-actions">
              <button type="button" className="btn ghost" onClick={() => onFocus(a.deviceId)}>
                Fly to
              </button>
              {a.state === "active" && (
                <button type="button" className="btn danger" onClick={() => onAck(a.alertId)}>
                  Acknowledge
                </button>
              )}
              {a.state === "acked" && (
                <span className="acked-by">Acked by {a.ackedBy}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
      {history.length > 0 && (
        <>
          <div className="panel-subhead">Recently cleared</div>
          <ul className="alert-list compact">
            {history.map((a) => (
              <li key={a.alertId} className="alert-card cleared">
                <strong>{a.title}</strong>
                <span>
                  {deviceById(a.deviceId)?.name} · {a.ackedBy ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="panel-footnote">
        Rooms: {roomById("rm-303")?.name} is negative-pressure isolation. Alerts are
        evaluated client-side each second.
      </p>
    </aside>
  );
}
