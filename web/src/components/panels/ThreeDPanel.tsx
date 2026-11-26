import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useStudioStore } from '../../store/useStudioStore';
import { validateAndLoadGLB } from '../../services/meshLoader';
import type { ThreeDPrimitiveType } from '../../types/studio';
import ParameterSlider from '../ui/ParameterSlider';

const PRIMITIVES: { id: ThreeDPrimitiveType; label: string }[] = [
  { id: 'torusKnot', label: 'Torus Knot' },
  { id: 'sphere', label: 'Sphere' },
  { id: 'cube', label: 'Cube' },
  { id: 'plane', label: 'Plane' },
];

/**
 * 3D Mesh Ingestion & Camera Controls Panel aligned with the monochrome studio palette.
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
      setUploadError(err?.message || 'Failed to load 3D mesh. Verify the file is a valid GLB or GLTF under 50 MB.');
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="flex flex-col gap-3 px-4 pb-3" aria-label="3D controls panel">
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold text-dim">Primitives</span>
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
                className={`flex h-8 items-center justify-center border px-2 text-control transition-colors ${
                  isSelected
                    ? 'border-highlight bg-active font-semibold text-max'
                    : 'border-hairline bg-raised text-default hover:border-border-strong hover:text-highlight'
                }`}
              >
                {prim.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-hairline pt-2.5">
        <span className="text-[11px] font-semibold text-dim">Custom mesh (GLB / GLTF under 50 MB)</span>
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
            className="h-8 flex-1 border border-hairline bg-raised px-3 text-control text-highlight hover:border-border-strong hover:bg-active transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Loading mesh...' : 'Upload GLB file'}
          </button>
          {threeDState.customMeshName && (
            <button
              type="button"
              onClick={() => onSelectPrimitive('custom')}
              className={`h-8 border px-2.5 text-control transition-colors ${
                threeDState.primitive === 'custom'
                  ? 'border-highlight bg-active font-semibold text-max'
                  : 'border-hairline bg-raised text-dim hover:text-highlight'
              }`}
              title={threeDState.customMeshName}
            >
              Active
            </button>
          )}
        </div>
        {threeDState.customMeshName && (
          <span className="text-[11px] text-dim truncate">
            Loaded: {threeDState.customMeshName}
          </span>
        )}
        {uploadError && (
          <div role="alert" className="border border-highlight bg-active p-2 text-[11px] text-highlight">
            {uploadError}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-hairline pt-2.5">
        <span className="text-[11px] font-semibold text-dim">Camera orbit</span>

        <div className="flex h-7 items-center justify-between">
          <span className="text-control text-default">Auto-rotate</span>
          <button
            type="button"
            role="switch"
            aria-checked={threeDState.autoRotate}
            onClick={() => setThreeDAutoRotate(!threeDState.autoRotate)}
            className={`flex h-5 w-9 items-center border border-hairline px-0.5 transition-colors ${
              threeDState.autoRotate ? 'bg-active' : 'bg-base'
            }`}
          >
            <span
              className={`h-3.5 w-3.5 transition-transform ${
                threeDState.autoRotate ? 'translate-x-4 bg-highlight' : 'translate-x-0 bg-dim'
              }`}
            />
          </button>
        </div>

        {threeDState.autoRotate && (
          <ParameterSlider
            label="rotation speed"
            value={threeDState.autoRotateSpeed}
            defaultValue={1.0}
            min={0.1}
            max={5.0}
            step={0.1}
            format={(v) => `${v.toFixed(1)}x`}
            onChange={setThreeDAutoRotateSpeed}
          />
        )}

        <button
          type="button"
          onClick={resetThreeDCamera}
          className="h-8 border border-hairline bg-raised px-3 text-control text-default hover:border-border-strong hover:text-highlight transition-colors"
        >
          Reset camera view
        </button>
      </div>
    </div>
  );
}
