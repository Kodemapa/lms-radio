import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function NotFound() {
  const t = useTranslations('NotFound');
  return (
    <main id="main" className="container flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
      <h1 className="text-3xl font-bold">{t('title')}</h1>
      <p className="text-muted-foreground">{t('body')}</p>
      <Link href="/" className="text-primary underline">
        {t('home')}
      </Link>
    </main>
  );
}
