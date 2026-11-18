import type { Metadata } from "next";
import ImportForm from "./import-form";

export const metadata: Metadata = {
  title: "Import box score · Hoops Fantasy",
  robots: { index: false },
};

export default function ImportPage() {
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
