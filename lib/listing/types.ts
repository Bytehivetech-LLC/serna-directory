import type { EsaAnswer, ListingStatus } from "@/types";

export type ListingImage = {
  id: string;
  url: string;
  thumbUrl: string;
  alt: string;
  isCover: boolean;
};

export type ListingTagGroup = {
  id: string;
  name: string;
  slug: string;
  categoryId: string | null;
  showOnListing: boolean;
  sortOrder: number;
  tags: { id: string; name: string; slug: string }[];
};

export type SocialLinks = {
  facebook?: string;
  instagram?: string;
  linkedin?: string;
  youtube?: string;
  tiktok?: string;
};

export type ListingDetail = {
  id: string;
  slug: string;
  status: ListingStatus;
  businessName: string;
  categoryId: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  agesLabel: string;
  rateLabel: string;
  city: string | null;
  state: string | null;
  address: string | null;
  alsoServes: string[];
  description: string | null;
  descriptionHtml: string | null;
  website: string | null;
  contactPhone: string | null;
  showPhone: boolean;
  /** Server-only: the inquiry recipient. Never pass to Client Components. */
  contactEmail: string | null;
  social: SocialLinks;
  agesServed: string | null;
  rateText: string | null;
  acceptsEsa: EsaAnswer | null;
  isFeatured: boolean;
  lat: number | null;
  lng: number | null;
  ownerId: string;
  images: ListingImage[];
  /** Category-scoped group ("Subjects / offerings"), shown in the main column. */
  subjectGroup: ListingTagGroup | null;
  /** Other show_on_listing groups, shown in the sidebar. */
  otherGroups: ListingTagGroup[];
};
