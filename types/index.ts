import type { Database } from "./database";

/** Row / Insert / Update helpers over the generated Database type. */
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];

/* ---- Row aliases (the entities used across the app) ---- */
export type Profile = Tables<"profiles">;
export type Category = Tables<"categories">;
export type Listing = Tables<"listings">;
export type ListingImage = Tables<"listing_images">;
export type ListingTag = Tables<"listing_tags">;
export type Package = Tables<"packages">;
export type Addon = Tables<"addons">;
export type TagGroup = Tables<"tag_groups">;
export type Tag = Tables<"tags">;
export type Inquiry = Tables<"inquiries">;
export type Subscription = Tables<"subscriptions">;
export type Payment = Tables<"payments">;
export type SiteSetting = Tables<"site_settings">;
export type MenuItem = Tables<"menu_items">;
export type FormSection = Tables<"form_sections">;
export type FormField = Tables<"form_fields">;

/* ---- Enum aliases ---- */
export type UserRole = Enums<"user_role">;
export type ListingStatus = Enums<"listing_status">;
export type EsaAnswer = Enums<"esa_answer">;
export type BillingInterval = Enums<"billing_interval">;
export type SubscriptionStatus = Enums<"subscription_status">;

export type { Database, Json } from "./database";
