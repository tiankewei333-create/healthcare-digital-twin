import { METRICS, formatMetric } from "../domain/metrics";
import {
  BEDS,
  DEVICES,
  bedById,
  deviceById,
  roomById,
  type Bed,
  type Device,
} from "../domain/ward";
import type { DeviceSample } from "../sim/telemetry";
import type { Selection } from "../scene/WardScene";

export function DetailPanel({
  selection,
  samples,
}: {
  selection: Selection;
  samples: Record<string, DeviceSample>;
}) {
  if (!selection) {
    return (
      <aside className="panel detail-panel">
        <div className="panel-head">
          <h2>Inspector</h2>
        </div>
        <p className="empty">
          Select a bed or device in the twin. Isolation room 303 runs a ventilator and
          differential-pressure sensor; medication fridge and O₂ zone valve feed facility
          alerts.
        </p>
        <Legend />
      </aside>
    );
  }

  if (selection.kind === "bed") {
    const bed = bedById(selection.id);
    if (!bed) return null;
    return <BedDetail bed={bed} samples={samples} />;
  }

  const device = deviceById(selection.id);
  if (!device) return null;
  return <DeviceDetail device={device} sample={samples[device.id]} />;
}

function BedDetail({ bed, samples }: { bed: Bed; samples: Record<string, DeviceSample> }) {
  const room = roomById(bed.roomId);
  const linked = DEVICES.filter((d) => d.bedId === bed.id);
  return (
    <aside className="panel detail-panel">
      <div className="panel-head">
        <h2>{bed.label}</h2>
        <span className={`bed-status ${bed.status}`}>{bed.status}</span>
      </div>
      <dl className="meta-grid">
        <div>
          <dt>Room</dt>
          <dd>{room?.name ?? bed.roomId}</dd>
        </div>
        <div>
          <dt>FHIR Location</dt>
          <dd>
            <code>Location/{bed.id}</code>
          </dd>
        </div>
      </dl>
      <div className="panel-subhead">Linked devices</div>
      {linked.length === 0 ? (
        <p className="empty">No devices assigned to this bed.</p>
      ) : (
        <ul className="device-mini-list">
          {linked.map((d) => {
            const s = samples[d.id];
            const key = d.metrics[0];
            return (
              <li key={d.id}>
                <strong>{d.name}</strong>
                <span>
                  {key && s?.metrics[key] !== undefined
                    ? formatMetric(key, s.metrics[key]!)
                    : "—"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

function DeviceDetail({
  device,
  sample,
}: {
  device: Device;
  sample?: DeviceSample;
}) {
  const room = roomById(device.roomId);
  const bed = device.bedId ? bedById(device.bedId) : undefined;
  return (
    <aside className="panel detail-panel">
      <div className="panel-head">
        <h2>{device.name}</h2>
        <span className={`dev-status ${sample?.status ?? "offline"}`}>
          {sample?.status ?? "offline"}
        </span>
      </div>
      <dl className="meta-grid">
        <div>
          <dt>Model</dt>
          <dd>{device.model}</dd>
        </div>
        <div>
          <dt>Serial</dt>
          <dd>{device.serial}</dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>
            {room?.name}
            {bed ? ` · ${bed.label}` : ""}
          </dd>
        </div>
        <div>
          <dt>FHIR Device</dt>
          <dd>
            <code>Device/{device.id}</code>
          </dd>
        </div>
      </dl>
      <div className="panel-subhead">Live metrics</div>
      <ul className="metric-list">
        {device.metrics.map((key) => {
          const def = METRICS[key];
          const value = sample?.metrics[key];
          return (
            <li key={key}>
              <span>{def.label}</span>
              <strong>{value === undefined ? "—" : formatMetric(key, value)}</strong>
            </li>
          );
        })}
      </ul>
      <p className="panel-footnote">
        Observations export as FHIR R4 <code>Observation</code> resources with LOINC
        codes where available.
      </p>
    </aside>
  );
}

function Legend() {
  return (
    <div className="legend">
      <div className="panel-subhead">Bed status</div>
      <ul>
        <li>
          <i className="swatch occupied" /> Occupied
        </li>
        <li>
          <i className="swatch available" /> Available
        </li>
        <li>
          <i className="swatch cleaning" /> Cleaning
        </li>
        <li>
          <i className="swatch blocked" /> Blocked
        </li>
      </ul>
      <div className="panel-subhead">Devices · {DEVICES.length}</div>
      <p className="empty subtle">
        Monitors, ventilator, infusion pumps, meds fridge, isolation pressure, O₂ zone
        valve — {BEDS.filter((b) => b.status === "occupied").length} beds occupied.
      </p>
    </div>
  );
}
