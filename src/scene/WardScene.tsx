import { useEffect, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Grid, OrbitControls } from "@react-three/drei";
import { CanvasTexture, SRGBColorSpace } from "three";
import { BEDS, DEVICES, ROOMS, roomById } from "../domain/ward";
import type { DeviceSample } from "../sim/telemetry";
import { Beds, FloorAndWalls } from "./Architecture";
import { Devices } from "./Devices";

export type Selection =
  | { kind: "device"; id: string }
  | { kind: "bed"; id: string }
  | null;

type ControlsLike = {
  target: {
    set: (x: number, y: number, z: number) => void;
    clone: () => { x: number; y: number; z: number };
  };
  update: () => void;
};

function CameraRig({ selection }: { selection: Selection }) {
  const { camera } = useThree();
  const controls = useThree((s) => s.controls) as ControlsLike | null;

  const target = useMemo(() => {
    if (!selection) return null;
    if (selection.kind === "device") {
      const d = DEVICES.find((x) => x.id === selection.id);
      return d ? { x: d.position.x, y: 1.2, z: d.position.z } : null;
    }
    const b = BEDS.find((x) => x.id === selection.id);
    return b ? { x: b.x, y: 1.0, z: b.z } : null;
  }, [selection]);

  useEffect(() => {
    if (!target || !controls) return;
    const from = camera.position.clone();
    const to = {
      x: target.x + 4.5,
      y: 5.5,
      z: target.z + 5.5,
    };
    const lookFrom = controls.target.clone();
    const lookTo = { x: target.x, y: target.y, z: target.z };
    let raf = 0;
    const start = performance.now();
    const duration = 700;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - t, 3);
      camera.position.set(
        from.x + (to.x - from.x) * e,
        from.y + (to.y - from.y) * e,
        from.z + (to.z - from.z) * e,
      );
      controls.target.set(
        lookFrom.x + (lookTo.x - lookFrom.x) * e,
        lookFrom.y + (lookTo.y - lookFrom.y) * e,
        lookFrom.z + (lookTo.z - lookFrom.z) * e,
      );
      controls.update();
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, camera, controls]);

  return null;
}

// Canvas-texture labels: no font download, so the scene never suspends on the network.
function makeLabelTexture(text: string, color: string): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "600 56px system-ui, -apple-system, 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function Nameplate({ room }: { room: (typeof ROOMS)[number] }) {
  const texture = useMemo(
    () => makeLabelTexture(room.code, room.isolation ? "#f783ac" : "#bac8ff"),
    [room.code, room.isolation],
  );
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh
      position={[
        room.x,
        0.06,
        room.z < 0 ? room.z + room.depth / 2 - 0.5 : room.z - room.depth / 2 + 0.5,
      ]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[1.6, 0.6]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function RoomNameplates() {
  return (
    <group>
      {ROOMS.filter((r) => r.kind !== "corridor").map((room) => (
        <Nameplate key={room.id} room={room} />
      ))}
    </group>
  );
}

export function WardScene({
  samples,
  alarmedIds,
  selection,
  onSelect,
}: {
  samples: Record<string, DeviceSample>;
  alarmedIds: Set<string>;
  selection: Selection;
  onSelect: (next: Selection) => void;
}) {
  const selectedBed = selection?.kind === "bed" ? selection.id : null;
  const selectedDevice = selection?.kind === "device" ? selection.id : null;
  const bedRoomName = useMemo(() => {
    if (selection?.kind !== "bed") return "";
    const bed = BEDS.find((b) => b.id === selection.id);
    return bed ? (roomById(bed.roomId)?.name ?? "") : "";
  }, [selection]);

  return (
    <div className="scene-root">
      <Canvas
        shadows
        camera={{ position: [4, 25, 25], fov: 42, near: 0.1, far: 150 }}
        onPointerMissed={() => onSelect(null)}
        gl={{ antialias: true }}
        style={{ background: "#070b14" }}
      >
        <color attach="background" args={["#070b14"]} />
        <fog attach="fog" args={["#070b14", 34, 70]} />
        <hemisphereLight args={["#cfe0ff", "#1a2233", 0.9]} />
        <ambientLight intensity={0.35} />
        <directionalLight
          castShadow
          intensity={1.6}
          position={[10, 18, 8]}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-16}
          shadow-camera-right={16}
          shadow-camera-top={12}
          shadow-camera-bottom={-12}
        />
        <FloorAndWalls />
        <Beds
          selectedId={selectedBed}
          onSelect={(id) => onSelect({ kind: "bed", id })}
        />
        <Devices
          samples={samples}
          alarmedIds={alarmedIds}
          selectedId={selectedDevice}
          onSelect={(id) => onSelect({ kind: "device", id })}
        />
        <RoomNameplates />
        <Grid
          args={[30, 30]}
          cellSize={1}
          cellThickness={0.5}
          cellColor="#1a2438"
          sectionSize={5}
          sectionThickness={1}
          sectionColor="#2b4c7e"
          fadeDistance={36}
          fadeStrength={1}
          position={[0, 0.001, 0]}
        />
        <ContactShadows
          position={[0, 0.01, 0]}
          opacity={0.35}
          scale={36}
          blur={2.4}
          far={10}
        />
        <OrbitControls
          makeDefault
          target={[0, 0.6, 0]}
          enableDamping
          maxPolarAngle={Math.PI * 0.48}
          minDistance={5}
          maxDistance={48}
        />
        <CameraRig selection={selection} />
      </Canvas>
      <div className="scene-hint">
        Drag to orbit · scroll to zoom · click bed / device to inspect
        {bedRoomName ? ` · ${bedRoomName}` : ""}
      </div>
    </div>
  );
}
