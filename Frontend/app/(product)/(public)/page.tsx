import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 py-12">
      <Link href="/examples/me/invoices">My Invoices Example</Link>
      <span> | </span>
      <Link href="/examples/admin/invoices">Admin Invoices Example</Link>
    </div>
  );
}
