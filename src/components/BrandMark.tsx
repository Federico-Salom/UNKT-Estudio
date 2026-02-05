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
  size = 40,
  showText = false,
  className = "",
}: BrandMarkProps) {
  const logoSrc = studio.logo?.src || "/logo.png";
  const logoAlt = studio.logo?.alt || studio.name;

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
        className="h-10 w-10 rounded-full object-contain"
        priority
      />
      {showText ? (
        <span className="font-display text-2xl uppercase tracking-[0.2em] text-fg">
          {studio.name}
        </span>
      ) : (
        <span className="sr-only">{studio.name}</span>
      )}
    </Link>
  );
}
