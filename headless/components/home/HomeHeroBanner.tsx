import { ResponsiveHeroBanner } from "@/components/common/ResponsiveHeroBanner";
import { HOME_HERO_CONFIG } from "@/lib/home-hero-config";

export function HomeHeroBanner({ shopCount }: { shopCount: number }) {
  const config = HOME_HERO_CONFIG;

  return (
    <ResponsiveHeroBanner
      eyebrow={config.eyebrow}
      title={config.title}
      lead={config.lead}
      pcImage={config.pcImage}
      spImage={config.spImage}
      ctas={config.ctas}
      shopCount={shopCount}
    />
  );
}
