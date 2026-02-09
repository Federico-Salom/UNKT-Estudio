import Image from "next/image";
import Link from "next/link";
import type { StudioContent } from "@/content/studio";

type BrandMarkProps = {
  studio: StudioContent;
  href?: string;
  size?: number;
  showText?: boolean;
  className?: string;
};

export default function BrandMark({
  studio,
  href = "/",
  size = 48,
  showText = true,
  className = "",
}: BrandMarkProps) {
  const logoSrc = studio.logo?.src || "/logo.jpg";
  const logoAlt = studio.logo?.alt || studio.name;
  const wordmarkSrc = studio.logo?.wordmarkSrc || "/logo-largo.svg";
  const wordmarkHeight = Math.max(Math.round(size * 1.15), 30);
  const wordmarkWidth = Math.max(Math.round(wordmarkHeight * 4.45), 140);

  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-3 ${className}`.trim()}
    >
      <Image
        src={logoSrc}
        alt={logoAlt}
        width={size}
        height={size}
        className="shrink-0 rounded-full object-contain"
        style={{ width: size, height: size }}
        priority
      />
      {showText ? (
        <Image
          src={wordmarkSrc}
          alt=""
          aria-hidden
          width={wordmarkWidth}
          height={wordmarkHeight}
          className="h-auto shrink-0 object-contain"
          style={{ width: wordmarkWidth, height: wordmarkHeight }}
          priority
        />
      ) : (
        <span className="sr-only">{studio.name}</span>
      )}
    </Link>
  );
}
