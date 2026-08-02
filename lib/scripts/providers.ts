/** Guided analytics providers: paste an ID, we generate the official snippet
 * server-side. Client-safe (no secrets). */
export type GuidedProvider = {
  kind: string;
  label: string;
  placeholder: string;
  /** ID validation. */
  pattern: RegExp;
  /** External hosts the snippet contacts (for the CSP allowlist). */
  hosts: string[];
  consentGroup: "analytics" | "marketing";
  placement: "head" | "body_start" | "body_end";
};

export const GUIDED_PROVIDERS: GuidedProvider[] = [
  { kind: "ga4", label: "Google Analytics 4", placeholder: "G-XXXXXXXXXX", pattern: /^G-[A-Z0-9]{6,12}$/, hosts: ["https://www.googletagmanager.com", "https://www.google-analytics.com"], consentGroup: "analytics", placement: "head" },
  { kind: "gtm", label: "Google Tag Manager", placeholder: "GTM-XXXXXXX", pattern: /^GTM-[A-Z0-9]{6,9}$/, hosts: ["https://www.googletagmanager.com"], consentGroup: "analytics", placement: "head" },
  { kind: "meta_pixel", label: "Meta Pixel", placeholder: "123456789012345", pattern: /^\d{8,20}$/, hosts: ["https://connect.facebook.net", "https://www.facebook.com"], consentGroup: "marketing", placement: "head" },
  { kind: "clarity", label: "Microsoft Clarity", placeholder: "abcdefghij", pattern: /^[a-z0-9]{8,15}$/, hosts: ["https://www.clarity.ms"], consentGroup: "analytics", placement: "head" },
  { kind: "hotjar", label: "Hotjar", placeholder: "1234567", pattern: /^\d{6,9}$/, hosts: ["https://static.hotjar.com", "https://script.hotjar.com"], consentGroup: "analytics", placement: "head" },
  { kind: "linkedin", label: "LinkedIn Insight", placeholder: "1234567", pattern: /^\d{5,9}$/, hosts: ["https://snap.licdn.com", "https://px.ads.linkedin.com"], consentGroup: "marketing", placement: "body_end" },
  { kind: "tiktok", label: "TikTok Pixel", placeholder: "CXXXXXXXXXXXXXXXXXX", pattern: /^[A-Z0-9]{15,25}$/, hosts: ["https://analytics.tiktok.com"], consentGroup: "marketing", placement: "head" },
];

export function guidedProvider(kind: string): GuidedProvider | undefined {
  return GUIDED_PROVIDERS.find((p) => p.kind === kind);
}

/** Union of every guided provider's hosts — folded into the CSP so the guided
 * tags actually load once activated (custom-script hosts add on top). */
export const GUIDED_HOSTS = Array.from(new Set(GUIDED_PROVIDERS.flatMap((p) => p.hosts)));

/** Escape a validated ID for embedding in a script string (defence in depth —
 * the ID already passed a strict pattern). */
function safeId(id: string): string {
  return id.replace(/[^A-Za-z0-9_-]/g, "");
}

/** Build the official snippet for a guided provider + id. Server-generated only. */
export function guidedSnippet(kind: string, rawId: string): string | null {
  const id = safeId(rawId);
  switch (kind) {
    case "ga4":
      return `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');</script>`;
    case "gtm":
      return `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${id}');</script>`;
    case "meta_pixel":
      return `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${id}');fbq('track','PageView');</script>`;
    case "clarity":
      return `<script>(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","${id}");</script>`;
    case "hotjar":
      return `<script>(function(h,o,t,j,a,r){h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};h._hjSettings={hjid:${id},hjsv:6};a=o.getElementsByTagName('head')[0];r=o.createElement('script');r.async=1;r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;a.appendChild(r);})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');</script>`;
    case "linkedin":
      return `<script>_linkedin_partner_id="${id}";window._linkedin_data_partner_ids=window._linkedin_data_partner_ids||[];window._linkedin_data_partner_ids.push(_linkedin_partner_id);</script>\n<script async src="https://snap.licdn.com/li.lms-analytics/insight.min.js"></script>`;
    case "tiktok":
      return `<script>!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.load=function(e){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._t=ttq._t||{};ttq._t[e]=+new Date;var o=d.createElement("script");o.async=!0;o.src=i+"?sdkid="+e;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${id}');ttq.page();}(window,document,'ttq');</script>`;
    default:
      return null;
  }
}
