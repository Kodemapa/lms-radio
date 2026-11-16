/*
 * Development seed: the Certificate Course in Fetal Medicine (Global Institute
 * of Foetal Science), built from the course brochure. Removes every other
 * course and category so the catalogue shows only this programme.
 *
 * Sample videos are openly licensed clips stored in .storage/seed/ (run
 * ./prisma/fetch-sample-media.sh first). The first two modules use them, with
 * in-video questions that pause the video until answered correctly.
 *
 * Sign in (development code 123456):
 *   admin@example.com       ADMIN
 *   instructor@example.com  FACULTY (Global Institute of Foetal Science)
 */
import { ContentStatus, CourseLevel, LessonKind, MediaKind, PrismaClient, Role } from '@prisma/client';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

const prisma = new PrismaClient();
const STORAGE = path.resolve(__dirname, '..', process.env.LOCAL_STORAGE_DIR ?? '.storage');
const COURSE_SLUG = 'certificate-course-in-fetal-medicine';

type Option = [text: string, correct: boolean];
interface Question {
  text: string;
  explanation?: string;
  options: Option[];
}
interface Checkpoint extends Question {
  atSec: number;
}

// ---- Sample media ---------------------------------------------------------------

const VIDEOS = {
  placenta: {
    file: 'seed/placenta.webm',
    durationSec: 135,
    credit:
      'Video: "The Placenta – When a New Organ Grows in the Body", Deutsche Welle (Explaining the Human Body), CC BY-SA 4.0, via Wikimedia Commons.',
    checkpoints: [
      {
        atSec: 40,
        text: 'What is the main job of the placenta?',
        explanation: 'The placenta exchanges oxygen, nutrients and waste between mother and fetus, and produces pregnancy hormones.',
        options: [
          ['Exchanging oxygen, nutrients and waste between mother and fetus', true],
          ['Producing all of the amniotic fluid', false],
          ['Blocking every infection from reaching the fetus', false],
        ],
      },
      {
        atSec: 100,
        text: "Does the mother's blood normally mix directly with the fetal blood in the placenta?",
        explanation: 'No. The two circulations stay separate; exchange happens across the thin placental barrier.',
        options: [
          ['No, they are separated by the placental barrier', true],
          ['Yes, they mix freely in the intervillous space', false],
        ],
      },
    ] satisfies Checkpoint[],
  },
  radiation: {
    file: 'seed/radiation.webm',
    durationSec: 213,
    credit: 'Video: "Prenatal Radiation Exposure", US Centers for Disease Control and Prevention, public domain, via Wikimedia Commons.',
    checkpoints: [
      {
        atSec: 60,
        text: 'Which imaging methods do NOT use ionising radiation? (Choose all that apply)',
        explanation: 'Ultrasound and MRI do not use ionising radiation; X-ray and CT do.',
        options: [
          ['Ultrasound', true],
          ['MRI', true],
          ['CT', false],
          ['Plain X-ray', false],
        ],
      },
      {
        atSec: 150,
        text: 'The risk to the fetus from radiation depends mainly on:',
        explanation: 'Both the dose received and the gestational age at exposure determine the risk.',
        options: [
          ['The dose and the stage of pregnancy at exposure', true],
          ["Only the mother's age", false],
          ['Only the type of hospital', false],
        ],
      },
    ] satisfies Checkpoint[],
  },
} as const;

// ---- Curriculum (from the brochure) ------------------------------------------------

interface Module {
  title: string;
  weeks: string;
  classes: string[];
  mcq: Question[];
}

