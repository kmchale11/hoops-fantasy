import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/guards";
import ImportForm from "./import-form";

export const metadata: Metadata = {
  title: "Import box score",
  robots: { index: false },
};

// Checks the admin role per request; non-admins get a 404.
export const instant = false;

export default async function ImportPage() {
  await requireAdminPage();
  return (
    <main>
      <h1>Import a box score</h1>
      <p className="muted">
        For when the feed is down. Upload one fixture&apos;s box score as a CSV. Nothing is saved
        unless every row is valid.
      </p>
      <ImportForm />
    </main>
  );
}
