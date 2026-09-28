import { CODE_SYSTEMS, type Coding } from "./fhir";

export type MetricKey =
  | "heartRate"
  | "spo2"
  | "respRate"
  | "fio2"
  | "peep"
  | "tidalVolume"
  | "infusionRate"
  | "volumeRemaining"
  | "fridgeTemp"
  | "roomPressure"
  | "o2Pressure";

export type MetricCategory = "vital-signs" | "therapy" | "environment";

export interface MetricDef {
  label: string;
  unit: string;
  ucum: string;
  digits: number;
  category: MetricCategory;
  code: Coding;
}

const loinc = (code: string, display: string): Coding => ({
  system: CODE_SYSTEMS.loinc,
  code,
  display,
});

const local = (code: string, display: string): Coding => ({
  system: CODE_SYSTEMS.localMetric,
  code,
  display,
});

export const METRICS: Record<MetricKey, MetricDef> = {
  heartRate: { label: "Heart rate", unit: "bpm", ucum: "/min", digits: 0, category: "vital-signs", code: loinc("8867-4", "Heart rate") },
  spo2: { label: "SpO₂", unit: "%", ucum: "%", digits: 0, category: "vital-signs", code: loinc("59408-5", "Oxygen saturation in Arterial blood by Pulse oximetry") },
  respRate: { label: "Resp. rate", unit: "/min", ucum: "/min", digits: 0, category: "vital-signs", code: loinc("9279-1", "Respiratory rate") },
  fio2: { label: "FiO₂", unit: "%", ucum: "%", digits: 0, category: "therapy", code: loinc("3150-0", "Inhaled oxygen concentration") },
  peep: { label: "PEEP", unit: "cmH₂O", ucum: "cm[H2O]", digits: 1, category: "therapy", code: local("peep", "Positive end-expiratory pressure") },
  tidalVolume: { label: "Tidal vol.", unit: "mL", ucum: "mL", digits: 0, category: "therapy", code: local("tidal-volume", "Tidal volume") },
  infusionRate: { label: "Rate", unit: "mL/h", ucum: "mL/h", digits: 1, category: "therapy", code: local("infusion-rate", "Infusion rate") },
  volumeRemaining: { label: "Volume left", unit: "mL", ucum: "mL", digits: 0, category: "therapy", code: local("volume-remaining", "Volume to be infused remaining") },
  fridgeTemp: { label: "Storage temp.", unit: "°C", ucum: "Cel", digits: 1, category: "environment", code: local("storage-temperature", "Cold storage temperature") },
  roomPressure: { label: "Diff. pressure", unit: "Pa", ucum: "Pa", digits: 1, category: "environment", code: local("room-differential-pressure", "Room differential pressure") },
  o2Pressure: { label: "O₂ pipeline", unit: "kPa", ucum: "kPa", digits: 0, category: "environment", code: local("o2-pipeline-pressure", "Medical oxygen pipeline pressure") },
};

export function formatMetric(key: MetricKey, value: number): string {
  const def = METRICS[key];
  return `${value.toFixed(def.digits)} ${def.unit}`;
}
