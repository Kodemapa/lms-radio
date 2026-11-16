import { getTranslations } from 'next-intl/server';

/**
 * Attribution for the landing-page photos (all from Wikimedia Commons,
 * cropped to remove patient/exam identifiers). CC BY / BY-SA require it.
 */
const CREDITS = [
  {
    file: 'Obstetric ultrasound scan monitor showing 20-week human fetus profile in Navi Mumbai 2015.jpg',
    author: 'Goleisureintl',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  },
  {
    file: 'Fetal Anomaly Ultrasound Scan in Navi Mumbai.jpg',
    author: 'Goleisureintl',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  },
  {
    file: '3D and 4D Ultrasound Imaging in Navi Mumbai.jpg',
    author: 'Goleisureintl',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  },
  {
    file: 'Doppler Ultrasound and Vascular Sonography Examination in Navi Mumbai, Maharashtra, India.jpg',
    author: 'Goleisureintl',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  },
  {
    file: 'Sonographer in action .jpg',
    author: 'Vision College siew mun',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  {
    file: 'A modern medical ultrasound scanner.jpg',
    author: 'Harrison Keely',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  },
  {
    file: 'Sonography Machine Donation from Raleigh Radiology-16.jpg',
    author: 'waketechcc',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  ...['32', '25', '36', '10'].map((n) => ({
    file: `Sonography Machine Donation from Raleigh Radiology-${n}.jpg`,
    author: 'waketechcc',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  })),
  {
    file: 'Fetal oesophagus at 12 weeks ecografia Dr. Wolfgang Moroder.jpg',
    author: 'Wolfgang Moroder',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
  },
];

export async function ImageCredits() {
  const t = await getTranslations('Home');
  return (
    <div className="container lp-credits">
      <details>
        <summary>{t('credits.title')}</summary>
        <p>{t('credits.note')}</p>
        <ul>
          {CREDITS.map((c) => (
            <li key={c.file}>
              <a
                href={`https://commons.wikimedia.org/wiki/File:${encodeURIComponent(c.file.replaceAll(' ', '_'))}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {c.file.replace(/\.jpg$/, '')}
              </a>{' '}
              · {c.author} ·{' '}
              <a href={c.licenseUrl} target="_blank" rel="noopener noreferrer">
                {c.license}
              </a>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
