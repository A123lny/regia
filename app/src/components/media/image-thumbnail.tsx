import Image from "next/image";
import { getAdminClient } from "@/lib/db/admin";

type Props = {
  imagePath: string | null;
  size?: number;
  alt?: string;
};

export async function ImageThumbnail({ imagePath, size = 40, alt = "Anteprima" }: Props) {
  if (!imagePath) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data } = await admin.storage.from("content-media").createSignedUrl(imagePath, 3600);
  const signedUrl = (data as { signedUrl: string } | null)?.signedUrl;
  if (!signedUrl) return null;

  return (
    <div
      className="relative overflow-hidden rounded border border-border"
      style={{ width: size, height: size }}
    >
      <Image src={signedUrl} alt={alt} fill className="object-cover" sizes={`${size}px`} />
    </div>
  );
}
