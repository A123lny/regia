// M02 Brand — tipi condivisi (RF-2.3, RF-2.3a, RF-2.4, RF-2.5).

export type SensitiveTopicKind = "claim_vietato" | "revisione_umana";

export type BrandKit = {
  brandId: string;
  toneOfVoice: string;
  strategicPurpose: string;
  strategicYearGoal: string;
  strategicDirection: string;
  updatedAt: string;
};

export type BrandPillar = {
  id: string;
  brandId: string;
  name: string;
  weight: number;
  sortOrder: number;
  createdAt: string;
};

export type BrandForbiddenWord = {
  id: string;
  brandId: string;
  word: string;
  createdAt: string;
};

export type BrandSensitiveTopic = {
  id: string;
  brandId: string;
  topic: string;
  kind: SensitiveTopicKind;
  note: string;
  createdAt: string;
};

export type BrandKitWithLists = {
  kit: BrandKit;
  pillars: BrandPillar[];
  forbiddenWords: BrandForbiddenWord[];
  sensitiveTopics: BrandSensitiveTopic[];
};
