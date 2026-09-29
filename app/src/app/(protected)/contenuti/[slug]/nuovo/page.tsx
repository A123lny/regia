import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { hasCapability } from "@/lib/auth/permissions";
import { getAdminClient } from "@/lib/db/admin";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateSocialPost } from "@/modules/m03-editorial/public";

export default async function NewContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSessionOrRedirect();
  if (!hasCapability(session.role, "content.generate")) notFound();

  const { slug } = await params;
  const { error: errorParam } = await searchParams;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data: brandRow } = await admin
    .from("brands")
    .select("id, slug, display_name")
    .eq("slug", slug)
    .eq("organization_id", session.organizationId)
    .maybeSingle();
  if (!brandRow) notFound();

  const brandId = brandRow.id as string;
  const brandSlug = brandRow.slug as string;
  const displayName = brandRow.display_name as string;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <Link
          href={`/contenuti/${brandSlug}`}
          className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Contenuti {displayName}
        </Link>
        <h1 className="font-serif text-3xl font-semibold text-text">Nuovo contenuto</h1>
        <p className="text-sm text-text-muted">
          Descrivi cosa vuoi comunicare. L&apos;AI userà il brand kit del marchio come contesto
          (tono, contesto strategico, rubriche, parole bandite). Riceverai un post pronto da
          approvare o rifiutare (RF-3.3).
        </p>
      </header>

      {errorParam && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          {decodeURIComponent(errorParam)}
        </div>
      )}

      <form
        action={async (formData: FormData) => {
          "use server";
          const result = await generateSocialPost(brandId, formData);
          if (result.ok) {
            redirect(`/contenuti/${brandSlug}/${result.draftId}`);
          } else {
            redirect(`/contenuti/${brandSlug}/nuovo?error=${encodeURIComponent(result.error)}`);
          }
        }}
        className="space-y-4 rounded-lg border border-border bg-surface p-6"
      >
        <div className="space-y-1.5">
          <Label htmlFor="channel">Canale</Label>
          <Select name="channel" defaultValue="social" disabled>
            <SelectTrigger id="channel">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="social">Post social (Facebook / Instagram)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-text-muted">
            F1.5a supporta solo il canale social. Email, WhatsApp e altri arriveranno in F1.5b+.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="themeInput">Cosa vuoi comunicare?</Label>
          <Textarea
            id="themeInput"
            name="themeInput"
            required
            maxLength={2000}
            rows={6}
            placeholder="Es. Annunciare che apriamo la sera dal 20 ottobre, giovedì e venerdì fino alle 22"
          />
          <p className="text-xs text-text-muted">
            Max 2000 caratteri. Sii specifico: date, orari, motivi. Il sistema non inventerà dati
            concreti mancanti (RN-72).
          </p>
        </div>

        <div className="flex justify-end">
          <Button type="submit" className="bg-primary text-white hover:bg-primary-hover">
            Genera post
          </Button>
        </div>
      </form>
    </div>
  );
}