const MODULES: Module[] = [
  {
    title: 'Guidelines, Protocols and Consensuses',
    weeks: 'Week 1',
    classes: [
      'First Trimester Scan',
      'First Trimester Lexicon',
      'Mid-Trimester Anomaly Scan and UTD Classification',
      'Fetal Echocardiography',
      'Fetal Neurosonography',
    ],
    mcq: [
      {
        text: 'According to ISUOG, the routine first-trimester scan is performed at:',
        explanation: 'Between 11+0 and 13+6 weeks (CRL 45–84 mm).',
        options: [['11+0 to 13+6 weeks', true], ['8 to 10 weeks', false], ['16 to 18 weeks', false], ['20 to 22 weeks', false]],
      },
      {
        text: 'Nuchal translucency should be measured when the crown–rump length is:',
        options: [['45–84 mm', true], ['20–40 mm', false], ['85–100 mm', false]],
      },
      {
        text: 'The routine mid-trimester anomaly scan is usually performed at:',
        options: [['18–22 weeks', true], ['11–14 weeks', false], ['28–32 weeks', false], ['36–38 weeks', false]],
      },
    ],
  },
  {
    title: 'Dating and Doppler',
    weeks: 'Week 2',
    classes: [
      'Dating and growth charts',
      'Doppler in obstetrics',
      'Diagnosis of fetal growth restriction',
      'Management of fetal growth restriction',
      'Fetal macrosomia',
    ],
    mcq: [
      {
        text: 'The most accurate ultrasound measurement for dating in the first trimester is:',
        options: [['Crown–rump length', true], ['Biparietal diameter', false], ['Femur length', false], ['Abdominal circumference', false]],
      },
      {
        text: 'Absent or reversed end-diastolic flow in growth restriction is assessed in the:',
        options: [['Umbilical artery', true], ['Middle cerebral artery', false], ['Uterine artery', false]],
      },
      {
        text: 'The cerebroplacental ratio is calculated as:',
        options: [['MCA PI ÷ umbilical artery PI', true], ['Umbilical artery PI ÷ MCA PI', false], ['Uterine artery PI ÷ MCA PI', false]],
      },
    ],
  },
  {
    title: 'Central Nervous System',
    weeks: 'Weeks 3–6',
    classes: [
      'Basic fetal CNS screening protocols',
      'Neurosonography protocols',
      'Sononeuroanatomy',
      'Embryology of CNS',
      'Normal sulcation and gyration',
      'Malformations of cortical development',
      'Microcephaly and macrocephaly',
      'Intracranial cysts & haemorrhage',
      'Ventriculomegaly',
      'Holoprosencephaly',
      'Midline matters',
      'Disorders of dorsal induction',
      'Fetal brain infections',
      'Posterior fossa cystic malformations',
      'Posterior fossa non-cystic malformations',
      'ONTD',
      'Closed spina bifida',
    ],
    mcq: [
      {
        text: 'Ventriculomegaly is defined as an atrial width of at least:',
        options: [['10 mm', true], ['6 mm', false], ['8 mm', false], ['15 mm', false]],
      },
      {
        text: 'The "lemon" and "banana" signs are associated with:',
        options: [['Open spina bifida', true], ['Holoprosencephaly', false], ['Dandy–Walker malformation', false]],
      },
      {
        text: 'Alobar holoprosencephaly typically shows:',
        options: [
          ['A single monoventricle with fused thalami', true],
          ['Separate thalami with a normal cavum septi pellucidi', false],
          ['Isolated absence of the corpus callosum', false],
        ],
      },
    ],
  },
  {
    title: 'First Trimester',
    weeks: 'Weeks 7–10',
    classes: [
      'Pregnancy dating & failed pregnancy',
      'Bleeding and ectopic pregnancy in first trimester',
      'Image optimisation in first trimester',
      'First trimester aneuploidy screening',
      'Pre-eclampsia screening',
      'The placenta & umbilical cord in early gestation',
      'First trimester ultrasound: the fetal brain',
      'Diagnosing open spina bifida in the first trimester',
      'Fetal heart: normal and abnormal',
      'The use of 3D in the 11–14 weeks examination',
      'Pattern recognition and syndromic conditions in first trimester',
      'Skeletal anomalies: can we diagnose in the first trimester?',
      'First trimester ultrasound: the fetal GIT and GUT',
      'Fetal and embryonic sonographic anatomy before 11 weeks',
      'First trimester ultrasound: the fetal face',
      'First trimester ultrasound in multiple pregnancies',
      'Overview of fetal invasive procedures',
    ],
    mcq: [
      {
        text: 'An absent nasal bone at 11–13 weeks is a marker for:',
        options: [['Trisomy 21', true], ['Neural tube defects', false], ['Fetal anaemia', false]],
      },
      {
        text: 'Assessing intracranial translucency at 11–13 weeks helps screen for:',
        options: [['Open spina bifida', true], ['Congenital heart disease', false], ['Cleft lip', false]],
      },
      {
        text: 'A reversed a-wave in the ductus venosus at 11–13 weeks is associated with:',
        options: [['Aneuploidy and cardiac defects', true], ['A normal pregnancy in all cases', false], ['Placenta praevia', false]],
      },
    ],
  },
  {
    title: 'Cardiovascular System',
    weeks: 'Weeks 11–15',
    classes: [
      'Physiology of fetal circulation',
      'ISUOG guidelines for fetal cardiac evaluation',
      'Embryology of fetal heart – heart tube, atria, interatrial septum',
      'Embryology of fetal heart – interventricular, conotruncal septum and valve formation',
      'Sequential segmental approach in fetal echocardiography',
      'Image optimisation in fetal cardiac evaluation',
      'Cardiac biometry',
      'Overview of ventricular septal defects',
      'ASD & AVSD',
      'Situs & heterotaxy',
      'Left heart abnormalities',
      'Tricuspid valve abnormalities',
      'Transposed great arteries',
      'Univentricular pathologies',
      'Fetal aortic arch abnormalities',
      'Double outlet right ventricle',
      'Overriding great arteries',
      'Three vessel trachea view',
      'Fetal arrhythmias',
      'Imaging of ductus venosus, portal and umbilical veins',
      'TAPVC',
    ],
    mcq: [
      {
        text: 'The sequential segmental approach analyses the heart in which order?',
        options: [
          ['Atria → ventricles → great arteries, with their connections', true],
          ['Great arteries → ventricles → atria', false],
          ['Valves first, then chambers', false],
        ],
      },
      {
        text: 'The three-vessel trachea view is most useful for assessing:',
        options: [['Aortic and ductal arch abnormalities', true], ['Atrial septal defects', false], ['Tricuspid regurgitation', false]],
      },
      {
        text: 'In transposition of the great arteries, the great arteries typically:',
        options: [['Run in parallel instead of crossing', true], ['Cross normally', false], ['Arise as a single common trunk', false]],
      },
    ],
  },
  {
    title: 'Other Systems',
    weeks: 'Weeks 16–18',
    classes: [
      'Mid-trimester anomaly ISUOG guidelines',
      'Extended biometry',
      'Amniotic fluid: marker of fetal health & disease',
      'Abnormalities of placenta, umbilical cord and amniotic membrane',
      'Fetal limb abnormalities',
      'Skeletal dysplasia',
      'Fetal urinary tract abnormalities',
      'GIT & anterior wall abnormalities',
      'Fetal face – orofacial clefts',
      'Fetal face – other than clefts',
      'URSM & cloacal abnormalities',
      'Congenital diaphragmatic hernia',
      'Other lung lesions',
      'Fetal neck abnormalities',
      'Evolving fetal abnormalities',
    ],
    mcq: [
      {
        text: 'Gastroschisis differs from omphalocele because gastroschisis:',
        options: [
          ['Lies to the right of an intact cord insertion, with no covering membrane', true],
          ['Is covered by a peritoneal–amniotic membrane', false],
          ['Usually contains the liver', false],
        ],
      },
      {
        text: 'Severity of congenital diaphragmatic hernia is commonly assessed with:',
        options: [['Observed/expected lung-to-head ratio', true], ['Nuchal translucency', false], ['Amniotic fluid index alone', false]],
      },
      {
        text: 'Polyhydramnios is defined by a deepest vertical pocket of at least:',
        options: [['8 cm', true], ['2 cm', false], ['5 cm', false]],
      },
    ],
  },
  {
    title: 'Twins',
    weeks: 'Week 19',
    classes: [
      'Dating, labelling and assigning chorionicity',
      'Unique complications of monochorionic twins',
      'Discordant growth and management of complications',
    ],
    mcq: [
      {
        text: 'The lambda (twin-peak) sign indicates:',
        options: [['Dichorionic twins', true], ['Monochorionic diamniotic twins', false], ['Monoamniotic twins', false]],
      },
      {
        text: 'Chorionicity is best determined:',
        options: [['In the first trimester', true], ['In the third trimester', false], ['Only at delivery', false]],
      },
      {
        text: 'Twin-to-twin transfusion syndrome occurs in:',
        options: [['Monochorionic twins', true], ['Dichorionic twins', false], ['All twin pregnancies equally', false]],
      },
    ],
  },
  {
    title: 'Genetic Counselling',
    weeks: 'Weeks 20–22',
    classes: [
      'Fundamentals of genetics and types of genetic disorders',
      'Genetic testing and its clinical utility — with case studies',
      'Genetic counselling: approach to genetic disorders, with case discussions',
      'Genetics in recurrent pregnancy loss and infertility: genetic evaluation and preimplantation testing',
      'Aneuploidy markers',
      'Disorders of ventral induction',
      'Posterior fossa and spine abnormalities',
      'Fetal face abnormalities',
      'Fetal cardiac abnormalities – 4 CV',
      'Fetal cardiac abnormalities – outflow tracts',
      'Lung and GI abnormalities',
      'Renal abnormalities',
      'Skeletal abnormalities',
    ],
    mcq: [
      {
        text: 'Amniocentesis is usually performed from:',
        options: [['15 weeks', true], ['8 weeks', false], ['11 weeks', false]],
      },
      {
        text: 'Cell-free DNA testing for aneuploidy is best described as:',
        options: [
          ['A screening test; high-risk results need invasive confirmation', true],
          ['A diagnostic test that needs no confirmation', false],
          ['Not useful for trisomy 21', false],
        ],
      },
      {
        text: 'Chromosomal microarray detects:',
        options: [
          ['Copy-number variants such as microdeletions and duplications', true],
          ['Balanced translocations', false],
          ['All single-base mutations', false],
        ],
      },
    ],
  },
  {
    title: 'Miscellaneous Topics',
    weeks: 'Week 23',
    classes: [
      'Acute gynaecological and surgical disorders in pregnancy',
      'Fetal MRI',
      'PCPNDT',
      'Medico-legal aspects of fetal medicine',
      'How to write a paper and publish it in a journal',
      'Work-life balance for professionals',
      'Stress management for radiologists',
    ],
    mcq: [
      {
        text: 'Under the PC-PNDT Act, communicating fetal sex to anyone is:',
        explanation: 'It is prohibited by law in India; records and registration requirements also apply to every ultrasound facility.',
        options: [['Prohibited', true], ['Allowed after 20 weeks', false], ['Allowed if the parents ask', false]],
      },
      {
        text: 'Gadolinium contrast for MRI in pregnancy is:',
        options: [['Generally avoided', true], ['Routinely recommended', false], ['Required for fetal brain MRI', false]],
      },
      {
        text: 'Fetal MRI is most useful as:',
        options: [
          ['A problem-solving tool after ultrasound, e.g. for the CNS', true],
          ['The first-line screening test', false],
          ['The main method for dating', false],
        ],
      },
    ],
  },
  {
    title: 'Guidelines-Based Planes & Anatomical Landmarks – Live Interactive Case Discussions',
    weeks: 'Weeks 24–25',
    classes: [
      '6 to 11 weeks',
      '11 to 14 weeks – Part A',
      '11 to 14 weeks – Part B',
      '11 to 14 weeks – Part C',
      'Mid-trimester anomaly scan – Part A',
      'Mid-trimester anomaly scan – Part B',
      'Mid-trimester anomaly scan – Part C',
      'Fetal echocardiography – Part A',
      'Fetal echocardiography – Part B',
      'Fetal echocardiography – Part C',
      'Fetal echocardiography – Part D',
      'Fetal echocardiography – Part E',
      'Fetal neurosonography – Part A',
      'Fetal neurosonography – Part B',
      'Fetal neurosonography – Part C',
      'Fetal neurosonography – Part D',
      'Fetal neurosonography – Part E',
    ],
    mcq: [
      {
        text: 'The four-chamber view is obtained in a:',
        options: [['Transverse section of the fetal thorax', true], ['Mid-sagittal section', false], ['Coronal section of the abdomen', false]],
      },
      {
        text: 'A correct transcerebellar plane shows:',
        options: [['The cerebellum and cisterna magna', true], ['The stomach bubble', false], ['Both kidneys', false]],
      },
      {
        text: 'Head circumference is measured in the:',
        options: [['Transthalamic plane', true], ['Transcerebellar plane', false], ['Transorbital plane', false]],
      },
    ],
  },
];

