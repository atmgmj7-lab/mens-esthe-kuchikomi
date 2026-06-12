type Props = {
  en?: string;
  jp: string;
  center?: boolean;
  icon?: string;
  className?: string;
};

export function SectionTitle({ en, jp, center, icon, className = "" }: Props) {
  if (en) {
    return (
      <h2 className={`c-secTitle ${center ? "-center" : ""} ${className}`.trim()}>
        <span className="c-secTitle__en">{en}</span>
        <span className="c-secTitle__jp">{jp}</span>
      </h2>
    );
  }

  return (
    <h2 className={`mep-section-title ${center ? "mep-section-title--center" : ""} ${className}`.trim()}>
      {icon ? <span className="mep-section-title__icon">{icon}</span> : null}
      {jp}
    </h2>
  );
}

export function EsSectionTitle({
  en,
  ja,
  large
}: {
  en: string;
  ja: string;
  large?: boolean;
}) {
  return (
    <h2 className={`sec-title es-sec-title ${large ? "es-sec-title-large" : ""}`.trim()}>
      <span className="es-sec-title__en">{en}</span>
      <span className={large ? "main" : "es-sec-title__ja"}>{ja}</span>
    </h2>
  );
}
