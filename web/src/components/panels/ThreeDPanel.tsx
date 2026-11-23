import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useStudioStore } from '../../store/useStudioStore';
import { validateAndLoadGLB } from '../../services/meshLoader';
import type { ThreeDPrimitiveType } from '../../types/studio';

const PRIMITIVES: { id: ThreeDPrimitiveType; label: string }[] = [
  { id: 'torusKnot', label: 'Torus Knot' },
  { id: 'sphere', label: 'Sphere' },
  { id: 'cube', label: 'Cube' },
  { id: 'plane', label: 'Plane' },
];

/**
 * 3D Mesh Ingestion & Camera Controls Panel (D-15, D-17, FX-06).
 * Renders primitive selector buttons, client-side GLB file validation & upload,
 * auto-rotation toggle/speed slider, and camera reset button.
 */
export default function ThreeDPanel() {
  const threeDState = useStudioStore((s) => s.threeDState);
  const setThreeDPrimitive = useStudioStore((s) => s.setThreeDPrimitive);
  const setCustomMesh = useStudioStore((s) => s.setCustomMesh);
  const setThreeDAutoRotate = useStudioStore((s) => s.setThreeDAutoRotate);
  const setThreeDAutoRotateSpeed = useStudioStore((s) => s.setThreeDAutoRotateSpeed);
  const resetThreeDCamera = useStudioStore((s) => s.resetThreeDCamera);
  const activeStack = useStudioStore((s) => s.activeStack);
  const addEffect = useStudioStore((s) => s.addEffect);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const hasThreeDPass = activeStack.some((p) => p.effectId === 'threeD');

  const onSelectPrimitive = (prim: ThreeDPrimitiveType) => {
    setThreeDPrimitive(prim);
    if (!hasThreeDPass) {
      addEffect('threeD', { primitive: prim });
    }
  };

  const onFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setUploadError(null);

    try {
      const group = await validateAndLoadGLB(file);
      setCustomMesh(group, file.name);
      if (!hasThreeDPass) {
        addEffect('threeD', { primitive: 'custom' });
      }
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to load 3D mesh.');
    } finally {
      setIsLoading(false);
      // Reset input value so same file can be re-selected if desired
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="flex flex-col gap-3 px-4 pb-3" aria-label="3D controls panel">
      {/* Primitive Geometry Selector */}
      <div className="flex flex-col gap-1.5">
        <span className="text-caption text-dim uppercase tracking-wider">Primitives</span>
        <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Primitive selection">
          {PRIMITIVES.map((prim) => {
            const isSelected = threeDState.primitive === prim.id;
            return (
              <button
                key={prim.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => onSelectPrimitive(prim.id)}
                className={`flex h-8 items-center justify-center rounded border px-2 text-control transition-colors ${
                  isSelected
                    ? 'border-accent bg-accent/15 text-accent font-medium'
                    : 'border-hairline bg-surface/40 text-dim hover:border-hairline-strong hover:text-base'
                }`}
              >
                {prim.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* GLB File Upload */}
      <div className="flex flex-col gap-1.5 border-t border-hairline pt-2">
        <span className="text-caption text-dim uppercase tracking-wider">Custom Mesh (.glb / .gltf)</span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".glb,.gltf"
          className="hidden"
          onChange={onFileUpload}
          aria-label="Upload GLB mesh"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isLoading}
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 h-8 rounded border border-hairline bg-surface/60 px-3 text-control text-base hover:border-hairline-strong transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Validating & Loading...' : 'Upload GLB File (< 50MB)'}
          </button>
          {threeDState.customMeshName && (
            <button
              type="button"
              onClick={() => onSelectPrimitive('custom')}
              className={`h-8 px-2.5 rounded border text-control transition-colors ${
                threeDState.primitive === 'custom'
                  ? 'border-accent bg-accent/15 text-accent font-medium'
                  : 'border-hairline bg-surface/40 text-dim hover:text-base'
              }`}
              title={threeDState.customMeshName}
            >
              Active
            </button>
          )}
        </div>
        {threeDState.customMeshName && (
          <span className="text-caption text-dim truncate">
            Loaded: {threeDState.customMeshName}
          </span>
        )}
        {uploadError && (
          <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-caption text-red-400">
            {uploadError}
          </div>
        )}
      </div>

      {/* Camera Orbit Controls (D-17) */}
      <div className="flex flex-col gap-2 border-t border-hairline pt-2">
        <span className="text-caption text-dim uppercase tracking-wider">Camera Orbit</span>
        
        {/* Auto-Rotate Toggle */}
        <div className="flex items-center justify-between">
          <span className="text-control text-base">Auto-Rotate</span>
          <button
            type="button"
            role="switch"
            aria-checked={threeDState.autoRotate}
            onClick={() => setThreeDAutoRotate(!threeDState.autoRotate)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none ${
              threeDState.autoRotate ? 'bg-accent' : 'bg-surface'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-base shadow-lg ring-0 transition-transform ${
                threeDState.autoRotate ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Auto-Rotate Speed Slider */}
        {threeDState.autoRotate && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-caption text-dim">
              <span>Rotation Speed</span>
              <span>{threeDState.autoRotateSpeed.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="5.0"
              step="0.1"
              value={threeDState.autoRotateSpeed}
              onChange={(e) => setThreeDAutoRotateSpeed(parseFloat(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded bg-surface accent-accent"
              aria-label="Auto-rotate speed"
            />
          </div>
        )}

        {/* Reset Camera Button */}
        <button
          type="button"
          onClick={resetThreeDCamera}
          className="mt-1 h-8 rounded border border-hairline bg-surface/40 px-3 text-control text-dim hover:text-base hover:border-hairline-strong transition-colors"
        >
          Reset Camera View
        </button>
      </div>
    </div>
  );
}
