import { Suspense, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { RotateCcw, Eye, EyeOff, Layers, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReferenceGLBMapper } from './ReferenceGLBMapper';
import { Reference3DLibrary } from './Reference3DLibrary';
import { useApp } from '@/contexts/AppContext';

type GroupId = 'housing' | 'shaft' | 'bearings' | 'fasteners';
type Part = { id: GroupId; name: string; color: string; description: string; typeHint: string };
const PARTS: Part[] = [
  {
    id: 'housing',
    name: 'Carcaça / suporte',
    color: '#3d91ea',
    description: 'Estrutura externa do conjunto demonstrativo.',
    typeHint: 'suporte',
  },
  {
    id: 'shaft',
    name: 'Eixo principal',
    color: '#ed8c3d',
    description: 'Eixo de transmissão de movimento (exemplo).',
    typeHint: 'eixo',
  },
  {
    id: 'bearings',
    name: 'Rolamentos',
    color: '#39bf8c',
    description: 'Elementos de apoio e rotação (exemplo).',
    typeHint: 'rolamento',
  },
  {
    id: 'fasteners',
    name: 'Fixadores',
    color: '#be74e8',
    description: 'Parafusos e outros elementos de fixação (exemplo).',
    typeHint: 'parafuso',
  },
];

function PartMesh({
  part,
  selected,
  isolated,
  onPick,
}: {
  part: Part;
  selected: boolean;
  isolated: boolean;
  onPick: (id: GroupId) => void;
}) {
  if (isolated && !selected) return null;
  const props = {
    onClick: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      onPick(part.id);
    },
    onPointerOver: () => {
      document.body.style.cursor = 'pointer';
    },
    onPointerOut: () => {
      document.body.style.cursor = '';
    },
  };
  const material = (
    <meshStandardMaterial
      color={part.color}
      roughness={0.42}
      metalness={0.35}
      emissive={selected ? part.color : '#000000'}
      emissiveIntensity={selected ? 0.18 : 0}
    />
  );
  if (part.id === 'housing')
    return (
      <group>
        <mesh position={[0, -0.38, 0]} {...props}>
          <boxGeometry args={[2.5, 0.42, 1.55]} />
          {material}
        </mesh>
        <mesh position={[-0.98, 0.18, 0]} {...props}>
          <boxGeometry args={[0.42, 0.8, 1.55]} />
          {material}
        </mesh>
        <mesh position={[0.98, 0.18, 0]} {...props}>
          <boxGeometry args={[0.42, 0.8, 1.55]} />
          {material}
        </mesh>
      </group>
    );
  if (part.id === 'shaft')
    return (
      <mesh position={[0, 0.42, 0]} rotation={[0, 0, Math.PI / 2]} {...props}>
        <cylinderGeometry args={[0.25, 0.25, 2.65, 32]} />
        {material}
      </mesh>
    );
  if (part.id === 'bearings')
    return (
      <group>
        {[-0.72, 0.72].map((x) => (
          <mesh key={x} position={[x, 0.42, 0]} rotation={[0, 0, Math.PI / 2]} {...props}>
            <torusGeometry args={[0.34, 0.13, 12, 36]} />
            {material}
          </mesh>
        ))}
      </group>
    );
  return (
    <group>
      {[-1.06, 1.06].flatMap((x) =>
        [-0.46, 0.46].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, -0.03, z]} {...props}>
            <cylinderGeometry args={[0.12, 0.12, 0.46, 16]} />
            {material}
          </mesh>
        ))
      )}
    </group>
  );
}

