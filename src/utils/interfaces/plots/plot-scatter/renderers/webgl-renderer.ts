'use client';

import {
  WebGLRenderer,
  Scene,
  OrthographicCamera,
  BufferGeometry,
  Float32BufferAttribute,
  Points,
  ShaderMaterial,
  Color,
  Raycaster,
  Vector2,
} from 'three';
import { LogProps, LogFieldsResponseProps } from '@/types/interfaces/logs';
import { getValue } from '../../data';
import { ScatterRenderer, ScatterPlotOptions, ScaleContext, ColorContext } from '../types';
import { getConfig } from '../config';

// Custom vertex shader for variable point sizes
const vertexShader = `
  attribute float size;
  attribute vec3 color;
  attribute float alpha;
  varying vec3 vColor;
  varying float vAlpha;
  
  void main() {
    vColor = color;
    vAlpha = alpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// Custom fragment shader for smooth circular points
const fragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;
  
  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;
    
    // Smooth edge
    float smoothAlpha = 1.0 - smoothstep(0.35, 0.5, dist);
    gl_FragColor = vec4(vColor, vAlpha * smoothAlpha);
  }
`;

/**
 * WebGL-based scatter plot renderer using Three.js.
 * Handles large datasets (2K - 1M+ points) with GPU acceleration.
 */
export class WebGLScatterRenderer implements ScatterRenderer {
  private renderer: WebGLRenderer;
  private scene: Scene;
  private camera: OrthographicCamera;
  private points: Points | null = null;
  private raycaster: Raycaster;
  private mouse: Vector2;

  public canvas: HTMLCanvasElement;
  private data: LogProps[] = [];
  private options: ScatterPlotOptions | null = null;
  private scaleContext: ScaleContext | null = null;
  private colorContext: ColorContext | null = null;
  private visible: boolean = true;
  private width: number;
  private height: number;

