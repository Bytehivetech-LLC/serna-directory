"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoriesTab } from "./categories-tab";
import { TagGroupsTab } from "./tag-groups-tab";
import { TagsTab } from "./tags-tab";
import type {
  CategoryWithCount,
  TagGroupWithMeta,
  TagWithCount,
} from "@/lib/admin/taxonomy-queries";

export function TaxonomyTabs({
  categories,
  groups,
  tagsByGroup,
  categoryLookups,
}: {
  categories: CategoryWithCount[];
  groups: TagGroupWithMeta[];
  tagsByGroup: Record<string, TagWithCount[]>;
  categoryLookups: { id: string; name: string }[];
}) {
  return (
    <Tabs defaultValue="categories" className="w-full">
      <TabsList>
        <TabsTrigger value="categories">Categories</TabsTrigger>
        <TabsTrigger value="groups">Tag groups</TabsTrigger>
        <TabsTrigger value="tags">Tags</TabsTrigger>
      </TabsList>

      <TabsContent value="categories" className="mt-6">
        <CategoriesTab categories={categories} categoryLookups={categoryLookups} />
      </TabsContent>
      <TabsContent value="groups" className="mt-6">
        <TagGroupsTab groups={groups} categoryLookups={categoryLookups} />
      </TabsContent>
      <TabsContent value="tags" className="mt-6">
        <TagsTab groups={groups} tagsByGroup={tagsByGroup} />
      </TabsContent>
    </Tabs>
  );
}
