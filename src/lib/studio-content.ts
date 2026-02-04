import { prisma } from "@/lib/prisma";
import { studio } from "@/content/studio";
import type { StudioContent } from "@/content/studio";

const DEFAULT_ID = "main";

const serializeContent = (data: StudioContent) => {
  return JSON.stringify(data);
};

const parseContent = (data: string): StudioContent => {
  try {
    return JSON.parse(data) as StudioContent;
  } catch {
    return studio;
  }
};

export const getStudioContent = async (): Promise<StudioContent> => {
  const record = await prisma.siteContent.upsert({
    where: { id: DEFAULT_ID },
    create: {
      id: DEFAULT_ID,
      data: serializeContent(studio),
    },
    update: {},
  });

  return parseContent(record.data);
};

export const updateStudioContent = async (
  nextContent: StudioContent
): Promise<StudioContent> => {
  const updated = await prisma.siteContent.upsert({
    where: { id: DEFAULT_ID },
    create: {
      id: DEFAULT_ID,
      data: serializeContent(nextContent),
    },
    update: {
      data: serializeContent(nextContent),
    },
  });

  return parseContent(updated.data);
};
