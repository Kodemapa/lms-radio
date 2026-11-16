import { describe, expect, it } from 'vitest';
import { findFetalSexDeterminationText, isFetalSexKey, stripFetalSexFields } from './compliance.js';

describe('isFetalSexKey', () => {
  it.each(['fetalSex', 'fetal_sex', 'foetal-gender', 'babyGender', 'sex_of_fetus', 'SEX', 'gender'])(
    'flags %s',
    (key) => expect(isFetalSexKey(key)).toBe(true),
  );

  it.each(['gestationalAge', 'femurLength', 'sexuallyTransmittedInfection', 'parity'])(
    'keeps %s',
    (key) => expect(isFetalSexKey(key)).toBe(false),
  );

  it('can keep bare sex keys when asked', () => {
    expect(isFetalSexKey('sex', { stripGenericSexKeys: false })).toBe(false);
  });
});

describe('stripFetalSexFields', () => {
  it('removes nested fields and reports their paths', () => {
    const input = {
      caseId: 'c1',
      ga: '22w3d',
      fetuses: [
        { id: 'A', fetalSex: 'F', efw: 480 },
        { id: 'B', annotations: { gender: 'M', plane: 'transthalamic' } },
      ],
    };

    const { value, removedPaths } = stripFetalSexFields(input);

    expect(value).toEqual({
      caseId: 'c1',
      ga: '22w3d',
      fetuses: [{ id: 'A', efw: 480 }, { id: 'B', annotations: { plane: 'transthalamic' } }],
    });
    expect(removedPaths).toEqual(['fetuses[0].fetalSex', 'fetuses[1].annotations.gender']);
  });

  it('does not mutate the input', () => {
    const input = { fetal_sex: 'M' };
    stripFetalSexFields(input);
    expect(input).toEqual({ fetal_sex: 'M' });
  });
});

describe('findFetalSexDeterminationText', () => {
  it.each([
    'Learn fetal sex determination at 12 weeks',
    "How to identify the baby's gender on scan",
    'Predict the sex of the fetus from the genital tubercle',
    'Is it a boy or girl? Tips for sonologists',
    'भ्रूण का लिंग कैसे पता करें',
    'लिंग जाँच की तकनीक',
  ])('flags %p', (text) => expect(findFetalSexDeterminationText(text).length).toBeGreaterThan(0));

  it.each([
    'Fetal biometry: BPD, HC, AC and FL',
    'Sexually transmitted infections in pregnancy',
    'Gender-sensitive communication with patients',
    'Placental localisation and cervical length',
  ])('allows %p', (text) => expect(findFetalSexDeterminationText(text)).toEqual([]));
});
