import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { Mesh, MeshStandardMaterial } from "three";
import { DEVICES, type Device, type DeviceKind } from "../domain/ward";
import type { DeviceSample } from "../sim/telemetry";
import { formatMetric } from "../domain/metrics";

const KIND_COLOR: Record<DeviceKind, string> = {
  ventilator: "#845ef7",
  "infusion-pump": "#22b8cf",
  monitor: "#339af0",
  fridge: "#51cf66",
  "pressure-sensor": "#ff922b",
  "o2-panel": "#ff6b6b",
};

function DeviceMesh({
  device,
  sample,
  selected,
  alarmed,
  onSelect,
}: {
  device: Device;
  sample?: DeviceSample;
  selected: boolean;
  alarmed: boolean;
  onSelect: (id: string) => void;
}) {
  const bodyRef = useRef<Mesh>(null);
  const lampRef = useRef<Mesh>(null);
  const color = KIND_COLOR[device.kind];

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const lamp = lampRef.current;
    if (lamp) {
      const mat = lamp.material as MeshStandardMaterial;
      mat.emissiveIntensity = alarmed
        ? 0.7 + Math.sin(t * 9) * 0.5
        : sample?.status === "online"
          ? 0.55
          : 0.08;
    }
    const body = bodyRef.current;
    if (body && selected) {
      body.position.y = device.position.y + Math.sin(t * 3) * 0.03;
    } else if (body) {
      body.position.y = device.position.y;
    }
  });

  const size = useMemo(() => sizeFor(device.kind), [device.kind]);
  const primary = device.metrics[0];
  const primaryValue =
    primary && sample?.metrics[primary] !== undefined
      ? formatMetric(primary, sample.metrics[primary]!)
      : "—";

  return (
    <group
      position={[device.position.x, 0, device.position.z]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(device.id);
      }}
    >
      <mesh ref={bodyRef} position={[0, device.position.y, 0]} castShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={color}
          roughness={0.45}
          metalness={0.25}
          emissive={alarmed ? "#c92a2a" : color}
          emissiveIntensity={alarmed ? 0.25 : selected ? 0.15 : 0.04}
        />
      </mesh>
      <mesh ref={lampRef} position={[0, device.position.y + size[1] / 2 + 0.18, 0]}>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive={alarmed ? "#fa5252" : color}
          emissiveIntensity={0.6}
        />
      </mesh>
      {(selected || alarmed) && (
        <Html distanceFactor={9} position={[0, device.position.y + size[1] / 2 + 0.55, 0]} center>
          <div className={`device-tag ${alarmed ? "alarm" : ""}`}>
            <strong>{device.name.split("·")[0].trim()}</strong>
            <span>{primaryValue}</span>
          </div>
        </Html>
      )}
    </group>
  );
}

function sizeFor(kind: DeviceKind): [number, number, number] {
  switch (kind) {
    case "ventilator":
      return [0.7, 1.2, 0.55];
    case "infusion-pump":
      return [0.35, 0.9, 0.35];
    case "monitor":
      return [0.55, 0.45, 0.12];
    case "fridge":
      return [1.0, 1.6, 0.7];
    case "pressure-sensor":
      return [0.25, 0.25, 0.15];
    case "o2-panel":
      return [0.5, 0.7, 0.2];
  }
}

export function Devices({
  samples,
  alarmedIds,
  selectedId,
  onSelect,
}: {
  samples: Record<string, DeviceSample>;
  alarmedIds: Set<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <group>
      {DEVICES.map((device) => (
        <DeviceMesh
          key={device.id}
          device={device}
          sample={samples[device.id]}
          selected={selectedId === device.id}
          alarmed={alarmedIds.has(device.id)}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}
