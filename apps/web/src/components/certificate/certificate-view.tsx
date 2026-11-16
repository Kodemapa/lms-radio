import { fillCertificateText, type CertificateTemplate, type CertificateVars } from '@obgyn/types';
import { fileUrl } from '@/lib/public-env';

/**
 * The certificate itself (A4 landscape proportions). Shared by the public,
 * printable certificate page and the instructor's live preview.
 */
export function CertificateView({
  template,
  vars,
  labels,
}: {
  template: CertificateTemplate;
  vars: CertificateVars;
  labels: { serial: string; verifyAt: string; issued: string };
}) {
  const fill = (text: string) => fillCertificateText(text, vars);
  const accent = template.accentColor;

  return (
    <article
      className="relative aspect-[1.414] w-full overflow-hidden bg-white text-center text-[#010211] [container-type:inline-size] print:shadow-none"
      style={{ border: `10px double ${accent}` }}
    >
      <div aria-hidden className="absolute -right-[6cqw] -top-[6cqw] size-[22cqw] rounded-full opacity-10" style={{ background: accent }} />
      <div aria-hidden className="absolute -bottom-[8cqw] -left-[8cqw] size-[26cqw] rounded-full opacity-10" style={{ background: accent }} />
      <div className="relative flex h-full flex-col items-center justify-between px-[6cqw] py-[4cqw]">
        <header className="flex flex-col items-center gap-[0.8cqw]">
          {template.logoAssetId ? (
            // eslint-disable-next-line @next/next/no-img-element -- served by the API
            <img src={fileUrl(template.logoAssetId)} alt="" className="h-[8cqw] w-auto object-contain" />
          ) : null}
          {template.issuerName ? <p className="text-[2.2cqw] font-semibold" style={{ color: accent }}>{template.issuerName}</p> : null}
          {template.issuerTagline ? <p className="text-[1.3cqw] text-gray-500">{template.issuerTagline}</p> : null}
        </header>

        <div className="flex flex-col items-center gap-[1.2cqw]">
          <h1 className="text-[3.6cqw] font-bold uppercase tracking-[0.15em]" style={{ color: accent }}>
            {fill(template.heading)}
          </h1>
          {template.preamble ? <p className="text-[1.8cqw] text-gray-600">{fill(template.preamble)}</p> : null}
          <p className="border-b-2 border-gray-300 px-[4cqw] pb-[0.6cqw] text-[4.4cqw] font-semibold leading-tight">{vars.learnerName}</p>
          {template.body ? <p className="text-[1.8cqw] text-gray-600">{fill(template.body)}</p> : null}
          <p className="max-w-[80%] text-[2.8cqw] font-semibold leading-tight">{vars.courseTitle}</p>
        </div>

        <footer className="flex w-full flex-col gap-[1.5cqw]">
          {template.signatories.length > 0 ? (
            <div className="flex flex-wrap items-end justify-center gap-x-[6cqw] gap-y-[1cqw]">
              {template.signatories.map((s, i) => (
                <div key={`${s.name}-${i}`} className="flex min-w-[18cqw] flex-col items-center">
                  {s.signatureAssetId ? (
                    // eslint-disable-next-line @next/next/no-img-element -- served by the API
                    <img src={fileUrl(s.signatureAssetId)} alt="" className="h-[5cqw] w-auto object-contain" />
                  ) : (
                    <span className="h-[5cqw]" />
                  )}
                  <span className="w-full border-t border-gray-400 pt-[0.4cqw] text-[1.5cqw] font-semibold">{s.name}</span>
                  <span className="text-[1.2cqw] text-gray-500">{s.designation}</span>
                </div>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap items-end justify-between gap-[1cqw] text-[1.2cqw] text-gray-500">
            <span className="text-left">{template.footerNote ? fill(template.footerNote) : ''}</span>
            <span className="text-right">
              <span className="block">{labels.issued}</span>
              <span className="block font-mono">{labels.serial}</span>
              <span className="block">{labels.verifyAt}</span>
            </span>
          </div>
        </footer>
      </div>
    </article>
  );
}
