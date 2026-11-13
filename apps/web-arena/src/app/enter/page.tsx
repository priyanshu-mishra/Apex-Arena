import type { Metadata } from "next";
import { Gate } from "@/components/gate/Gate";

export const metadata: Metadata = {
  title: "ApexArena: opening the arena",
};

export default function Page() {
  return <Gate />;
}
