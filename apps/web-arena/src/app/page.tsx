import { CanyonCanvas } from "@/components/landing/CanyonCanvas";
import { ChapterRail } from "@/components/landing/ChapterRail";
import { Close } from "@/components/landing/Close";
import { Credit } from "@/components/landing/Credit";
import { Footer } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { LandingMotion } from "@/components/landing/LandingMotion";
import { StackRows } from "@/components/landing/StackRows";
import { Stage } from "@/components/landing/Stage";
import { StatusLine } from "@/components/landing/StatusLine";
import { TopBar } from "@/components/landing/TopBar";
import s from "@/components/landing/landing.module.css";
import { CHAPTER_VH } from "@/content/landing";

export default function Page() {
  return (
    <div className={s.root}>
      <CanyonCanvas mode="landing" />
      <TopBar />
      <ChapterRail />
      <main className={s.main} data-landing="">
        <Hero />
        {/* Chapters 01–06: sticky stages at the guide's heights; their content arrives in Task 7. */}
        <Stage id="c1" variant="l" heightVh={CHAPTER_VH.c1} />
        <Stage id="c2" variant="r" heightVh={CHAPTER_VH.c2} />
        <Stage id="c3" variant="b" heightVh={CHAPTER_VH.c3} />
        <Stage id="c4" variant="c" heightVh={CHAPTER_VH.c4} />
        <Stage id="c5" variant="r" heightVh={CHAPTER_VH.c5} />
        <Stage id="c6" variant="b" heightVh={CHAPTER_VH.c6} />
        <StackRows />
        <Credit />
        <Close />
      </main>
      <Footer />
      <StatusLine />
      <LandingMotion />
    </div>
  );
}
