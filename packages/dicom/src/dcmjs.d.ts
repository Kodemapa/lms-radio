/** Minimal typings for the parts of dcmjs we use (the package ships none). */
declare module 'dcmjs' {
  type Dataset = Record<string, unknown>;
  export interface DicomDictLike {
    meta: Record<string, { vr: string; Value?: unknown[] }>;
    dict: Record<string, { vr: string; Value?: unknown[] }>;
    write(options?: Record<string, unknown>): ArrayBuffer;
  }
  const dcmjs: {
    data: {
      DicomMessage: { readFile(buffer: ArrayBuffer, options?: Record<string, unknown>): DicomDictLike };
      DicomDict: new (meta: DicomDictLike['meta']) => DicomDictLike;
      DicomMetaDictionary: {
        naturalizeDataset(dict: DicomDictLike['dict']): Dataset;
        denaturalizeDataset(dataset: Dataset): DicomDictLike['dict'];
        uid(): string;
      };
    };
  };
  export default dcmjs;
}
