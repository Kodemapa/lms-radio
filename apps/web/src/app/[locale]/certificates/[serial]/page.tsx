import { CertificatePublicSchema } from '@obgyn/types';
import { BadgeCheck } from 'lucide-react';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { CertificateView } from '@/components/certificate/certificate-view';
import { PrintButton } from '@/components/print-button';
import { Link } from '@/i18n/navigation';
import { apiGet } from '@/lib/server-api';

type Props = { params: Promise<{ locale: string; serial: string }> };

async function load(serial: string) {
  if (!/^[A-Z0-9-]{6,32}$/i.test(serial)) return null;
  return apiGet(`/certificates/${encodeURIComponent(serial)}`, CertificatePublicSchema).catch(() => null);
}

export async function generateMetadata({ params }: Props) {
  const { serial, locale } = await params;
  const [certificate, t] = await Promise.all([load(serial), getTranslations({ locale, namespace: 'Certificate' })]);
  return certificate ? { title: `${t('title')}: ${certificate.learnerName}`, robots: { index: false } } : {};
}

/** Public, printable certificate in the course's own design; the URL doubles as the verification link. */
export default async function CertificatePage({ params }: Props) {
  const { locale, serial } = await params;
  setRequestLocale(locale);
  const [certificate, t, format] = await Promise.all([load(serial), getTranslations('Certificate'), getFormatter()]);
  if (!certificate) notFound();
  const verifyUrl = `${process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000'}/${locale}/certificates/${certificate.serial}`;
  const issuedDate = format.dateTime(new Date(certificate.issuedAt), { dateStyle: 'long' });

  return (
    <main id="main" className="flex min-h-dvh flex-col items-center gap-6 bg-section px-4 py-8 print:bg-white print:p-0">
      <div className="flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="flex items-center gap-2 font-medium text-success">
          <BadgeCheck aria-hidden className="size-5" />
          {t('verified')}
        </p>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm hover:underline">{t('backHome')}</Link>
          <PrintButton label={t('print')} />
        </div>
      </div>
      <div className="w-full max-w-5xl shadow-lg print:max-w-none print:shadow-none">
        <CertificateView
          template={certificate.template}
          vars={{ learnerName: certificate.learnerName, courseTitle: certificate.courseTitle, issuedDate, serial: certificate.serial }}
          labels={{
            issued: t('issued', { date: issuedDate }),
            serial: t('serial', { serial: certificate.serial }),
            verifyAt: t('verifyAt', { url: verifyUrl }),
          }}
        />
      </div>
    </main>
  );
}
