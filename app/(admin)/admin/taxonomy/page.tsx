import type { Metadata } from "next";
import {
  getCategoriesWithCounts,
  getTagGroups,
  getTagsByGroup,
  getCategoryLookups,
  type TagWithCount,
} from "@/lib/admin/taxonomy-queries";
import { PageHeading } from "@/components/layout/page-heading";
import { TaxonomyTabs } from "@/components/admin/taxonomy/taxonomy-tabs";

export const metadata: Metadata = { title: "Categories & Tags" };

export default async function TaxonomyPage() {
  const [categories, groups, tagsByGroupMap, categoryLookups] = await Promise.all([
    getCategoriesWithCounts(),
    getTagGroups(),
    getTagsByGroup(),
    getCategoryLookups(),
  ]);

  const tagsByGroup: Record<string, TagWithCount[]> = {};
  for (const [groupId, tags] of tagsByGroupMap) tagsByGroup[groupId] = tags;

  return (
    <div className="space-y-6">
      <PageHeading
        title="Categories & Tags"
        lede="The building blocks of the filters and the listing form. Changes go live with no deploy."
      />
      <TaxonomyTabs
        categories={categories}
        groups={groups}
        tagsByGroup={tagsByGroup}
        categoryLookups={categoryLookups}
      />
    </div>
  );
}
