import { redirect } from "next/navigation";

type PagoBridgePageProps = {
  params: Promise<{ id: string }>;
};

export default async function PagoBridgePage({ params }: PagoBridgePageProps) {
  const { id } = await params;
  redirect(`/checkout?bookingId=${id}`);
}
