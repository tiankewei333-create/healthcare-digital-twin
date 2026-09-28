import {
  CODE_SYSTEMS,
  type FhirBundle,
  type FhirDevice,
  type FhirLocation,
  type FhirObservation,
  type FhirResource,
} from "../domain/fhir";
import { METRICS } from "../domain/metrics";
import {
  BEDS,
  DEVICE_TYPE_CODE,
  DEVICES,
  ROOMS,
  WARD,
  type BedStatus,
  type Device,
} from "../domain/ward";
import type { DeviceSample } from "../sim/telemetry";

const FHIR_BASE = "https://example.org/fhir";

const BED_STATUS_CODE: Record<BedStatus, string> = {
  occupied: "O",
  available: "U",
  cleaning: "H",
  blocked: "C",
};

function locationPhysicalType(code: string, display: string) {
  return {
    coding: [
      {
        system: CODE_SYSTEMS.locationPhysicalType,
        code,
        display,
      },
    ],
    text: display,
  };
}

export function buildWardLocation(): FhirLocation {
  return {
    resourceType: "Location",
    id: WARD.id,
    status: "active",
    name: WARD.name,
    mode: "instance",
    physicalType: locationPhysicalType("wa", "Ward"),
  };
}

export function buildRoomLocations(): FhirLocation[] {
  return ROOMS.filter((r) => r.kind !== "corridor").map((room) => ({
    resourceType: "Location" as const,
    id: room.id,
    status: "active" as const,
    name: room.name,
    mode: "instance" as const,
    physicalType: locationPhysicalType("ro", "Room"),
    partOf: { reference: `Location/${WARD.id}`, display: WARD.name },
  }));
}

export function buildBedLocations(): FhirLocation[] {
  return BEDS.map((bed) => ({
    resourceType: "Location" as const,
    id: bed.id,
    status: "active" as const,
    name: bed.label,
    mode: "instance" as const,
    physicalType: locationPhysicalType("bd", "Bed"),
    operationalStatus: {
      system: CODE_SYSTEMS.bedStatus,
      code: BED_STATUS_CODE[bed.status],
      display: bed.status,
    },
    partOf: {
      reference: `Location/${bed.roomId}`,
      display: ROOMS.find((r) => r.id === bed.roomId)?.name,
    },
  }));
}

export function buildDeviceResource(device: Device): FhirDevice {
  const type = DEVICE_TYPE_CODE[device.kind];
  return {
    resourceType: "Device",
    id: device.id,
    status: "active",
    serialNumber: device.serial,
    modelNumber: device.model,
    deviceName: [{ name: device.name, type: "user-friendly-name" }],
    type: {
      coding: [
        {
          system: CODE_SYSTEMS.localDeviceType,
          code: type.code,
          display: type.display,
        },
      ],
      text: type.display,
    },
    location: {
      reference: `Location/${device.bedId ?? device.roomId}`,
      display: device.bedId ?? device.roomId,
    },
  };
}

export function buildObservations(
  device: Device,
  sample: DeviceSample,
): FhirObservation[] {
  const out: FhirObservation[] = [];
  for (const key of device.metrics) {
    const value = sample.metrics[key];
    if (value === undefined) continue;
    const def = METRICS[key];
    out.push({
      resourceType: "Observation",
      id: `obs-${device.id}-${key}-${sample.ts}`,
      status: "final",
      ...(def.category === "vital-signs" && {
        category: [
          {
            coding: [
              {
                system: CODE_SYSTEMS.observationCategory,
                code: "vital-signs",
                display: "Vital Signs",
              },
            ],
          },
        ],
      }),
      code: {
        coding: [def.code],
        text: def.label,
      },
      device: { reference: `Device/${device.id}`, display: device.name },
      effectiveDateTime: new Date(sample.ts).toISOString(),
      valueQuantity: {
        value,
        unit: def.unit,
        system: CODE_SYSTEMS.ucum,
        code: def.ucum,
      },
    });
  }
  return out;
}

export function buildBundle(samples: DeviceSample[]): FhirBundle {
  const resources: FhirResource[] = [
    buildWardLocation(),
    ...buildRoomLocations(),
    ...buildBedLocations(),
    ...DEVICES.map(buildDeviceResource),
  ];
  for (const sample of samples) {
    const device = DEVICES.find((d) => d.id === sample.deviceId);
    if (!device) continue;
    resources.push(...buildObservations(device, sample));
  }
  const timestamp = new Date().toISOString();
  return {
    resourceType: "Bundle",
    type: "collection",
    timestamp,
    entry: resources.map((resource) => ({
      fullUrl: `${FHIR_BASE}/${resource.resourceType}/${resource.id}`,
      resource,
    })),
  };
}

export function downloadBundle(samples: DeviceSample[]) {
  const bundle = buildBundle(samples);
  const blob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: "application/fhir+json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ward-3b-fhir-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
