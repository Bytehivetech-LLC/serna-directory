export type FieldType =
  | "text"
  | "url"
  | "email"
  | "tel"
  | "textarea"
  | "radio"
  | "select"
  | "checkbox";

export type FieldOption = { label: string; value: string };

export type FormField = {
  id: string;
  sectionKey: string;
  key: string;
  label: string;
  helpText: string | null;
  placeholder: string | null;
  type: FieldType;
  options: FieldOption[];
  isRequired: boolean;
  isCore: boolean;
  columnName: string | null;
  maxLength: number | null;
  strengthPoints: number;
  sortOrder: number;
};

export type FormSection = {
  id: string;
  key: string;
  title: string;
  subtitle: string | null;
  sortOrder: number;
  fields: FormField[];
};

export type CategoryOption = {
  id: string;
  name: string;
  slug: string;
  agesLabel: string | null;
  rateLabel: string | null;
};

export type FormTag = { id: string; name: string; slug: string };
export type FormTagGroup = {
  id: string;
  name: string;
  slug: string;
  categoryId: string | null;
  sortOrder: number;
  tags: FormTag[];
};

export type FormPackage = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  priceCents: number;
  interval: string;
  maxImages: number;
  allowsFeatured: boolean;
  requiresApproval: boolean;
  features: string[];
  badgeLabel: string | null;
  isDefault: boolean;
  sortOrder: number;
};

export type FormAddon = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  priceCents: number;
  currency: string;
  interval: string;
  maxQuantity: number;
  packageIds: string[];
  badgeLabel: string | null;
  imageUrl: string | null;
};

export type ListFormConfig = {
  sections: FormSection[];
  categories: CategoryOption[];
  tagGroups: FormTagGroup[];
  packages: FormPackage[];
  addons: FormAddon[];
  /** Base strength points available from all fields (images added on top). */
  maxFieldPoints: number;
};
