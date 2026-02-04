import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { getSessionFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStudioContent, updateStudioContent } from "@/lib/studio-content";
import type { StudioContent } from "@/content/studio";

export const runtime = "nodejs";

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
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  });

  if (!user || user.role !== "admin") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  const current = await getStudioContent();
  const formData = await request.formData();

  const nextContent: StudioContent = JSON.parse(
    JSON.stringify(current)
  ) as StudioContent;

  nextContent.name = toText(formData.get("name")) || current.name;
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

  const heroFile = getFile(formData.get("heroImage"));
  if (heroFile) {
    nextContent.hero.image.src = await saveUpload(heroFile);
  }

  const updatedGallery = [];
  for (let i = 0; i < current.gallery.length; i += 1) {
    const item = current.gallery[i];
    const file = getFile(formData.get(`galleryImage${i}`));
    const alt = toText(formData.get(`galleryAlt${i}`)) || item.alt;
    let src = item.src;
    if (file) {
      src = await saveUpload(file);
    }
    updatedGallery.push({ src, alt });
  }
  if (updatedGallery.length) {
    nextContent.gallery = updatedGallery;
  }

  await updateStudioContent(nextContent);

  return NextResponse.redirect(new URL("/admin/content", request.url));
}
