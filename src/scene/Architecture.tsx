import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  Color,
  Object3D,
  type InstancedMesh,
} from "three";
import { BEDS, ROOMS, type BedStatus, type ZoneKind } from "../domain/ward";

const ROOM_COLOR: Record<ZoneKind, string> = {
  patient: "#2b4068",
  isolation: "#4a2f55",
  nurse: "#24503f",
  utility: "#323c55",
  corridor: "#1b2436",
};

const BED_COLOR: Record<BedStatus, string> = {
  occupied: "#4dabf7",
  available: "#51cf66",
  cleaning: "#fcc419",
  blocked: "#868e96",
};

const WALL_COLOR = "#8aa0c8";
const SHELL_COLOR = "#6b7fa6";
// Cut-away height so bed and device state stays visible from an oblique camera.
const WALL_HEIGHT = 1.2;
const WALL_THICKNESS = 0.12;

interface BoxInstance {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  color: string;
}

function roomWalls(): BoxInstance[] {
  const walls: BoxInstance[] = [];
  for (const room of ROOMS) {
    if (room.kind === "corridor") continue;
    const { x, z, width, depth } = room;
    const hx = width / 2;
    const hz = depth / 2;
    const open = 1.6;
    // Rooms line both sides of a central corridor; the door faces z = 0.
    const doorZ = z < 0 ? z + hz : z - hz;
    const backZ = z < 0 ? z - hz : z + hz;
    walls.push(
      {
        x: x - (width + open) / 4,
        y: WALL_HEIGHT / 2,
        z: doorZ,
        sx: (width - open) / 2,
        sy: WALL_HEIGHT,
        sz: WALL_THICKNESS,
        color: WALL_COLOR,
      },
      {
        x: x + (width + open) / 4,
        y: WALL_HEIGHT / 2,
        z: doorZ,
        sx: (width - open) / 2,
        sy: WALL_HEIGHT,
        sz: WALL_THICKNESS,
        color: WALL_COLOR,
      },
      {
        x,
        y: WALL_HEIGHT / 2,
        z: backZ,
        sx: width,
        sy: WALL_HEIGHT,
        sz: WALL_THICKNESS,
        color: WALL_COLOR,
      },
      {
        x: x - hx,
        y: WALL_HEIGHT / 2,
        z,
        sx: WALL_THICKNESS,
        sy: WALL_HEIGHT,
        sz: depth,
        color: WALL_COLOR,
      },
      {
        x: x + hx,
        y: WALL_HEIGHT / 2,
        z,
        sx: WALL_THICKNESS,
        sy: WALL_HEIGHT,
        sz: depth,
        color: WALL_COLOR,
      },
    );
  }
  walls.push(
    { x: 0, y: WALL_HEIGHT / 2, z: -9, sx: 28, sy: WALL_HEIGHT, sz: WALL_THICKNESS, color: SHELL_COLOR },
    { x: 0, y: WALL_HEIGHT / 2, z: 9, sx: 28, sy: WALL_HEIGHT, sz: WALL_THICKNESS, color: SHELL_COLOR },
    { x: -14, y: WALL_HEIGHT / 2, z: 0, sx: WALL_THICKNESS, sy: WALL_HEIGHT, sz: 18, color: SHELL_COLOR },
    { x: 14, y: WALL_HEIGHT / 2, z: 0, sx: WALL_THICKNESS, sy: WALL_HEIGHT, sz: 18, color: SHELL_COLOR },
  );
  return walls;
}

function writeInstances(mesh: InstancedMesh | null, items: BoxInstance[], dummy: Object3D) {
  if (!mesh) return;
  items.forEach((item, i) => {
    dummy.position.set(item.x, item.y, item.z);
    dummy.scale.set(item.sx, item.sy, item.sz);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, new Color(item.color));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

export function FloorAndWalls() {
  const wallRef = useRef<InstancedMesh>(null);
  const floorRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const walls = useMemo(() => roomWalls(), []);
  const floors = useMemo(
    () =>
      ROOMS.map((room) => ({
        x: room.x,
        y: 0.02,
        z: room.z,
        sx: room.width - 0.08,
        sy: 0.04,
        sz: room.depth - 0.08,
        color: ROOM_COLOR[room.kind],
      })),
    [],
  );

  useLayoutEffect(() => {
    writeInstances(wallRef.current, walls, dummy);
    writeInstances(floorRef.current, floors, dummy);
  }, [walls, floors, dummy]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[30, 20]} />
        <meshStandardMaterial color="#0d1422" metalness={0.1} roughness={0.95} />
      </mesh>
      <instancedMesh ref={floorRef} args={[undefined, undefined, floors.length]} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={wallRef} args={[undefined, undefined, walls.length]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.7} metalness={0.05} transparent opacity={0.92} />
      </instancedMesh>
    </group>
  );
}

export function Beds({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const meshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    BEDS.forEach((bed, i) => {
      dummy.position.set(bed.x, 0.35, bed.z);
      dummy.rotation.set(0, bed.rotationY, 0);
      dummy.scale.set(0.9, 0.55, 2.0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, new Color(BED_COLOR[bed.status]));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [dummy]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh || selectedId == null) return;
    const idx = BEDS.findIndex((b) => b.id === selectedId);
    if (idx < 0) return;
    const c = new Color(BED_COLOR[BEDS[idx].status]);
    c.offsetHSL(0, 0, 0.12 + Math.sin(clock.elapsedTime * 4) * 0.06);
    mesh.setColorAt(idx, c);
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, BEDS.length]}
      castShadow
      onClick={(e) => {
        e.stopPropagation();
        if (e.instanceId == null) return;
        onSelect(BEDS[e.instanceId].id);
      }}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.55} metalness={0.15} />
    </instancedMesh>
  );
}
