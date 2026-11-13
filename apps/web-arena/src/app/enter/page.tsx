import Link from "next/link";

export default function Page() {
  return (
    <main className="flex min-h-screen flex-col items-start justify-center gap-6 bg-ink px-6 text-bone">
      <h1 className="text-3xl font-medium">Enter the arena</h1>
      <Link href="/app" className="border border-rule-2 px-4 py-2 text-bone hover:bg-haze">
        Continue as guest
      </Link>
    </main>
  );
}
