"use client";

import { toast } from "sonner";
import { Bell, ChevronDown, Search, Star, User } from "lucide-react";
import { Swatch, type SwatchProps } from "./swatch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { SectionCard } from "@/components/layout/section-card";
import { EmptyState } from "@/components/layout/empty-state";

/* Literal classes only — Tailwind's scanner needs to see each one. */
const BRAND_SWATCHES: SwatchProps[] = [
  { label: "ink", cssVar: "--c-ink", full: "bg-ink text-white", forty: "bg-ink/40 text-white", ten: "bg-ink/10 text-ink" },
  { label: "muted", cssVar: "--c-muted", full: "bg-muted-foreground text-white", forty: "bg-muted-foreground/40 text-ink", ten: "bg-muted-foreground/10 text-ink" },
  { label: "faint", cssVar: "--c-faint", full: "bg-faint text-white", forty: "bg-faint/40 text-ink", ten: "bg-faint/10 text-ink" },
  { label: "indigo", cssVar: "--c-indigo", full: "bg-indigo text-white", forty: "bg-indigo/40 text-white", ten: "bg-indigo/10 text-ink" },
  { label: "indigo-deep", cssVar: "--c-indigo-deep", full: "bg-indigo-deep text-white", forty: "bg-indigo-deep/40 text-white", ten: "bg-indigo-deep/10 text-ink" },
  { label: "violet", cssVar: "--c-violet", full: "bg-violet text-white", forty: "bg-violet/40 text-white", ten: "bg-violet/10 text-ink" },
  { label: "violet-soft", cssVar: "--c-violet-soft", full: "bg-violet-soft text-ink", forty: "bg-violet-soft/40 text-ink", ten: "bg-violet-soft/10 text-ink" },
  { label: "bg", cssVar: "--c-bg", full: "bg-bg text-ink", forty: "bg-bg/40 text-ink", ten: "bg-bg/10 text-ink" },
  { label: "card", cssVar: "--c-card", full: "bg-card text-ink", forty: "bg-card/40 text-ink", ten: "bg-card/10 text-ink" },
  { label: "border", cssVar: "--c-border", full: "bg-border text-ink", forty: "bg-border/40 text-ink", ten: "bg-border/10 text-ink" },
  { label: "border-strong", cssVar: "--c-border-strong", full: "bg-border-strong text-ink", forty: "bg-border-strong/40 text-ink", ten: "bg-border-strong/10 text-ink" },
  { label: "good", cssVar: "--c-good", full: "bg-good text-white", forty: "bg-good/40 text-white", ten: "bg-good/10 text-ink" },
  { label: "good-soft", cssVar: "--c-good-soft", full: "bg-good-soft text-ink", forty: "bg-good-soft/40 text-ink", ten: "bg-good-soft/10 text-ink" },
  { label: "warm", cssVar: "--c-warm", full: "bg-warm text-ink", forty: "bg-warm/40 text-ink", ten: "bg-warm/10 text-ink" },
  { label: "warm-border", cssVar: "--c-warm-border", full: "bg-warm-border text-ink", forty: "bg-warm-border/40 text-ink", ten: "bg-warm-border/10 text-ink" },
  { label: "danger", cssVar: "--c-danger", full: "bg-danger text-white", forty: "bg-danger/40 text-white", ten: "bg-danger/10 text-ink" },
  { label: "danger-soft", cssVar: "--c-danger-soft", full: "bg-danger-soft text-ink", forty: "bg-danger-soft/40 text-ink", ten: "bg-danger-soft/10 text-ink" },
  { label: "header-bg", cssVar: "--c-header-bg", full: "bg-header-bg text-white", forty: "bg-header-bg/40 text-white", ten: "bg-header-bg/10 text-ink" },
  { label: "header-text", cssVar: "--c-header-text", full: "bg-header-text text-ink", forty: "bg-header-text/40 text-ink", ten: "bg-header-text/10 text-ink" },
];

const SEMANTIC_SWATCHES: SwatchProps[] = [
  { label: "primary", cssVar: "--primary", full: "bg-primary text-primary-foreground", forty: "bg-primary/40 text-white", ten: "bg-primary/10 text-ink" },
  { label: "secondary", cssVar: "--secondary", full: "bg-secondary text-secondary-foreground", forty: "bg-secondary/40 text-ink", ten: "bg-secondary/10 text-ink" },
  { label: "accent", cssVar: "--accent", full: "bg-accent text-accent-foreground", forty: "bg-accent/40 text-ink", ten: "bg-accent/10 text-ink" },
  { label: "destructive", cssVar: "--destructive", full: "bg-destructive text-white", forty: "bg-destructive/40 text-white", ten: "bg-destructive/10 text-ink" },
  { label: "ring", cssVar: "--ring", full: "bg-ring text-white", forty: "bg-ring/40 text-white", ten: "bg-ring/10 text-ink" },
];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="scroll-mt-6">
      <h2 className="mb-4 font-display text-xl font-bold text-ink">{title}</h2>
      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        {children}
      </div>
    </section>
  );
}