export type Reference3DPart = { id: string; name: string; partType: string; description: string };
export function Reference3DExplorer({
  brand,
  references,
  onChooseReference,
}: {
  brand: string;
  references: Reference3DPart[];
  onChooseReference: (id: string) => void;
}) {
  const { currentUser } = useApp();
  const [sharedModel, setSharedModel] = useState<{
    url: string;
    name: string;
    map: Record<string, { group: string; color: string; referenceIds: string[] }>;
    id: string;
  } | null>(null);
  const [selected, setSelected] = useState<GroupId | null>(null);
  const [isolated, setIsolated] = useState(false);
  const [show3D, setShow3D] = useState(true);
  const group = PARTS.find((p) => p.id === selected);
  const related = useMemo(
    () =>
      group
        ? references.filter((p) =>
            `${p.name} ${p.partType} ${p.description}`
              .toLocaleLowerCase('pt-BR')
              .includes(group.typeHint)
          )
        : [],
    [references, group]
  );
  const reset = () => {
    setSelected(null);
    setIsolated(false);
  };
  return (
    <div className="space-y-4">
      {currentUser?.id && (
        <Reference3DLibrary brand={brand} userId={currentUser.id} onOpen={setSharedModel} />
      )}
      <ReferenceGLBMapper references={references} sharedModel={sharedModel} />
      <section
        className="overflow-hidden rounded-2xl border bg-card shadow-sm"
        aria-label="Explorador tridimensional de referências"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
          <div>
            <h3 className="flex items-center gap-2 font-semibold">
              <Box className="h-4 w-4" /> Explorador técnico 3D — {brand}
            </h3>
            <p className="text-xs text-muted-foreground">
              R3D.1 · Protótipo geométrico demonstrativo — não representa peça OEM.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setShow3D((v) => !v)}>
              {show3D ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
              {show3D ? 'Ocultar 3D' : 'Mostrar 3D'}
            </Button>
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Limpar seleção
            </Button>
          </div>
        </div>
        {show3D && (
          <div className="flex min-w-0 flex-col">
            <div
              className="relative h-[min(78vh,820px)] min-h-[420px] w-full bg-slate-100 dark:bg-slate-950"
              role="img"
              aria-label="Modelo demonstrativo 3D girável; clique nos componentes coloridos para selecionar"
            >
              <Canvas
                dpr={[1, 1.75]}
                gl={{ powerPreference: 'high-performance' }}
                camera={{ position: [4.2, 3.6, 5.2], fov: 42 }}
                frameloop="always"
                onPointerMissed={() => setSelected(null)}
              >
                <color attach="background" args={['#e9eef5']} />
                <ambientLight intensity={1.2} />
                <directionalLight position={[4, 7, 5]} intensity={2.1} />
                <Suspense fallback={null}>
                  <group rotation={[0, -0.25, 0]}>
                    {PARTS.map((p) => (
                      <PartMesh
                        key={p.id}
                        part={p}
                        selected={selected === p.id}
                        isolated={isolated}
                        onPick={setSelected}
                      />
                    ))}
                  </group>
                </Suspense>
                <OrbitControls makeDefault enablePan enableZoom minDistance={3} maxDistance={14} />
              </Canvas>
              <span className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-background/90 px-2 py-1 text-xs text-muted-foreground">
                Arraste para girar · Role para zoom · Clique na cor
              </span>
            </div>
            <aside
              className="grid gap-4 border-t p-4 lg:grid-cols-[260px_minmax(0,1fr)]"
              aria-label="Grupos 3D e referências vinculadas"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Grupos identificados</h4>
                <Layers className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="grid grid-cols-2 gap-2 lg:col-start-1">
                {PARTS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={selected === p.id}
                    onClick={() => setSelected(p.id)}
                    className={`flex min-h-12 items-center gap-2 rounded-lg border px-2 py-2 text-left text-xs transition hover:border-primary ${selected === p.id ? 'border-primary bg-primary/10' : ''}`}
                  >
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-full"
                      style={{ backgroundColor: p.color }}
                    />
                    {p.name}
                  </button>
                ))}
              </div>
              {group ? (
                <div className="space-y-3 border-t pt-3 lg:col-start-2 lg:row-start-1 lg:row-span-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                  <div>
                    <h4 className="font-semibold">{group.name}</h4>
                    <p className="mt-1 text-xs text-muted-foreground">{group.description}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => setIsolated((v) => !v)}
                  >
                    {isolated ? 'Mostrar conjunto' : 'Isolar grupo'}
                  </Button>
                  <h5 className="text-xs font-semibold">
                    Referências relacionadas ({related.length})
                  </h5>
                  {related.length ? (
                    <div className="max-h-64 space-y-2 overflow-auto">
                      {related.map((r) => (
                        <button
                          className="w-full rounded-lg border p-2 text-left text-xs hover:border-primary"
                          key={r.id}
                          onClick={() => onChooseReference(r.id)}
                        >
                          <strong>{r.name}</strong>
                          <span className="mt-1 block text-muted-foreground">{r.partType}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Nenhuma referência corresponde automaticamente a este grupo. A associação por
                      ID permanente será implementada no R3D.2.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Selecione uma cor no modelo ou na lista acima para identificar o grupo.
                </p>
              )}
            </aside>
          </div>
        )}
      </section>
    </div>
  );
}
