import { Badge, Card, CardDescription, CardHeader, CardTitle } from '@obgyn/ui';
import { getTranslations, setRequestLocale } from 'next-intl/server';

const SIMULATORS = ['fetalUltrasound', 'biometry', 'doppler', 'ctg', 'gynae', 'labourWard'] as const;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Simulators' });
  return { title: t('title') };
}

export default async function SimulatorsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Simulators');

  return (
    <div className="container flex flex-col gap-6 py-8 lg:py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="max-w-2xl text-muted-foreground">{t('intro')}</p>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SIMULATORS.map((key) => (
          <li key={key}>
            <Card className="h-full">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle>{t(`items.${key}.title`)}</CardTitle>
                  <Badge>{t('planned')}</Badge>
                </div>
                <CardDescription>{t(`items.${key}.body`)}</CardDescription>
              </CardHeader>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
