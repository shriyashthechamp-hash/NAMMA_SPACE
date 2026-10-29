declare module '@mkkellogg/gaussian-splats-3d' {
  import * as THREE from 'three';

  export interface SplatSceneOptions {
    splatAlphaRemovalThreshold?: number;
    showLoadingUI?: boolean;
    position?: [number, number, number];
    rotation?: [number, number, number, number];
    scale?: [number, number, number];
    progressiveLoad?: boolean;
    format?: number;
    onProgress?: (percent: number, percentStr: string, status: any) => void;
  }

  export interface DropInViewerOptions {
    gpuAcceleratedSort?: boolean;
    sharedMemoryForWorkers?: boolean;
    integerBasedSort?: boolean;
    dynamicScene?: boolean;
    logLevel?: number;
  }

  export class DropInViewer extends THREE.Group {
    constructor(options?: DropInViewerOptions);
    viewer: any;
    splatMesh: any;
    addSplatScene(path: string, options?: SplatSceneOptions): Promise<void>;
    addSplatScenes(scenes: Array<{ path: string } & SplatSceneOptions>): Promise<void>;
    dispose(): void;
  }

  export enum SceneFormat {
    Ply = 0,
    Splat = 1,
    KSplat = 2
  }

  export class PlyParser {
    static parseToUncompressedSplatBuffer(buffer: ArrayBuffer): Promise<any>;
  }
}
