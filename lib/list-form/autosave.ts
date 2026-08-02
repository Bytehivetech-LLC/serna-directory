export const DRAFT_KEY = "serna:list-a-program:draft";

export type DraftSnapshot = {
  categorySlug: string | null;
  values: Record<string, string | undefined>;
  tagSlugs: string[];
  packageSlug: string;
  address: {
    address_line: string;
    city: string;
    state: string;
    postal_code: string;
  };
};

/** Load an autosaved draft from localStorage (text fields only, never photos). */
export function loadDraft(): DraftSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as DraftSnapshot) : null;
  } catch {
    return null;
  }
}

export function saveDraft(snapshot: DraftSnapshot): void {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(snapshot));
  } catch {
    /* quota / private mode — non-fatal */
  }
}

export function clearDraft(): void {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* non-fatal */
  }
}
