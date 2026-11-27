import { MonitorSmartphone, ScanFace, ShieldCheck, ShieldPlus } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import facultyTeaching from './images/faculty-teaching.webp';
import profileScan from './images/fetal-profile-scan.webp';
import { type JourneyStep, LearningJourney } from './learning-journey';
import { Reveal } from './reveal';

const TRUST = [
  { key: 'protected', Icon: ShieldCheck },
  { key: 'deidentified', Icon: ScanFace },
  { key: 'pcpndt', Icon: ShieldPlus },
  // Key kept so admin wording overrides still apply; the card is now about any device.
  { key: 'languages', Icon: MonitorSmartphone },
] as const;

/**
 * "How you'll learn" — the real learner flow, step by step:
 * video class → DICOM case → auto-grading → progress report.
 */
export async function WhyChooseUs() {
  const t = await getTranslations('Home');
  // The report mock-up borrows the real report's labels so the two never drift apart.
  const r = await getTranslations('Report');
  const steps: JourneyStep[] = [
    {
      key: 'watch',
      title: t('journey.watch.title'),
      body: t('journey.watch.body'),
      visual: { type: 'photo', src: facultyTeaching, alt: t('img.faculty') },
    },
    {
      key: 'measure',
      title: t('journey.measure.title'),
      body: t('journey.measure.body'),
      visual: { type: 'photo', src: profileScan, alt: t('img.profile'), calipers: true },
    },
    {
      key: 'graded',
      title: t('journey.graded.title'),
      body: t('journey.graded.body'),
      visual: {
        type: 'result',
        src: profileScan,
        title: t('journey.result.title'),
        rows: [
          { label: t('journey.result.hc'), verdict: t('journey.result.within'), ok: true },
          { label: t('journey.result.bpd'), verdict: t('journey.result.position'), ok: false },
          { label: t('journey.result.finding'), verdict: t('journey.result.correct'), ok: true },
        ],
        footer: t('journey.result.footer'),
        note: t('mockNote'),
      },
    },
    {
      key: 'report',
      title: t('journey.report.title'),
      body: t('journey.report.body'),
      visual: {
        type: 'report',
        title: r('myTitle'),
        course: t('journey.progress.course'),
        progress: { label: r('progress'), percent: 58, detail: r('lessonsDone', { done: 14, total: 24 }) },
        where: [
          { label: r('youWereOn'), lesson: t('journey.progress.lastLesson') },
          { label: r('nextUp'), lesson: t('journey.progress.nextLesson'), next: true },
        ],
        stats: [
          { label: r('watchTime'), value: t('journey.progress.watchValue'), detail: r('watchTimeHelp') },
          { label: r('quizAverage'), value: '76%', detail: r('quizAttempts', { count: 9 }) },
          { label: r('videoQuestions'), value: '81%', detail: r('firstTryHelp', { count: 47 }) },
        ],
        topics: {
          title: r('topicsTitle'),
          columns: { topic: r('topic'), score: r('score'), level: r('level.title') },
          rows: [
            { label: t('week.anatomy'), score: 84, detail: r('correctOf', { correct: 21, answered: 25 }), level: r('level.STRONG'), tone: 'strong' },
            { label: t('week.biometry'), score: 62, detail: r('correctOf', { correct: 13, answered: 21 }), level: r('level.DEVELOPING'), tone: 'mid' },
            { label: t('week.doppler'), score: 34, detail: r('correctOf', { correct: 6, answered: 18 }), level: r('level.NEEDS_WORK'), tone: 'weak' },
          ],
        },
        note: t('mockNote'),
      },
    },
  ];

  return (
    <section id="learning-approach" aria-labelledby="why" className="lp-section lp-journey-section">
      <div className="container">
        <Reveal className="lp-section-top">
          <div>
            <p className="lp-kicker">{t('journeyEyebrow')}</p>
            <h2 id="why" className="lp-title">
              {t('journey.title')}
            </h2>
          </div>
          <p className="lp-lede">{t('journey.subtitle')}</p>
        </Reveal>
        <LearningJourney steps={steps} />
        <ul className="lp-trust" aria-label={t('trust.label')}>
          {TRUST.map(({ key, Icon }, i) => (
            <Reveal as="li" key={key} delay={i * 70}>
              <span className="lp-trust-icon">
                <Icon aria-hidden className="size-5" />
              </span>
              <span>
                <strong>{t(`trust.${key}.title`)}</strong>
                {t(`trust.${key}.body`)}
              </span>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
