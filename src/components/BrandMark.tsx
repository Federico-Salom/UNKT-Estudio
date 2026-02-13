import Image from "next/image";
import Link from "next/link";
import type { StudioContent } from "@/content/studio";

type BrandMarkProps = {
  studio: StudioContent;
  href?: string;
  size?: number;
  showText?: boolean;
  className?: string;
  wordmarkScale?: number;
  gapClassName?: string;
  wordmarkOffsetY?: number;
};

export default function BrandMark({
  studio,
  href = "/",
  size = 48,
  showText = true,
  className = "",
  wordmarkScale = 1,
  gapClassName = "gap-3",
  wordmarkOffsetY = 0,
}: BrandMarkProps) {
  const logoSrc = studio.logo?.src || "/logo.jpg";
  const logoAlt = studio.logo?.alt || studio.name;
  const wordmarkSrc = studio.logo?.wordmarkSrc || "/logo-largo.svg";
  const isDefaultWordmark = wordmarkSrc === "/logo-largo.svg";
  const [brandCoreRaw, ...brandTailParts] = (studio.name || "UNKT Estudio")
    .trim()
    .split(/\s+/);
  const brandCore = (brandCoreRaw || "UNKT").toUpperCase();
  const brandTail = brandTailParts.join(" ") || "Estudio";
  const clampedWordmarkScale = Math.min(Math.max(wordmarkScale, 0.65), 1.2);
  const wordmarkHeight = Math.max(
    Math.round(size * 1.15 * clampedWordmarkScale),
    20
  );
  const wordmarkWidth = Math.max(Math.round(wordmarkHeight * 4.45), 90);
  const brandCoreSize = Math.max(
    Math.round(size * 0.58 * clampedWordmarkScale),
    15
  );
  const brandTailSize = Math.max(
    Math.round(size * 0.29 * clampedWordmarkScale),
    9
  );

  return (
    <Link
      href={href}
      className={`flex min-w-0 items-center ${gapClassName} ${className}`.trim()}
    >
      <Image
        src={logoSrc}
        alt={logoAlt}
        width={size}
        height={size}
        className="block shrink-0 rounded-full object-contain"
        style={{ width: size, height: size }}
        priority
      />
      {showText ? (
        isDefaultWordmark ? (
          <span
            className="inline-flex min-w-0 max-w-full shrink items-center gap-1.5 overflow-hidden whitespace-nowrap text-accent"
            style={
              wordmarkOffsetY
                ? {
                    transform: `translateY(${wordmarkOffsetY}px)`,
                  }
                : undefined
            }
            aria-label={studio.name}
          >
            <span
              className="truncate leading-none font-semibold uppercase tracking-[0.08em]"
              style={{
                fontSize: brandCoreSize,
                fontFamily: "var(--font-controls), 'Nunito Sans', sans-serif",
              }}
            >
              {brandCore}
            </span>
            <span
              className="truncate leading-none font-semibold uppercase tracking-[0.16em] text-accent/82"
              style={{
                fontSize: brandTailSize,
                fontFamily: "var(--font-controls), 'Nunito Sans', sans-serif",
              }}
            >
              {brandTail.toUpperCase()}
            </span>
          </span>
        ) : (
          <Image
            src={wordmarkSrc}
            alt=""
            aria-hidden
            width={wordmarkWidth}
            height={wordmarkHeight}
            className="block h-auto min-w-0 shrink object-contain"
            style={{
              width: wordmarkWidth,
              height: wordmarkHeight,
              transform: `translateY(${wordmarkOffsetY}px)`,
            }}
            priority
          />
        )
      ) : (
        <span className="sr-only">{studio.name}</span>
      )}
    </Link>
  );
}