/** Entrance pool: each attempt draws 5 of these at random. */
const ENTRANCE: Question[] = [
  { text: 'The most accurate ultrasound parameter for dating in the first trimester is:', options: [['Crown–rump length', true], ['Biparietal diameter', false], ['Femur length', false]] },
  { text: 'Which imaging modality uses no ionising radiation?', options: [['Ultrasound', true], ['CT', false], ['Plain X-ray', false], ['Fluoroscopy', false]] },
  { text: 'The normal fetal heart rate range is:', options: [['110–160 bpm', true], ['60–90 bpm', false], ['180–220 bpm', false]] },
  { text: 'The "lemon" and "banana" signs suggest:', options: [['Open spina bifida', true], ['Trisomy 18', false], ['Gastroschisis', false]] },
  { text: 'The lambda (twin-peak) sign indicates:', options: [['Dichorionic twins', true], ['Monochorionic twins', false], ['Conjoined twins', false]] },
  { text: 'The routine mid-trimester anomaly scan is done at:', options: [['18–22 weeks', true], ['11–14 weeks', false], ['32–34 weeks', false]] },
  { text: 'Fetal ventriculomegaly is an atrial width of at least:', options: [['10 mm', true], ['5 mm', false], ['20 mm', false]] },
  { text: 'A normal umbilical cord contains:', options: [['Two arteries and one vein', true], ['One artery and two veins', false], ['One artery and one vein', false]] },
  { text: 'Polyhydramnios is a deepest vertical pocket of at least:', options: [['8 cm', true], ['2 cm', false], ['4 cm', false]] },
  { text: 'The four-chamber view is a:', options: [['Transverse section of the fetal thorax', true], ['Sagittal section of the spine', false], ['Coronal section of the face', false]] },
  { text: 'Fetal growth restriction is followed up mainly with Doppler of the:', options: [['Umbilical artery', true], ['Renal artery', false], ['Femoral artery', false]] },
  { text: 'Nuchal translucency is measured when the CRL is:', options: [['45–84 mm', true], ['10–30 mm', false], ['90–120 mm', false]] },
  { text: 'Amniocentesis is usually performed from:', options: [['15 weeks', true], ['8 weeks', false], ['11 weeks', false]] },
  { text: 'Gastroschisis is typically located:', options: [['To the right of an intact cord insertion', true], ['Within the cord insertion, covered by membrane', false], ['In the lower back', false]] },
  { text: 'Under the PC-PNDT Act, communicating fetal sex is:', options: [['Prohibited', true], ['Allowed after 20 weeks', false], ['Allowed on request', false]] },
];

