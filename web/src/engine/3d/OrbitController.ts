import * as THREE from 'three/webgpu';

export interface OrbitControllerOptions {
  radius?: number;
  theta?: number;
  phi?: number;
  minRadius?: number;
  maxRadius?: number;
  minPhi?: number;
  maxPhi?: number;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  target?: THREE.Vector3;
}

/**
 * Isolated camera orbit controller for 3D ASCII rendering (D-17).
 * Handles pointer drag orbit, mouse wheel zoom, and smooth auto-rotation.
 * Stops event propagation on captured pointer/wheel events to prevent conflicting
 * with CenterStage's 2D canvas pan/zoom HUD.
 */
export class OrbitController {
  public radius: number;
  public theta: number;
  public phi: number;
  public minRadius: number;
  public maxRadius: number;
  public minPhi: number;
  public maxPhi: number;
  public autoRotate: boolean;
  public autoRotateSpeed: number;
  public target: THREE.Vector3;

  private defaultRadius: number;
  private defaultTheta: number;
  private defaultPhi: number;

  private isDragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  constructor(options: OrbitControllerOptions = {}) {
    this.defaultRadius = options.radius ?? 3.5;
    this.defaultTheta = options.theta ?? 0.0;
    this.defaultPhi = options.phi ?? Math.PI / 2.5;

    this.radius = this.defaultRadius;
    this.theta = this.defaultTheta;
    this.phi = this.defaultPhi;

    this.minRadius = options.minRadius ?? 1.0;
    this.maxRadius = options.maxRadius ?? 10.0;
    this.minPhi = options.minPhi ?? 0.01;
    this.maxPhi = options.maxPhi ?? Math.PI - 0.01;

    this.autoRotate = options.autoRotate ?? true;
    this.autoRotateSpeed = options.autoRotateSpeed ?? 1.0;
    this.target = options.target ? options.target.clone() : new THREE.Vector3(0, 0, 0);
  }

  /**
   * Updates camera position and orientation based on spherical coordinates (radius, theta, phi).
   * Advances auto-rotation if enabled and not currently user-dragging.
   */
  update(deltaSeconds: number, camera?: THREE.Camera): void {
    if (this.autoRotate && !this.isDragging) {
      this.theta += this.autoRotateSpeed * deltaSeconds;
    }

    if (camera) {
      const x = this.radius * Math.sin(this.phi) * Math.sin(this.theta);
      const y = this.radius * Math.cos(this.phi);
      const z = this.radius * Math.sin(this.phi) * Math.cos(this.theta);

      camera.position.set(x + this.target.x, y + this.target.y, z + this.target.z);
      camera.lookAt(this.target);
      camera.updateMatrixWorld();
    }
  }

  onPointerDown(e: { clientX: number; clientY: number; stopPropagation?: () => void; button?: number }): void {
    if (e.button !== undefined && e.button !== 0) return; // Primary button only
    if (e.stopPropagation) {
      e.stopPropagation();
    }
    this.isDragging = true;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
  }

  onPointerMove(e: { clientX: number; clientY: number; stopPropagation?: () => void }): boolean {
    if (!this.isDragging) return false;
    if (e.stopPropagation) {
      e.stopPropagation();
    }
    const deltaX = e.clientX - this.lastPointerX;
    const deltaY = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;

    this.theta -= deltaX * 0.01;
    this.phi -= deltaY * 0.01;
    this.phi = Math.max(this.minPhi, Math.min(this.maxPhi, this.phi));
    return true;
  }

  onPointerUp(e?: { stopPropagation?: () => void }): void {
    if (this.isDragging) {
      this.isDragging = false;
      if (e?.stopPropagation) {
        e.stopPropagation();
      }
    }
  }

  onWheel(e: { deltaY: number; stopPropagation?: () => void; preventDefault?: () => void }): void {
    if (e.stopPropagation) {
      e.stopPropagation();
    }
    if (e.preventDefault) {
      e.preventDefault();
    }
    this.radius += e.deltaY * 0.005;
    this.radius = Math.max(this.minRadius, Math.min(this.maxRadius, this.radius));
  }

  reset(): void {
    this.radius = this.defaultRadius;
    this.theta = this.defaultTheta;
    this.phi = this.defaultPhi;
    this.isDragging = false;
  }

  getIsDragging(): boolean {
    return this.isDragging;
  }
}
