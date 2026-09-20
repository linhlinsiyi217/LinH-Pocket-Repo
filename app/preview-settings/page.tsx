import type { Metadata } from "next";

import { SettingsPreviewGallery } from "@/components/settings-preview/screens";
import "../../styles/settings-preview.css";

export const metadata: Metadata = {
  title: "Settings Visual Preview · T6.5",
  robots: { index: false, follow: false },
};

export default function SettingsPreviewPage() {
  return <SettingsPreviewGallery />;
}
