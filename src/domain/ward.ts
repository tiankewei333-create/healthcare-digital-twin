import type { MetricKey } from "./metrics";

export type DeviceKind =
  | "ventilator"
  | "infusion-pump"
  | "monitor"
  | "fridge"
  | "pressure-sensor"
  | "o2-panel";

export type DeviceStatus = "online" | "offline" | "alarm";
export type BedStatus = "occupied" | "available" | "cleaning" | "blocked";
export type ZoneKind = "patient" | "isolation" | "nurse" | "utility" | "corridor";
export type AlertSeverity = "warning" | "critical";
export type AlertState = "active" | "acked" | "cleared";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Room {
  id: string;
  code: string;
  name: string;
  kind: ZoneKind;
  /** Floor footprint rectangle (metres), origin at world centre. */
  x: number;
  z: number;
  width: number;
  depth: number;
  isolation?: boolean;
}

export interface Bed {
  id: string;
  roomId: string;
  label: string;
  x: number;
  z: number;
  rotationY: number;
  status: BedStatus;
}

export interface Device {
  id: string;
  kind: DeviceKind;
  name: string;
  model: string;
  serial: string;
  roomId: string;
  bedId?: string;
  position: Vec3;
  metrics: MetricKey[];
}

export interface AlertRule {
  id: string;
  metric: MetricKey;
  /** True → fire when value > threshold; false → when value < threshold. */
  high: boolean;
  threshold: number;
  severity: AlertSeverity;
  title: string;
}

export const ALERT_RULES: AlertRule[] = [
  { id: "spo2-low", metric: "spo2", high: false, threshold: 90, severity: "critical", title: "SpO₂ critically low" },
  { id: "hr-high", metric: "heartRate", high: true, threshold: 130, severity: "warning", title: "Tachycardia" },
  { id: "hr-low", metric: "heartRate", high: false, threshold: 45, severity: "critical", title: "Bradycardia" },
  { id: "fridge-high", metric: "fridgeTemp", high: true, threshold: 8, severity: "critical", title: "Cold-chain excursion" },
  { id: "pressure-loss", metric: "roomPressure", high: true, threshold: -2.5, severity: "critical", title: "Isolation negative pressure lost" },
  { id: "o2-low", metric: "o2Pressure", high: false, threshold: 350, severity: "critical", title: "O₂ pipeline pressure low" },
  { id: "infusion-empty", metric: "volumeRemaining", high: false, threshold: 20, severity: "warning", title: "Infusion nearly empty" },
];

export const WARD = {
  id: "ward-3b",
  name: "Ward 3B · Med-Surg",
  floorLabel: "Floor 3",
  building: "East Tower",
  width: 28,
  depth: 18,
} as const;

/**
 * Floor plan (top-down, +Z toward windows).
 * Units are metres. Corridor runs east–west through the middle.
 */
export const ROOMS: Room[] = [
  { id: "rm-301", code: "301", name: "Room 301", kind: "patient", x: -10, z: -5.5, width: 6, depth: 5 },
  { id: "rm-302", code: "302", name: "Room 302", kind: "patient", x: -3.5, z: -5.5, width: 6, depth: 5 },
  { id: "rm-303", code: "303", name: "Room 303 · Isolation", kind: "isolation", x: 3.5, z: -5.5, width: 6, depth: 5, isolation: true },
  { id: "rm-304", code: "304", name: "Room 304", kind: "patient", x: 10, z: -5.5, width: 6, depth: 5 },
  { id: "rm-nurses", code: "NS", name: "Nurses station", kind: "nurse", x: -3.5, z: 5, width: 7, depth: 5 },
  { id: "rm-meds", code: "MED", name: "Medication room", kind: "utility", x: 4.5, z: 5, width: 5, depth: 5 },
  { id: "rm-clean", code: "CLN", name: "Clean utility", kind: "utility", x: 10, z: 5, width: 5, depth: 5 },
  { id: "rm-corridor", code: "COR", name: "Main corridor", kind: "corridor", x: 0, z: 0, width: 26, depth: 4 },
];

export const BEDS: Bed[] = [
  { id: "bed-301a", roomId: "rm-301", label: "301-A", x: -11.5, z: -6.2, rotationY: 0, status: "occupied" },
  { id: "bed-301b", roomId: "rm-301", label: "301-B", x: -8.5, z: -6.2, rotationY: 0, status: "occupied" },
  { id: "bed-302a", roomId: "rm-302", label: "302-A", x: -5, z: -6.2, rotationY: 0, status: "occupied" },
  { id: "bed-302b", roomId: "rm-302", label: "302-B", x: -2, z: -6.2, rotationY: 0, status: "available" },
  { id: "bed-303a", roomId: "rm-303", label: "303-A", x: 2, z: -6.2, rotationY: 0, status: "occupied" },
  { id: "bed-303b", roomId: "rm-303", label: "303-B", x: 5, z: -6.2, rotationY: 0, status: "cleaning" },
  { id: "bed-304a", roomId: "rm-304", label: "304-A", x: 8.5, z: -6.2, rotationY: 0, status: "occupied" },
  { id: "bed-304b", roomId: "rm-304", label: "304-B", x: 11.5, z: -6.2, rotationY: 0, status: "occupied" },
];

