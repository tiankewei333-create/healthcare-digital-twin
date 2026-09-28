/** Minimal FHIR R4 shapes used by the twin (subset of the spec, not a full client model). */

export interface Coding {
  system: string;
  code: string;
  display?: string;
}

export interface CodeableConcept {
  coding: Coding[];
  text?: string;
}

export interface Reference {
  reference: string;
  display?: string;
}

export interface Quantity {
  value: number;
  unit: string;
  system: "http://unitsofmeasure.org";
  code: string;
}

export interface FhirLocation {
  resourceType: "Location";
  id: string;
  status: "active" | "suspended" | "inactive";
  name: string;
  mode: "instance";
  physicalType: CodeableConcept;
  operationalStatus?: Coding;
  partOf?: Reference;
}

export interface FhirDevice {
  resourceType: "Device";
  id: string;
  status: "active" | "inactive";
  serialNumber: string;
  modelNumber: string;
  deviceName: Array<{ name: string; type: "user-friendly-name" }>;
  type: CodeableConcept;
  location: Reference;
}

export interface FhirObservation {
  resourceType: "Observation";
  id: string;
  status: "final";
  category?: CodeableConcept[];
  code: CodeableConcept;
  device: Reference;
  effectiveDateTime: string;
  valueQuantity: Quantity;
}

export type FhirResource = FhirLocation | FhirDevice | FhirObservation;

export interface FhirBundle {
  resourceType: "Bundle";
  type: "collection";
  timestamp: string;
  entry: Array<{ fullUrl: string; resource: FhirResource }>;
}

export const CODE_SYSTEMS = {
  loinc: "http://loinc.org",
  ucum: "http://unitsofmeasure.org",
  locationPhysicalType: "http://terminology.hl7.org/CodeSystem/location-physical-type",
  bedStatus: "http://terminology.hl7.org/CodeSystem/v2-0116",
  observationCategory: "http://terminology.hl7.org/CodeSystem/observation-category",
  /** Local code systems for concepts without a well-known standard code in this demo. */
  localMetric: "https://ward-twin.example/fhir/CodeSystem/device-metric",
  localDeviceType: "https://ward-twin.example/fhir/CodeSystem/device-type",
} as const;