export function StyleguideContent() {
  return (
    <div className="space-y-12">
      {/* COLOURS */}
      <Section title="Colour — brand tokens">
        <p className="mb-4 text-sm text-muted-foreground">
          Each slot at 100% / 40% / 10% opacity. If a column looks wrong, a
          theme channel is broken.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {BRAND_SWATCHES.map((s) => (
            <Swatch key={s.label} {...s} />
          ))}
        </div>
      </Section>

      <Section title="Colour — shadcn semantic layer">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {SEMANTIC_SWATCHES.map((s) => (
            <Swatch key={s.label} {...s} />
          ))}
        </div>
      </Section>

      {/* OPACITY VERIFICATION */}
      <Section title="Opacity modifiers (verification)">
        <div className="flex flex-wrap items-center gap-6">
          <div className="rounded-xl border-2 border-indigo/20 bg-violet/10 p-6 text-sm font-semibold text-indigo ring-4 ring-violet/40">
            bg-violet/10 · border-indigo/20 · ring-violet/40
          </div>
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>These three classes come straight from the spec.</p>
            <p>
              Correct = pale violet fill, faint indigo border, soft violet halo.
            </p>
          </div>
        </div>
      </Section>

      {/* TYPOGRAPHY */}
      <Section title="Typography">
        <div className="space-y-4">
          <div>
            <p className="mb-1 font-mono text-xs text-muted-foreground">
              font-display (Bricolage Grotesque)
            </p>
            <h1 className="font-display text-4xl font-extrabold tracking-[-0.015em] text-ink">
              Find the right program
            </h1>
          </div>
          <Separator />
          <div>
            <p className="mb-1 font-mono text-xs text-muted-foreground">
              font-body (Inter)
            </p>
            <p className="max-w-prose text-base text-ink">
              Body copy uses Inter. <b className="text-ink">Bold</b> for
              emphasis, <span className="text-muted-foreground">muted</span> for
              secondary text, and{" "}
              <span className="text-faint">faint</span> for the quietest hints.
            </p>
          </div>
        </div>
      </Section>

      {/* BUTTONS */}
      <Section title="Buttons">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Publish listing</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Delete</Button>
            <Button variant="link">Link</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="default">Default</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" aria-label="Notifications">
              <Bell className="h-4 w-4" />
            </Button>
            <Button disabled>Disabled</Button>
          </div>
        </div>
      </Section>

      {/* FORM CONTROLS */}
      <Section title="Form controls">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sg-name">Business name</Label>
            <Input id="sg-name" placeholder="Serna Learning Co-op" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sg-cat">Category</Label>
            <Select>
              <SelectTrigger id="sg-cat">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tutor">Tutor</SelectItem>
                <SelectItem value="coop">Co-op / Learning Pod</SelectItem>
                <SelectItem value="micro">Micro school</SelectItem>
                <SelectItem value="music">Music &amp; arts</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="sg-desc">Describe your business</Label>
            <Textarea
              id="sg-desc"
              placeholder="Tell your story: mission, a typical session, who it's for…"
            />
          </div>
          <div className="flex items-center gap-3">
            <Checkbox id="sg-esa" defaultChecked />
            <Label htmlFor="sg-esa" className="font-normal">
              Accepts Arizona ESA funds
            </Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="sg-phone" defaultChecked />
            <Label htmlFor="sg-phone" className="font-normal">
              Show phone on public listing
            </Label>
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-2 block">Delivery format</Label>
            <RadioGroup defaultValue="in-person" className="flex flex-wrap gap-4">
              {[
                ["in-person", "In person"],
                ["online", "Online live"],
                ["hybrid", "Hybrid"],
              ].map(([v, l]) => (
                <div key={v} className="flex items-center gap-2">
                  <RadioGroupItem id={`sg-${v}`} value={v} />
                  <Label htmlFor={`sg-${v}`} className="font-normal">
                    {l}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </div>
      </Section>

      {/* BADGES + ALERTS */}
      <Section title="Badges &amp; alerts">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Featured</Badge>
            <Badge variant="secondary">Co-op</Badge>
            <Badge variant="outline">Pending review</Badge>
            <Badge variant="destructive">Rejected</Badge>
            <Badge className="bg-good text-white hover:bg-good">Live</Badge>
          </div>
          <Alert>
            <Star className="h-4 w-4" />
            <AlertTitle>Complete listings rank higher</AlertTitle>
            <AlertDescription>
              Add photos and a rich description to get more inquiries.
            </AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>
              We couldn&apos;t save your changes. Check your connection and try
              again.
            </AlertDescription>
          </Alert>
        </div>
      </Section>

      {/* CARDS */}
      <Section title="Cards">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Featured listing</CardTitle>
              <CardDescription>
                Top placement in every result families see.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="font-display text-2xl font-extrabold text-ink">
                $400{" "}
                <span className="font-body text-sm font-medium text-muted-foreground">
                  / year
                </span>
              </p>
            </CardContent>
            <CardFooter>
              <Button className="w-full">Choose Featured</Button>
            </CardFooter>
          </Card>
          <SectionCard
            title="SectionCard component"
            description="The brand content card used across pages."
          >
            <p className="text-sm text-muted-foreground">
              Border, xl radius, and the soft card shadow.
            </p>
          </SectionCard>
        </div>
      </Section>

      {/* TABS + TABLE */}
      <Section title="Tabs &amp; table">
        <Tabs defaultValue="listings">
          <TabsList>
            <TabsTrigger value="listings">Listings</TabsTrigger>
            <TabsTrigger value="inquiries">Inquiries</TabsTrigger>
          </TabsList>
          <TabsContent value="listings" className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Desert Bloom Tutoring</TableCell>
                  <TableCell>Tutor</TableCell>
                  <TableCell>
                    <Badge className="bg-good text-white hover:bg-good">Live</Badge>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Saguaro Co-op</TableCell>
                  <TableCell>Co-op</TableCell>
                  <TableCell>
                    <Badge variant="outline">Pending</Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TabsContent>
          <TabsContent value="inquiries" className="mt-4">
            <p className="text-sm text-muted-foreground">No inquiries yet.</p>
          </TabsContent>
        </Tabs>
      </Section>

      {/* OVERLAYS */}
      <Section title="Overlays — dialog, sheet, dropdown, popover">
        <div className="flex flex-wrap items-center gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Open dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete this listing?</DialogTitle>
                <DialogDescription>
                  This can&apos;t be undone. The listing and its photos will be
                  removed.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button variant="destructive">Delete</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">Open sheet</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
                <SheetDescription>
                  Narrow the directory by city, ages, and subjects.
                </SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                Menu <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Edit listing</DropdownMenuItem>
              <DropdownMenuItem>Duplicate</DropdownMenuItem>
              <DropdownMenuItem className="text-danger">
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">Open popover</Button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <p className="text-sm text-muted-foreground">
                Popovers use the card surface with the brand border and radius.
              </p>
            </PopoverContent>
          </Popover>

          <Button
            onClick={() =>
              toast.success("Listing published", {
                description: "Families can find you now.",
              })
            }
          >
            Fire a toast
          </Button>
        </div>
      </Section>

      {/* COMMAND */}
      <Section title="Command palette">
        <div className="max-w-md rounded-xl border border-border">
          <Command>
            <CommandInput placeholder="Search categories…" />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup heading="Categories">
                <CommandItem>
                  <Search className="mr-2 h-4 w-4" /> Tutor
                </CommandItem>
                <CommandItem>
                  <Search className="mr-2 h-4 w-4" /> Micro school
                </CommandItem>
                <CommandItem>
                  <Search className="mr-2 h-4 w-4" /> Music &amp; arts
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      </Section>

      {/* MISC */}
      <Section title="Avatar, skeleton, pagination, empty state">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar>
              <AvatarFallback>
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <Avatar>
              <AvatarFallback>SB</AvatarFallback>
            </Avatar>
          </div>

          <div className="space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>

          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious href="#" />
              </PaginationItem>
              <PaginationItem>
                <PaginationLink href="#">1</PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationLink href="#" isActive>
                  2
                </PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationLink href="#">3</PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext href="#" />
              </PaginationItem>
            </PaginationContent>
          </Pagination>

          <EmptyState
            icon={Search}
            title="No listings match your filters"
            description="Try widening your search — fewer subjects or a nearby city."
            action={<Button variant="outline">Clear filters</Button>}
          />
        </div>
      </Section>

      {/* SHAPE */}
      <Section title="Radius &amp; shadow">
        <div className="flex flex-wrap gap-6">
          <div className="grid h-24 w-40 place-items-center rounded-xl border border-border bg-card text-sm text-muted-foreground shadow-card">
            rounded-xl · shadow-card
          </div>
          <div className="grid h-24 w-40 place-items-center rounded-lg border border-border bg-card text-sm text-muted-foreground">
            rounded-lg
          </div>
          <div className="grid h-24 w-40 place-items-center rounded-md border border-border bg-card text-sm text-muted-foreground">
            rounded-md
          </div>
        </div>
      </Section>
    </div>
  );
}