/** Classes 1–10 (modules 1–2) get the sample videos, alternating. */
const VIDEO_FOR_CLASS: Record<number, keyof typeof VIDEOS> = {
  1: 'placenta', 2: 'radiation', 3: 'placenta', 4: 'radiation', 5: 'placenta',
  6: 'radiation', 7: 'placenta', 8: 'radiation', 9: 'placenta', 10: 'radiation',
};

const DESCRIPTION = `Structured, guideline-based training in fetal imaging across every trimester and every organ system, from the Global Institute of Foetal Science (a unit of Karnataka Institute of Fetal Sciences).

Aim
To give radiologists structured training in fetal imaging, so that they can carry out systematic, guideline-based fetal ultrasound examinations in every trimester and recognise and report fetal anomalies across all organ systems.

How it runs
• Duration: 6 months (25 weeks), LMS-based classes
• 120 theory classes of 1 hour, including live interactive case discussions
• Live Q&A sessions twice weekly
• 10 modules, university certificate

Module assessment
Each module ends with an MCQ test on the LMS and submission of your own scan images. 80% attendance and a pass in all module assessments are needed to sit the final examination.

Examination & certification
• Theory: one paper, 100 marks, 3 hours (10 questions of 10 marks)
• Practical: long case 40, two short cases 15 each, viva voce 30 (100 marks)
• Pass: at least 50/100 in theory and at least 50/100 in practical and viva together. Two attempts.
• Successful candidates are awarded a University Certificate.

Admissions: selection by online MCQ-based entrance exam. +91 95131 12253 · globalinstituteoffoetalscience@gmail.com · gifsfetalmedicine.com`;

