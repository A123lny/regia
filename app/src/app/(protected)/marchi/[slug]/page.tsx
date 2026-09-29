import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2, ChevronUp, ChevronDown, ImagePlus } from "lucide-react";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { hasCapability } from "@/lib/auth/permissions";
import { BrandChip } from "@/components/brand/brand-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getBrandBySlug,
  getBrandKitWithLists,
  formatBrandContextForAI,
  updateBrandKitTone,
  updateBrandKitContext,
  addBrandPillar,
  removeBrandPillar,
  moveBrandPillar,
  addBrandForbiddenWord,
  removeBrandForbiddenWord,
  addBrandSensitiveTopic,
  removeBrandSensitiveTopic,
} from "@/modules/m02-brand/public";
import { HelpButton } from "@/components/help/help-button";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function BrandKitPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSessionOrRedirect();
  if (!hasCapability(session.role, "brand.kit.edit")) notFound();

  const { slug } = await params;

  const brand = await getBrandBySlug(session.organizationId, slug);
  if (!brand) notFound();

  const brandId = brand.id;
  const displayName = brand.displayName;
  const brandSlug = brand.slug;
  const brandColor = brand.color;

  const bundle = await getBrandKitWithLists(brandId);
  const aiContext = await formatBrandContextForAI(brandId);

  const kit = bundle?.kit;
  const pillars = bundle?.pillars ?? [];
  const forbiddenWords = bundle?.forbiddenWords ?? [];
  const sensitiveTopics = bundle?.sensitiveTopics ?? [];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link
          href="/marchi"
          className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Torna ai marchi
        </Link>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BrandChip slug={brandSlug} name={displayName} color={brandColor} />
            <h1 className="font-serif text-3xl font-semibold text-text">{displayName}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/marchi/${brandSlug}/media`}>
              <Button variant="outline">
                <ImagePlus className="mr-2 h-4 w-4" /> Libreria media
              </Button>
            </Link>
            <HelpButton pageKey="brand-kit" />
          </div>
        </div>
        {kit && (
          <p className="text-xs text-text-muted">
            Ultima modifica brand kit: {formatDate(kit.updatedAt)}
          </p>
        )}
      </header>

      {/* Card 1: Tono di voce */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Tono di voce</CardTitle>
          <CardDescription>
            Come parla il marchio. RF-2.3: contesto obbligatorio in ogni generazione AI.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={async (formData: FormData) => {
              "use server";
              const toneOfVoice = String(formData.get("toneOfVoice") ?? "");
              await updateBrandKitTone(brandId, toneOfVoice);
            }}
          >
            <Textarea
              name="toneOfVoice"
              defaultValue={kit?.toneOfVoice ?? ""}
              rows={8}
              maxLength={5000}
              className="w-full"
            />
            <div className="mt-3 flex justify-end">
              <Button type="submit" className="bg-primary text-white hover:bg-primary-hover">
                Salva tono
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Card 2: Contesto strategico */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Contesto strategico</CardTitle>
          <CardDescription>
            RF-2.3a: scopo del marchio, obiettivo dell&apos;anno, direzione futura.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={async (formData: FormData) => {
              "use server";
              const purpose = String(formData.get("purpose") ?? "");
              const yearGoal = String(formData.get("yearGoal") ?? "");
              const direction = String(formData.get("direction") ?? "");
              await updateBrandKitContext(brandId, { purpose, yearGoal, direction });
            }}
          >
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="purpose">Scopo e pubblico</Label>
                <Textarea
                  id="purpose"
                  name="purpose"
                  defaultValue={kit?.strategicPurpose ?? ""}
                  rows={4}
                  maxLength={3000}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="yearGoal">Obiettivo dell&apos;anno in corso</Label>
                <Textarea
                  id="yearGoal"
                  name="yearGoal"
                  defaultValue={kit?.strategicYearGoal ?? ""}
                  rows={3}
                  maxLength={3000}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="direction">Direzione futura</Label>
                <Textarea
                  id="direction"
                  name="direction"
                  defaultValue={kit?.strategicDirection ?? ""}
                  rows={3}
                  maxLength={3000}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button type="submit" className="bg-primary text-white hover:bg-primary-hover">
                Salva contesto strategico
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Card 3: Rubriche */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Rubriche e pilastri</CardTitle>
          <CardDescription>
            RF-2.4: temi ricorrenti con peso di frequenza (1-10). Riordinabili con le frecce.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pillars.length === 0 ? (
            <p className="text-sm text-text-muted">Nessuna rubrica configurata.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="w-20">Peso</TableHead>
                  <TableHead className="w-32">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pillars.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.weight}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <form
                          action={async () => {
                            "use server";
                            await moveBrandPillar(brandId, p.id, "up");
                          }}
                        >
                          <Button type="submit" variant="ghost" size="icon" aria-label="Sposta su">
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                        </form>
                        <form
                          action={async () => {
                            "use server";
                            await moveBrandPillar(brandId, p.id, "down");
                          }}
                        >
                          <Button type="submit" variant="ghost" size="icon" aria-label="Sposta giù">
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </form>
                        <form
                          action={async () => {
                            "use server";
                            await removeBrandPillar(brandId, p.id);
                          }}
                        >
                          <Button
                            type="submit"
                            variant="ghost"
                            size="icon"
                            aria-label="Rimuovi"
                            className="text-danger hover:bg-danger/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <form
            action={async (formData: FormData) => {
              "use server";
              const name = String(formData.get("name") ?? "");
              const weight = Number(formData.get("weight") ?? 1);
              await addBrandPillar(brandId, { name, weight });
            }}
            className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <Label htmlFor="new-pillar-name">Nuova rubrica</Label>
              <Input
                id="new-pillar-name"
                name="name"
                required
                maxLength={100}
                placeholder="es. Servizio quotidiano"
              />
            </div>
            <div className="w-24">
              <Label htmlFor="new-pillar-weight">Peso</Label>
              <Input
                id="new-pillar-weight"
                name="weight"
                type="number"
                min={1}
                max={10}
                defaultValue={1}
                required
              />
            </div>
            <Button type="submit" className="bg-primary text-white hover:bg-primary-hover">
              Aggiungi
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Card 4: Parole bandite */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Parole bandite</CardTitle>
          <CardDescription>
            RF-2.5: mai usare in generazione. Unique case-insensitive per marchio.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {forbiddenWords.length === 0 ? (
            <p className="text-sm text-text-muted">Nessuna parola bandita.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {forbiddenWords.map((w) => (
                <form
                  key={w.id}
                  action={async () => {
                    "use server";
                    await removeBrandForbiddenWord(brandId, w.id);
                  }}
                  className="inline-flex"
                >
                  <button
                    type="submit"
                    aria-label={`Rimuovi ${w.word}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-muted px-2.5 py-1 text-xs font-medium text-text hover:border-danger hover:bg-danger/10 hover:text-danger"
                  >
                    {w.word}
                    <Trash2 className="h-3 w-3" />
                  </button>
                </form>
              ))}
            </div>
          )}
          <form
            action={async (formData: FormData) => {
              "use server";
              const word = String(formData.get("word") ?? "").trim();
              if (!word) return;
              await addBrandForbiddenWord(brandId, word);
            }}
            className="flex gap-2 border-t border-border pt-4"
          >
            <Input
              name="word"
              placeholder="Aggiungi parola"
              maxLength={100}
              required
              className="flex-1"
            />
            <Button type="submit" className="bg-primary text-white hover:bg-primary-hover">
              Aggiungi
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Card 5: Argomenti sensibili */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Argomenti sensibili</CardTitle>
          <CardDescription>
            RF-2.5: claim vietati (mai) o argomenti che richiedono revisione umana.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sensitiveTopics.length === 0 ? (
            <p className="text-sm text-text-muted">Nessun argomento sensibile.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Argomento</TableHead>
                  <TableHead className="w-40">Tipo</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sensitiveTopics.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{t.topic}</TableCell>
                    <TableCell>
                      {t.kind === "claim_vietato" ? (
                        <Badge className="border border-danger/30 bg-danger/15 text-danger">
                          Claim vietato
                        </Badge>
                      ) : (
                        <Badge className="border border-warning/30 bg-warning/15 text-warning">
                          Revisione umana
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-text-muted">{t.note || "—"}</TableCell>
                    <TableCell>
                      <form
                        action={async () => {
                          "use server";
                          await removeBrandSensitiveTopic(brandId, t.id);
                        }}
                      >
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon"
                          aria-label="Rimuovi"
                          className="text-danger hover:bg-danger/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <form
            action={async (formData: FormData) => {
              "use server";
              const topic = String(formData.get("topic") ?? "");
              const kind = String(formData.get("kind") ?? "revisione_umana") as
                "claim_vietato" | "revisione_umana";
              const note = String(formData.get("note") ?? "");
              await addBrandSensitiveTopic(brandId, { topic, kind, note });
            }}
            className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <Label htmlFor="new-topic">Nuovo argomento</Label>
              <Input
                id="new-topic"
                name="topic"
                required
                maxLength={200}
                placeholder="es. Sconti carburante"
              />
            </div>
            <div className="w-40">
              <Label htmlFor="new-topic-kind">Tipo</Label>
              <Select name="kind" defaultValue="revisione_umana">
                <SelectTrigger id="new-topic-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="revisione_umana">Revisione umana</SelectItem>
                  <SelectItem value="claim_vietato">Claim vietato</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label htmlFor="new-topic-note">Nota (opzionale)</Label>
              <Input
                id="new-topic-note"
                name="note"
                maxLength={500}
                placeholder="Motivo o riferimento"
              />
            </div>
            <Button type="submit" className="bg-primary text-white hover:bg-primary-hover">
              Aggiungi
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Card 6: Anteprima contesto AI */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Anteprima contesto per AI</CardTitle>
          <CardDescription>
            Come l&apos;AI di M3 leggerà il brand kit di questo marchio quando genererà contenuti
            (RF-2.3, RF-2.3a). Aggiornato in tempo reale.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="max-h-96 overflow-auto rounded-md border border-border bg-surface-muted p-4 text-xs whitespace-pre-wrap">
            {aiContext || "_Nessun brand kit configurato._"}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
