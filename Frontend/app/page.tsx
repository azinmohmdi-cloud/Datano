import Link from "next/link";

export default function Home() {
  return (
    <div className="w-screen h-screen flex justify-center items-center gap-4">
      <Link href="/examples/me/invoices">My Invoices Example</Link>
      <span> | </span>
      <Link href="/examples/admin/invoices">Admin Invoices Example</Link>
    </div>
  );
}