export const DEVICES: Device[] = [
  {
    id: "dev-vent-303",
    kind: "ventilator",
    name: "Ventilator · 303-A",
    model: "VX-900 Ventilator",
    serial: "VNT-303A-01",
    roomId: "rm-303",
    bedId: "bed-303a",
    position: { x: 1.2, y: 0.9, z: -5.5 },
    metrics: ["fio2", "peep", "tidalVolume", "respRate"],
  },
  {
    id: "dev-mon-301a",
    kind: "monitor",
    name: "Bedside monitor · 301-A",
    model: "PM-7 Patient Monitor",
    serial: "MON-301A-01",
    roomId: "rm-301",
    bedId: "bed-301a",
    position: { x: -11.5, y: 1.4, z: -4.4 },
    metrics: ["heartRate", "spo2", "respRate"],
  },
  {
    id: "dev-mon-301b",
    kind: "monitor",
    name: "Bedside monitor · 301-B",
    model: "PM-7 Patient Monitor",
    serial: "MON-301B-01",
    roomId: "rm-301",
    bedId: "bed-301b",
    position: { x: -8.5, y: 1.4, z: -4.4 },
    metrics: ["heartRate", "spo2", "respRate"],
  },
  {
    id: "dev-mon-302a",
    kind: "monitor",
    name: "Bedside monitor · 302-A",
    model: "PM-7 Patient Monitor",
    serial: "MON-302A-01",
    roomId: "rm-302",
    bedId: "bed-302a",
    position: { x: -5, y: 1.4, z: -4.4 },
    metrics: ["heartRate", "spo2", "respRate"],
  },
  {
    id: "dev-mon-303a",
    kind: "monitor",
    name: "Bedside monitor · 303-A",
    model: "PM-7 Patient Monitor",
    serial: "MON-303A-01",
    roomId: "rm-303",
    bedId: "bed-303a",
    position: { x: 2, y: 1.4, z: -4.4 },
    metrics: ["heartRate", "spo2", "respRate"],
  },
  {
    id: "dev-mon-304a",
    kind: "monitor",
    name: "Bedside monitor · 304-A",
    model: "PM-7 Patient Monitor",
    serial: "MON-304A-01",
    roomId: "rm-304",
    bedId: "bed-304a",
    position: { x: 8.5, y: 1.4, z: -4.4 },
    metrics: ["heartRate", "spo2", "respRate"],
  },
  {
    id: "dev-pump-302a",
    kind: "infusion-pump",
    name: "Infusion pump · 302-A",
    model: "IP-3 Syringe Pump",
    serial: "PUMP-302A-01",
    roomId: "rm-302",
    bedId: "bed-302a",
    position: { x: -4.2, y: 1.1, z: -5.5 },
    metrics: ["infusionRate", "volumeRemaining"],
  },
  {
    id: "dev-pump-304a",
    kind: "infusion-pump",
    name: "Infusion pump · 304-A",
    model: "IP-3 Syringe Pump",
    serial: "PUMP-304A-01",
    roomId: "rm-304",
    bedId: "bed-304a",
    position: { x: 9.3, y: 1.1, z: -5.5 },
    metrics: ["infusionRate", "volumeRemaining"],
  },
  {
    id: "dev-fridge-meds",
    kind: "fridge",
    name: "Medication fridge",
    model: "MR-105 Med Fridge",
    serial: "FRG-MED-01",
    roomId: "rm-meds",
    position: { x: 4.5, y: 0.9, z: 5.8 },
    metrics: ["fridgeTemp"],
  },
  {
    id: "dev-press-303",
    kind: "pressure-sensor",
    name: "Diff. pressure · 303",
    model: "DP-2 Pressure Sensor",
    serial: "PRS-303-01",
    roomId: "rm-303",
    position: { x: 0.6, y: 2.4, z: -3.2 },
    metrics: ["roomPressure"],
  },
  {
    id: "dev-o2-corridor",
    kind: "o2-panel",
    name: "O₂ zone valve",
    model: "ZV-4 Zone Valve",
    serial: "O2-3B-01",
    roomId: "rm-corridor",
    position: { x: -12.2, y: 1.6, z: 0 },
    metrics: ["o2Pressure"],
  },
];

export const DEVICE_TYPE_CODE: Record<DeviceKind, { code: string; display: string }> = {
  ventilator: { code: "ventilator", display: "Mechanical ventilator" },
  "infusion-pump": { code: "infusion-pump", display: "Infusion pump" },
  monitor: { code: "patient-monitor", display: "Physiological monitor" },
  fridge: { code: "medication-fridge", display: "Medication refrigerator" },
  "pressure-sensor": { code: "differential-pressure-sensor", display: "Differential pressure sensor" },
  "o2-panel": { code: "medical-gas-panel", display: "Medical gas zone valve" },
};

export function roomById(id: string): Room | undefined {
  return ROOMS.find((r) => r.id === id);
}

export function deviceById(id: string): Device | undefined {
  return DEVICES.find((d) => d.id === id);
}

export function bedById(id: string): Bed | undefined {
  return BEDS.find((b) => b.id === id);
}
