import Link from "next/link";

export default function Page() {
  return (
    <main className="flex min-h-screen flex-col items-start justify-center gap-6 bg-ink px-6 text-bone">
      <h1 className="text-4xl font-medium">ApexArena</h1>
      <Link href="/enter" className="border border-rule-2 px-4 py-2 text-bone hover:bg-haze">
        Enter the arena
      </Link>
    </main>
  );
}
