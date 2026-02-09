import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { getSessionFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStudioContent, updateStudioContent } from "@/lib/studio-content";
import type { StudioContent } from "@/content/studio";

export const runtime = "nodejs";

const getBaseUrl = (request: NextRequest) => {
  const parsed = new URL(request.url);
  const host = request.headers.get("host") || parsed.host;
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const isLocal = host.includes("localhost") || host.startsWith("127.0.0.1");
  const protocol = isLocal
    ? "http"
    : forwardedProto || parsed.protocol.replace(":", "");
  return `${protocol}://${host}`;
};

const toText = (value: FormDataEntryValue | null) =>
  String(value ?? "").trim();

const parseList = (value: FormDataEntryValue | null, fallback: string[]) => {
  const lines = String(value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length ? lines : fallback;
};

const getFile = (value: FormDataEntryValue | null) => {
  if (!value || typeof value === "string") return null;
  return value.size > 0 ? value : null;
};

const saveUpload = async (file: File) => {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "");
  const filename = `${Date.now()}-${safeName || "upload"}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), buffer);
  return `/uploads/${filename}`;
};

export async function POST(request: NextRequest) {
  const wantsJson = request.headers
    .get("accept")
    ?.toLowerCase()
    .includes("application/json");

  const session = await getSessionFromCookies();
  if (!session) {
    if (wantsJson) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL("/login", getBaseUrl(request)));
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  });

  if (!user || user.role !== "admin") {
    if (wantsJson) {
      return NextResponse.json(
        { ok: false, error: "forbidden" },
        { status: 403 }
      );
    }
    return NextResponse.redirect(new URL("/admin", getBaseUrl(request)));
  }

  const current = await getStudioContent();
  const formData = await request.formData();

  const nextContent: StudioContent = JSON.parse(
    JSON.stringify(current)
  ) as StudioContent;

  nextContent.name = toText(formData.get("name")) || current.name;
  nextContent.siteUrl = toText(formData.get("siteUrl")) || current.siteUrl;
  nextContent.logo.src = toText(formData.get("logoSrc")) || current.logo.src;
  nextContent.logo.wordmarkSrc =
    toText(formData.get("wordmarkSrc")) || current.logo.wordmarkSrc;
  nextContent.logo.alt = toText(formData.get("logoAlt")) || current.logo.alt;
  nextContent.seo.title = toText(formData.get("seoTitle")) || current.seo.title;
  nextContent.seo.description =
    toText(formData.get("seoDescription")) || current.seo.description;
  nextContent.seo.ogImage =
    toText(formData.get("seoOgImage")) || current.seo.ogImage;
  nextContent.hero.title =
    toText(formData.get("heroTitle")) || current.hero.title;
  nextContent.hero.subtitle =
    toText(formData.get("heroSubtitle")) || current.hero.subtitle;
  nextContent.ctas.primary =
    toText(formData.get("ctaPrimary")) || current.ctas.primary;
  nextContent.ctas.secondary =
    toText(formData.get("ctaSecondary")) || current.ctas.secondary;
  nextContent.contact.whatsapp.phone =
    toText(formData.get("whatsappPhone")) || current.contact.whatsapp.phone;
  nextContent.contact.whatsapp.message =
    toText(formData.get("whatsappMessage")) ||
    current.contact.whatsapp.message;
  nextContent.contact.instagram =
    toText(formData.get("contactInstagram")) || current.contact.instagram;
  nextContent.contact.email =
    toText(formData.get("contactEmail")) || current.contact.email;
  nextContent.contact.locationText =
    toText(formData.get("locationText")) || current.contact.locationText;
  nextContent.contact.locationUrl =
    toText(formData.get("locationUrl")) || current.contact.locationUrl;
  nextContent.contact.hours =
    toText(formData.get("hours")) || current.contact.hours;
  nextContent.contact.title =
    toText(formData.get("contactTitle")) || current.contact.title;
  nextContent.contact.note =
    toText(formData.get("contactNote")) || current.contact.note;
  nextContent.footer.text =
    toText(formData.get("footerText")) || current.footer.text;

  nextContent.included.title =
    toText(formData.get("includedTitle")) || current.included.title;
  nextContent.included.subtitle =
    toText(formData.get("includedSubtitle")) || current.included.subtitle;
  nextContent.extras.title =
    toText(formData.get("extrasTitle")) || current.extras.title;
  nextContent.extras.subtitle =
    toText(formData.get("extrasSubtitle")) || current.extras.subtitle;
  nextContent.howToBook.title =
    toText(formData.get("howToBookTitle")) || current.howToBook.title;

  nextContent.included.items = parseList(
    formData.get("includedItems"),
    current.included.items
  );
  nextContent.extras.items = parseList(
    formData.get("extrasItems"),
    current.extras.items
  );
  nextContent.howToBook.steps = parseList(
    formData.get("howToBookSteps"),
    current.howToBook.steps
  );

  const heroAlt = toText(formData.get("heroImageAlt"));
  if (heroAlt) {
    nextContent.hero.image.alt = heroAlt;
  }

  const logoFile = getFile(formData.get("logoImage"));
  if (logoFile) {
    nextContent.logo.src = await saveUpload(logoFile);
  }

  const wordmarkFile = getFile(formData.get("wordmarkImage"));
  if (wordmarkFile) {
    nextContent.logo.wordmarkSrc = await saveUpload(wordmarkFile);
  }

  const heroFile = getFile(formData.get("heroImage"));
  if (heroFile) {
    nextContent.hero.image.src = await saveUpload(heroFile);
  }

  const galleryOrderRaw = formData.get("galleryOrder");
  if (galleryOrderRaw !== null) {
    try {
      const galleryOrder = JSON.parse(String(galleryOrderRaw)) as {
        id: string;
        src?: string;
        alt?: string;
      }[];
      const updatedGallery = [];
      for (const item of galleryOrder.slice(0, 10)) {
        const file = getFile(formData.get(`galleryFile_${item.id}`));
        let src = item.src || "";
        if (file) {
          src = await saveUpload(file);
        }
        if (!src) continue;
        updatedGallery.push({
          src,
          alt: item.alt || "",
        });
      }
      nextContent.gallery = updatedGallery;
    } catch {
      // ignore invalid gallery payload
    }
  }

  await updateStudioContent(nextContent);

  if (wantsJson) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.redirect(new URL("/admin/content", getBaseUrl(request)));
}
