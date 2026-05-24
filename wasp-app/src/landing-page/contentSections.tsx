import daBoiAvatar from "../client/static/da-boi.webp";
import kivo from "../client/static/examples/kivo.webp";
import messync from "../client/static/examples/messync.webp";
import microinfluencerClub from "../client/static/examples/microinfluencers.webp";
import promptpanda from "../client/static/examples/promptpanda.webp";
import reviewradar from "../client/static/examples/reviewradar.webp";
import scribeist from "../client/static/examples/scribeist.webp";
import searchcraft from "../client/static/examples/searchcraft.webp";
import { BlogUrl, DocsUrl } from "../shared/common";
import type { GridFeature } from "./components/FeaturesGrid";
import { developerSecuritySubtitle } from "../client/utils/productVocabulary";

export const features: GridFeature[] = [
  {
    name: "Shared scan language",
    description: "Statuses, lanes, and results stay consistent from submission to reporting.",
    emoji: "🧭",
    href: DocsUrl,
    size: "small",
  },
  {
    name: "Billing shell",
    description: "Current plan, usage, and upgrade path live in one workspace-aware view.",
    emoji: "💳",
    href: DocsUrl,
    size: "small",
  },
  {
    name: "Admin console",
    description: "Internal operators can inspect users, workspaces, scans, and queue health.",
    emoji: "🛠️",
    href: DocsUrl,
    size: "medium",
  },
  {
    name: "Developer security workflows",
    description: developerSecuritySubtitle,
    emoji: "🛡️",
    href: DocsUrl,
    size: "large",
  },
  {
    name: "GitHub-triggered scans",
    description: "Keep repository events, findings, and check runs in one control plane.",
    emoji: "🔗",
    href: DocsUrl,
    size: "large",
  },
  {
    name: "Quota-aware usage",
    description: "Usage and limits are surfaced before the team hits a hard stop.",
    emoji: "📈",
    href: DocsUrl,
    size: "small",
  },
  {
    name: "Workspace scope",
    description: "Everything is filtered to the active workspace and its memberships.",
    emoji: "🏢",
    href: DocsUrl,
    size: "small",
  },
  {
    name: "Findings lifecycle",
    description: "Read-heavy triage views keep the active, accepted, and snoozed states aligned.",
    emoji: "🔎",
    href: DocsUrl,
    size: "medium",
  },
  {
    name: "Operational handoff",
    description: "Support can search users, workspaces, and scans without leaving the shell.",
    emoji: "🚀",
    href: DocsUrl,
    size: "medium",
  },
];

export const testimonials = [
  {
    name: "Platform team",
    role: "Security operations",
    avatarSrc: daBoiAvatar,
    socialUrl: "https://twitter.com/wasplang",
    quote: "One place to answer product, support, and security questions without context switching.",
  },
  {
    name: "Billing owner",
    role: "Finance + engineering",
    avatarSrc: daBoiAvatar,
    socialUrl: "",
    quote: "Plan usage and subscription state are visible in product terms instead of payment jargon.",
  },
  {
    name: "Admin operator",
    role: "Internal support",
    avatarSrc: daBoiAvatar,
    socialUrl: "#",
    quote: "Scan lookup, queue health, and workspace data are available from one internal console.",
  },
];

export const faqs = [
  {
    id: 1,
    question: "What does the billing shell actually show?",
    answer: "Current plan, billing state, usage, limit headroom, and the path to upgrade or manage the subscription.",
    href: DocsUrl,
  },
  {
    id: 2,
    question: "Who can access the admin console?",
    answer: "Only authenticated users with the internal admin flag can reach the /admin route and its lookup tools.",
    href: DocsUrl,
  },
];

export const footerNavigation = {
  app: [
    { name: "Plans", href: "/pricing" },
    { name: "Billing", href: "/billing" },
    { name: "Documentation", href: DocsUrl },
  ],
  company: [
    { name: "About", href: "https://wasp.sh" },
    { name: "Blog", href: BlogUrl },
    { name: "Privacy", href: "#" },
    { name: "Terms of Service", href: "#" },
  ],
};

export const examples = [
  {
    name: "GitHub scan",
    description: "Repository scans with a shared status vocabulary.",
    imageSrc: kivo,
    href: "/new-scan",
  },
  {
    name: "Billing shell",
    description: "Plan, usage, and portal actions in one place.",
    imageSrc: messync,
    href: "/billing",
  },
  {
    name: "Admin console",
    description: "Users, workspaces, scans, and worker health.",
    imageSrc: microinfluencerClub,
    href: "/admin",
  },
  {
    name: "Findings",
    description: "Lifecycle triage for active findings.",
    imageSrc: promptpanda,
    href: "/findings",
  },
  {
    name: "Reports",
    description: "Scan details with aligned result labels.",
    imageSrc: reviewradar,
    href: "/dashboard",
  },
  {
    name: "Settings",
    description: "Workspace, scanner, and notification settings.",
    imageSrc: scribeist,
    href: "/settings",
  },
  {
    name: "API keys",
    description: "Reusable access for CI and integrations.",
    imageSrc: searchcraft,
    href: "/api-keys",
  },
];