// ---- Seed -------------------------------------------------------------------------

async function mediaAsset(key: string, kind: MediaKind, mimeType: string, durationSec: number | null, isPublic: boolean) {
  const file = path.join(STORAGE, key);
  if (!existsSync(file)) {
    console.warn(`  ! ${key} not found in ${STORAGE}; run ./prisma/fetch-sample-media.sh`);
    return null;
  }
  return prisma.mediaAsset.upsert({
    where: { storageKey: key },
    update: { status: 'READY', sizeBytes: statSync(file).size, durationSec, isPublic },
    create: {
      kind,
      storageKey: key,
      mimeType,
      status: 'READY',
      sizeBytes: statSync(file).size,
      originalName: path.basename(key),
      durationSec,
      deidentified: true, // educational clips, no patient data
      isPublic,
    },
  });
}

async function main() {
  // Start clean: only this programme in the catalogue.
  const removed = await prisma.course.deleteMany({ where: { slug: { not: COURSE_SLUG } } });
  await prisma.course.deleteMany({ where: { slug: COURSE_SLUG } });
  await prisma.category.deleteMany({ where: { parentId: { not: null } } });
  await prisma.category.deleteMany({ where: { slug: { not: 'fetal-medicine' } } });
  const category = await prisma.category.upsert({
    where: { slug: 'fetal-medicine' },
    update: { name: 'Fetal Medicine', position: 0 },
    create: {
      slug: 'fetal-medicine',
      name: 'Fetal Medicine',
      description: 'Fetal imaging, anomaly diagnosis, Doppler and prenatal genetics.',
      position: 0,
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: { role: Role.ADMIN },
    create: { email: 'admin@example.com', displayName: 'Platform Admin', role: Role.ADMIN },
  });
  const profile = {
    displayName: 'Global Institute of Foetal Science',
    headline: 'A unit of Karnataka Institute of Fetal Sciences',
    bio: 'University certificate programmes in fetal medicine for radiologists. Admissions: +91 95131 12253 · globalinstituteoffoetalscience@gmail.com · gifsfetalmedicine.com',
    role: Role.FACULTY,
  };
  const institute = await prisma.user.upsert({
    where: { email: 'instructor@example.com' },
    update: profile,
    create: { email: 'instructor@example.com', ...profile },
  });

  const [cover, logo, placenta, radiation] = await Promise.all([
    mediaAsset('seed/cover.png', MediaKind.IMAGE, 'image/png', null, true),
    mediaAsset('seed/logo.png', MediaKind.IMAGE, 'image/png', null, true),
    mediaAsset(VIDEOS.placenta.file, MediaKind.VIDEO, 'video/webm', VIDEOS.placenta.durationSec, false),
    mediaAsset(VIDEOS.radiation.file, MediaKind.VIDEO, 'video/webm', VIDEOS.radiation.durationSec, false),
  ]);
  const assets = { placenta, radiation };

  const course = await prisma.course.create({
    data: {
      slug: COURSE_SLUG,
      title: 'Certificate Course in Fetal Medicine',
      shortDescription:
        'Six-month university certificate programme: guideline-based fetal imaging across every trimester and organ system, for radiologists.',
      description: DESCRIPTION,
      categoryId: category.id,
      instructorId: institute.id,
      level: CourseLevel.ADVANCED,
      language: 'en',
      tags: ['fetal medicine', 'neurosonography', 'fetal echocardiography', 'first trimester', 'doppler', 'isuog'],
      learnings: [
        'Perform a systematic, guideline-based fetal ultrasound examination in all three trimesters',
        'Date a pregnancy accurately and assess fetal growth using standard charts',
        'Use obstetric Doppler to diagnose and follow up fetal growth restriction',
        'Recognise and characterise anomalies of the brain, spine, face, heart, thorax, abdomen, urinary tract and skeleton',
        'Assess twin pregnancies, assign chorionicity and recognise monochorionic complications',
        'Apply prenatal genetics, choose appropriate tests and counsel families after a diagnosis',
        'Write structured, standardised fetal ultrasound reports',
      ],
      requirements: [
        'MD / DNB Radiodiagnosis, or DMRD with one year post-DMRD experience',
        'Selection by online MCQ-based entrance examination',
      ],
      metaTitle: 'Certificate Course in Fetal Medicine | GIFS',
      metaDescription: '6-month university certificate in fetal medicine for radiologists: 120 classes, 10 modules, live case discussions.',
      // Free for now so it can be tested end to end; set the fee once checkout (Phase 3) exists.
      isFree: true,
      certificateEnabled: true,
      sequentialAccess: true,
      // Brochure: "Selection by online MCQ-based entrance exam".
      entranceTestEnabled: true,
      entranceQuestionCount: 5,
      entrancePassPercent: 60,
      entranceMaxAttempts: 3,
      entranceTopic: 'Entrance',
      thumbnailAssetId: cover?.id ?? null,
      status: ContentStatus.PUBLISHED,
      publishedAt: new Date(),
    },
  });

  // Question bank: entrance pool + every module's MCQs, so instructors can reuse them.
  const toBank = (q: Question, topic: string) => ({
    courseId: course.id,
    topic,
    text: q.text,
    explanation: q.explanation ?? null,
    allowMultiple: q.options.filter(([, ok]) => ok).length > 1,
    options: q.options.map(([text, isCorrect]) => ({ text, isCorrect })),
  });
  await prisma.bankQuestion.createMany({ data: ENTRANCE.map((q) => toBank(q, 'Entrance')) });

  await prisma.certificateTemplate.create({
    data: {
      courseId: course.id,
      heading: 'Certificate of Completion',
      preamble: 'This is to certify that',
      body: 'has successfully completed the six-month university certificate programme',
      issuerName: 'Global Institute of Foetal Science',
      issuerTagline: 'A unit of Karnataka Institute of Fetal Sciences',
      logoAssetId: logo?.id ?? null,
      accentColor: '#0b2d4f',
      signatories: [
        { name: 'Course Director', designation: 'Global Institute of Foetal Science', signatureAssetId: null },
        { name: 'Controller of Examinations', designation: 'University Certificate Programme', signatureAssetId: null },
      ],
      footerNote: 'Issued on {issuedDate} · Certificate no. {serial}',
    },
  });

  let classNo = 0;
  let lessonsCreated = 0;
  for (const [moduleIndex, module] of MODULES.entries()) {
    const chapter = await prisma.chapter.create({
      data: {
        courseId: course.id,
        position: moduleIndex + 1,
        title: `Module ${moduleIndex + 1}: ${module.title}`,
        description: `${module.weeks} · ${module.classes.length} classes`,
      },
    });
    let position = 0;
    for (const title of module.classes) {
      classNo += 1;
      const videoKey = VIDEO_FOR_CLASS[classNo];
      const video = videoKey ? VIDEOS[videoKey] : null;
      const asset = videoKey ? assets[videoKey] : null;
      await prisma.lesson.create({
        data: {
          courseId: course.id,
          chapterId: chapter.id,
          position: ++position,
          title: `${classNo}. ${title}`,
          kind: LessonKind.VIDEO,
          isPreview: classNo === 1,
          durationSec: asset && video ? video.durationSec : 3600,
          mediaAssetId: asset?.id ?? null,
          description: asset && video ? `Sample video for testing in-video questions. ${video.credit}` : null,
          questions:
            asset && video
              ? {
                  create: video.checkpoints.map((cp, i) => ({
                    position: i + 1,
                    atSec: cp.atSec,
                    text: cp.text,
                    explanation: cp.explanation ?? null,
                    allowMultiple: cp.options.filter(([, ok]) => ok).length > 1,
                    options: { create: cp.options.map(([text, isCorrect], oi) => ({ position: oi + 1, text, isCorrect })) },
                  })),
                }
              : undefined,
        },
      });
      lessonsCreated += 1;
    }

    // Each module ends with an MCQ test (built from the bank) and submission of the learner's own scan images.
    const bankRows: { id: string }[] = [];
    for (const q of module.mcq) bankRows.push(await prisma.bankQuestion.create({ data: toBank(q, `Module ${moduleIndex + 1}`) }));
    await prisma.lesson.create({
      data: {
        courseId: course.id,
        chapterId: chapter.id,
        position: ++position,
        title: `Module ${moduleIndex + 1} MCQ test`,
        kind: LessonKind.QUIZ,
        passPercent: 60,
        questions: {
          create: module.mcq.map((q, qi) => ({
            position: qi + 1,
            bankQuestionId: bankRows[qi]!.id,
            text: q.text,
            explanation: q.explanation ?? null,
            allowMultiple: q.options.filter(([, ok]) => ok).length > 1,
            options: { create: q.options.map(([text, isCorrect], oi) => ({ position: oi + 1, text, isCorrect })) },
          })),
        },
      },
    });
    await prisma.lesson.create({
      data: {
        courseId: course.id,
        chapterId: chapter.id,
        position: ++position,
        title: `Module ${moduleIndex + 1} scan image submission`,
        kind: LessonKind.ASSIGNMENT,
        points: 10,
        submissionKinds: [MediaKind.PDF, MediaKind.IMAGE],
        instructions: `Submit your own scan images demonstrating the planes and findings covered in "${module.title}".\n\nRemove all patient identifiers before uploading: no names, hospital numbers, dates of birth or faces on screen. Add a short note on how you obtained each image.`,
      },
    });
    lessonsCreated += 2;
  }

  console.log(
    `Removed ${removed.count} old course(s). Seeded "${course.title}": ${MODULES.length} modules, ${classNo} classes, ${lessonsCreated} lessons.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
