export type WorkerListingImageResult =
  | { ok: true; bytes: Uint8Array; type: "image/jpeg"; width: number; height: number; sha256: string }
  | { ok: false; error: string };

export function inspectWorkerListingImage(file: File): Promise<WorkerListingImageResult>;
