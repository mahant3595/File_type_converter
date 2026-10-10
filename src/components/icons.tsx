import {
  Archive,
  FileArchive,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  FolderArchive,
  ImageIcon,
  Layers,
  Music2,
  Paperclip,
  File as FileIcon,
  Presentation,
  Scissors,
  Split,
  Video,
} from "lucide-react";
import type { CategoryId, FormatFamily } from "@/lib/catalog";

const FAMILY_ICON: Record<FormatFamily, typeof FileIcon> = {
  image: FileImage,
  pdf: FileText,
  document: FileText,
  spreadsheet: FileSpreadsheet,
  presentation: Presentation,
  audio: FileAudio,
  video: FileVideo,
  archive: FileArchive,
  text: FileText,
  unknown: FileIcon,
};

export function FormatFamilyIcon({
  family,
  className,
  ...rest
}: {
  family: FormatFamily;
  className?: string;
} & React.ComponentProps<typeof FileIcon>) {
  const Icon = FAMILY_ICON[family] ?? FileIcon;
  return <Icon className={className} aria-hidden="true" {...rest} />;
}

const CATEGORY_ICON: Record<CategoryId, typeof FileIcon> = {
  images: ImageIcon,
  pdf: FileText,
  documents: FileText,
  spreadsheets: FileSpreadsheet,
  presentations: Presentation,
  audio: Music2,
  video: Video,
  archives: FolderArchive,
};

export function CategoryIcon({
  category,
  className,
}: {
  category: CategoryId | "all";
  className?: string;
}) {
  if (category === "all") return <Layers className={className} aria-hidden="true" />;
  const Icon = CATEGORY_ICON[category] ?? FileIcon;
  return <Icon className={className} aria-hidden="true" />;
}

/** Tool-specific glyph shown on cards (arrow combinations for convert, tools for utilities). */
export function ToolGlyph({ id, className }: { id: string; className?: string }) {
  if (id.startsWith("merge")) return <Layers className={className} aria-hidden="true" />;
  if (id.startsWith("split")) return <Split className={className} aria-hidden="true" />;
  if (id.startsWith("extract")) return <Archive className={className} aria-hidden="true" />;
  if (id.startsWith("files-to")) return <Paperclip className={className} aria-hidden="true" />;
  if (id.includes("-to-")) return <Scissors className={className} aria-hidden="true" />;
  return <FileIcon className={className} aria-hidden="true" />;
}

/** Custom product mark (violet, minimal). */
export function NexoraMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" fill="none">
      <rect x="1" y="1" width="30" height="30" rx="9" className="fill-accent/15 stroke-accent" strokeWidth="1.5" />
      <path
        d="M10 22V10l12 12V10"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-foreground"
      />
      <circle cx="16" cy="16" r="2" className="fill-cyan" />
    </svg>
  );
}
