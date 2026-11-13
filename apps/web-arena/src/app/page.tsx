import Link from "next/link";
import { CanyonCanvas } from "@/components/landing/CanyonCanvas";

export default function Page() {
  return (
    <>
      <CanyonCanvas mode="landing" />
      <main className="relative z-10 flex min-h-screen flex-col items-start justify-center gap-6 px-6 text-bone">
        <h1 className="text-4xl font-medium">ApexArena</h1>
        <Link href="/enter" className="border border-rule-2 px-4 py-2 text-bone hover:bg-haze">
          Enter the arena
        </Link>
      </main>
    </>
  );
}
