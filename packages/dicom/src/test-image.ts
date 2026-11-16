import dcmjs from 'dcmjs';

const { DicomDict, DicomMetaDictionary } = dcmjs.data;

/** A tiny calibrated 8-bit ultrasound image with identifying details, for tests. */
export function makeTestImage(options: { rows?: number; columns?: number; mmPerPx?: number; extra?: Record<string, unknown> } = {}): ArrayBuffer {
  const rows = options.rows ?? 64;
  const columns = options.columns ?? 80;
  const cmPerPx = (options.mmPerPx ?? 0.2) / 10;
  const sopInstanceUID = DicomMetaDictionary.uid();
  const dataset = {
    SOPClassUID: '1.2.840.10008.5.1.4.1.1.6.1',
    SOPInstanceUID: sopInstanceUID,
    StudyInstanceUID: DicomMetaDictionary.uid(),
    SeriesInstanceUID: DicomMetaDictionary.uid(),
    Modality: 'US',
    PatientName: { Alphabetic: 'Sharma^Priya' },
    PatientID: 'MRN-123456',
    PatientBirthDate: '19920314',
    InstitutionName: 'City Hospital',
    ReferringPhysicianName: { Alphabetic: 'Rao^Asha' },
    StudyDate: '20260101',
    AccessionNumber: 'ACC42',
    ImageComments: 'baby looks well',
    SamplesPerPixel: 1,
    PhotometricInterpretation: 'MONOCHROME2',
    Rows: rows,
    Columns: columns,
    BitsAllocated: 8,
    BitsStored: 8,
    HighBit: 7,
    PixelRepresentation: 0,
    BurnedInAnnotation: 'NO',
    SequenceOfUltrasoundRegions: [
      {
        RegionLocationMinX0: 0,
        RegionLocationMinY0: 0,
        RegionLocationMaxX1: columns - 1,
        RegionLocationMaxY1: rows - 1,
        RegionSpatialFormat: 1,
        RegionDataType: 1,
        RegionFlags: 0,
        PhysicalUnitsXDirection: 3,
        PhysicalUnitsYDirection: 3,
        PhysicalDeltaX: cmPerPx,
        PhysicalDeltaY: cmPerPx,
        ReferencePixelX0: 0,
        ReferencePixelY0: 0,
      },
    ],
    PixelData: new Uint8Array(rows * columns).fill(100).buffer,
    ...options.extra,
  };
  const meta = DicomMetaDictionary.denaturalizeDataset({
    FileMetaInformationVersion: new Uint8Array([0, 1]).buffer,
    MediaStorageSOPClassUID: dataset.SOPClassUID,
    MediaStorageSOPInstanceUID: sopInstanceUID,
    TransferSyntaxUID: '1.2.840.10008.1.2.1',
    ImplementationClassUID: '2.25.1',
  });
  const dict = new DicomDict(meta);
  dict.dict = DicomMetaDictionary.denaturalizeDataset(dataset);
  dict.dict['00091010'] = { vr: 'LO', Value: ['private vendor note'] };
  return dict.write();
}