  constructor(container: HTMLElement, dimensions: { width: number; height: number }) {
    this.width = dimensions.width;
    this.height = dimensions.height;

    // Create canvas element
    // Append after SVG so it's on top for pointer events
    // Use z-index to layer correctly: canvas between background and axes
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'webgl-scatter';
    this.canvas.style.cssText =
      'position:absolute;top:0;left:0;pointer-events:all;cursor:crosshair;z-index:5;';
    container.appendChild(this.canvas);

    // Initialize WebGL renderer
    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'default',
    });
    this.renderer.setSize(dimensions.width, dimensions.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);

    // Create scene
    this.scene = new Scene();

    // Create orthographic camera for 2D rendering
    this.camera = new OrthographicCamera(0, dimensions.width, 0, dimensions.height, 0.1, 10);
    this.camera.position.z = 1;

    // Initialize raycaster for hit detection
    this.raycaster = new Raycaster();
    this.raycaster.params.Points!.threshold = 8;
    this.mouse = new Vector2();
  }

  render(
    data: LogProps[],
    options: ScatterPlotOptions,
    scaleContext: ScaleContext,
    colorContext: ColorContext,
    highlightIndex: number = -1
  ): void {
    this.data = data;
    this.options = options;
    this.scaleContext = scaleContext;
    this.colorContext = colorContext;

    // Dispose old points
    this.disposePoints();

    // Set up scissor test to clip to plot area (respect margins)
    const { margins, dimensions } = options;
    const pixelRatio = this.renderer.getPixelRatio();
    const plotWidth = dimensions.width - margins.left - margins.right;
    const plotHeight = dimensions.height - margins.top - margins.bottom;

    // WebGL scissor uses bottom-left origin, values in CSS pixels
    // Three.js handles the pixel ratio conversion internally
    const scissorX = Math.round(margins.left);
    const scissorY = Math.round(margins.bottom);
    const scissorWidth = Math.round(plotWidth);
    const scissorHeight = Math.round(plotHeight);

    this.renderer.setScissor(scissorX, scissorY, scissorWidth, scissorHeight);
    this.renderer.setScissorTest(true);

    // CSS clip-path to limit pointer events to plot area only
    // polygon(top-left, top-right, bottom-right, bottom-left)
    const clipLeft = margins.left;
    const clipTop = margins.top;
    const clipRight = dimensions.width - margins.right;
    const clipBottom = dimensions.height - margins.bottom;
    this.canvas.style.clipPath = `polygon(${clipLeft}px ${clipTop}px, ${clipRight}px ${clipTop}px, ${clipRight}px ${clipBottom}px, ${clipLeft}px ${clipBottom}px)`;

    // Ensure canvas CSS size matches dimensions (clip-path is relative to CSS size)
    this.canvas.style.width = `${dimensions.width}px`;
    this.canvas.style.height = `${dimensions.height}px`;

    if (data.length === 0) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    const { fields, xAxisProperty, yAxisProperty, xTable, yTable, groupBy } = options;
    const { x, y, reverseX, reverseY } = scaleContext;
    const { primary, colorScale } = colorContext;
    const config = getConfig();

    const count = data.length;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const alphas = new Float32Array(count);

    // Determine if we need dimming
    const highlightedDatum = highlightIndex >= 0 ? data[highlightIndex] : null;
    const highlightedGroup =
      highlightedDatum && groupBy
        ? JSON.stringify(getValue(fields, groupBy, highlightedDatum, xTable))
        : null;

    for (let i = 0; i < count; i++) {
      const d = data[i];
      const xVal = getValue(fields, xAxisProperty, d, xTable) as number;
      const yVal = getValue(fields, yAxisProperty, d, yTable) as number;

      // Position in screen coordinates
      positions[i * 3] = x(reverseX ? Math.abs(xVal) : xVal);
      positions[i * 3 + 1] = y(reverseY ? Math.abs(yVal) : yVal);
      positions[i * 3 + 2] = 0;

      // Color
      const colorHex = groupBy
        ? colorScale(JSON.stringify(getValue(fields, groupBy, d, xTable)))
        : primary;
      const color = new Color(colorHex);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      // Size and alpha
      if (i === highlightIndex) {
        sizes[i] = config.webglHighlightSize;
        alphas[i] = 1.0;
      } else if (highlightedDatum) {
        sizes[i] = config.webglPointSize;
        if (groupBy && highlightedGroup) {
          const thisGroup = JSON.stringify(getValue(fields, groupBy, d, xTable));
          alphas[i] = thisGroup === highlightedGroup ? config.sameGroupOpacity : config.dimOpacity;
        } else {
          alphas[i] = config.dimOpacity;
        }
      } else {
        sizes[i] = config.webglPointSize;
        alphas[i] = 1.0;
      }
    }

    // Create geometry
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    geometry.setAttribute('size', new Float32BufferAttribute(sizes, 1));
    geometry.setAttribute('alpha', new Float32BufferAttribute(alphas, 1));

    // Create material with custom shaders
    const material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthTest: false,
    });

    // Create points and add to scene
    this.points = new Points(geometry, material);
    this.scene.add(this.points);

    // Render
    this.renderer.render(this.scene, this.camera);
  }

  findPointAt(clientX: number, clientY: number): number {
    if (!this.points || !this.data.length) return -1;

    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.points);

    return intersects.length > 0 ? intersects[0].index! : -1;
  }

  /**
   * Alternative hit detection using linear search (more reliable for 2D)
   */
  findPointAtLinear(clientX: number, clientY: number): number {
    if (!this.data.length || !this.options || !this.scaleContext) {
      return -1;
    }

    const { fields, xAxisProperty, yAxisProperty, xTable, yTable } = this.options;
    const { x, y, reverseX, reverseY } = this.scaleContext;
    const config = getConfig();

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    let closestIndex = -1;
    let closestDist = config.hitThreshold;

    for (let i = 0; i < this.data.length; i++) {
      const d = this.data[i];
      const xVal = getValue(fields, xAxisProperty, d, xTable) as number;
      const yVal = getValue(fields, yAxisProperty, d, yTable) as number;

      const screenX = x(reverseX ? Math.abs(xVal) : xVal);
      const screenY = y(reverseY ? Math.abs(yVal) : yVal);

      const dist = Math.hypot(mouseX - screenX, mouseY - screenY);
      if (dist < closestDist) {
        closestDist = dist;
        closestIndex = i;
      }
    }

    return closestIndex;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height);
    this.camera.right = width;
    this.camera.bottom = height;
    this.camera.updateProjectionMatrix();
  }

  private disposePoints(): void {
    if (this.points) {
      this.scene.remove(this.points);
      this.points.geometry.dispose();
      (this.points.material as ShaderMaterial).dispose();
      this.points = null;
    }
  }

  dispose(): void {
    this.disposePoints();
    this.renderer.dispose();
    this.canvas.remove();
    this.data = [];
  }

  getData(): LogProps[] {
    return this.data;
  }

  isActive(): boolean {
    return this.visible && this.data.length > 0;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.canvas.style.display = visible ? 'block' : 'none';

    // Clear the canvas when hiding to prevent stale visuals
    if (!visible) {
      this.disposePoints();
      this.renderer.clear();
    }
  }

  /**
   * Get point screen position for tooltip positioning
   */
  getPointScreenPosition(index: number): { x: number; y: number } | null {
    if (!this.options || !this.scaleContext || index < 0 || index >= this.data.length) {
      return null;
    }

    const { fields, xAxisProperty, yAxisProperty, xTable, yTable } = this.options;
    const { x, y, reverseX, reverseY } = this.scaleContext;
    const d = this.data[index];

    const xVal = getValue(fields, xAxisProperty, d, xTable) as number;
    const yVal = getValue(fields, yAxisProperty, d, yTable) as number;

    return {
      x: x(reverseX ? Math.abs(xVal) : xVal),
      y: y(reverseY ? Math.abs(yVal) : yVal),
    };
  }

  /**
   * Get the canvas element for event binding
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }
}
