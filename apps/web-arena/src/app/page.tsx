import { CanyonCanvas } from "@/components/landing/CanyonCanvas";
import { ChapterHead } from "@/components/landing/ChapterHead";
import { ChapterRail } from "@/components/landing/ChapterRail";
import { Close } from "@/components/landing/Close";
import { Credit } from "@/components/landing/Credit";
import { Footer } from "@/components/landing/Footer";
import { LandingHashRows } from "@/components/landing/HashRows";
import { Hero } from "@/components/landing/Hero";
import { LambdaTrace } from "@/components/landing/LambdaTrace";
import { LandingMotion } from "@/components/landing/LandingMotion";
import { Leaderboard } from "@/components/landing/Leaderboard";
import { MoodSelector } from "@/components/landing/MoodSelector";
import { OrderControl } from "@/components/landing/OrderControl";
import { Rich } from "@/components/landing/Rich";
import { StackRows } from "@/components/landing/StackRows";
import { Stage } from "@/components/landing/Stage";
import { StatusLine } from "@/components/landing/StatusLine";
import { TickStrip } from "@/components/landing/TickStrip";
import { TopBar } from "@/components/landing/TopBar";
import { VenueReadouts } from "@/components/landing/VenueReadouts";
import { WeightBar } from "@/components/landing/WeightBar";
import s from "@/components/landing/landing.module.css";
import { CHAPTER_VH, COPY } from "@/content/landing";
import { REAL } from "@/lib/canyon/real";

export default function Page() {
  return (
    <div className={s.root}>
      <CanyonCanvas mode="landing" />
      <TopBar />
      <ChapterRail />
      <main className={s.main} data-landing="">
        <Hero />

        {/* 01 Impact */}
        <Stage id="c1" variant="l" heightVh={CHAPTER_VH.c1}>
          <ChapterHead copy={COPY.c1} className={s.c1Head} />
          <OrderControl />
        </Stage>

        {/* 02 Two venues */}
        <Stage id="c2" variant="r" heightVh={CHAPTER_VH.c2}>
          <ChapterHead copy={COPY.c2} className={s.c2Head} />
          <VenueReadouts />
        </Stage>

        {/* 03 Chaos */}
        <Stage id="c3" variant="b" heightVh={CHAPTER_VH.c3}>
          <ChapterHead copy={COPY.c3} className={s.c3Head} />
          <div className={s.inst}>
            <MoodSelector />
            <LambdaTrace />
          </div>
        </Stage>

        {/* 04 The barrier (quiet: no reveals) */}
        <Stage id="c4" variant="c" heightVh={CHAPTER_VH.c4} stageClassName={s.c4Stage}>
          <div className={s.mid}>
            <TickStrip />
            <h2 className={`${s.h2} ${s.c4Title}`}>{COPY.c4.title}</h2>
            <p className={s.lede}>{COPY.c4.lede}</p>
            <p className={s.precise}>
              <Rich text={COPY.c4.precise} />
            </p>
          </div>
        </Stage>

        {/* 05 Score: real engine output */}
        <Stage id="c5" variant="r" heightVh={CHAPTER_VH.c5}>
          <ChapterHead copy={COPY.c5} className={s.c5Head} precise={false} />
          <div className={s.board}>
            {/* Precise columns follow the page's Plain / Precise switch through CSS (data-pc). */}
            <Leaderboard rows={REAL.leaderboard} precise={false} caption={COPY.c5.tableCaption} />
            <WeightBar />
            <p className={s.precise}>
              <Rich text={COPY.c5.precise} />
            </p>
            <p className={s.fine}>{COPY.c5.caption}</p>
          </div>
        </Stage>

        {/* 06 Proof: real SHA-256, lit by scroll */}
        <Stage id="c6" variant="b" heightVh={CHAPTER_VH.c6}>
          <ChapterHead copy={COPY.c6} className={s.c6Head} precise={false} />
          <div className={s.runs}>
            <LandingHashRows
              note={
                <p className={s.precise}>
                  <Rich text={COPY.c6.precise} />
                </p>
              }
            />
          </div>
        </Stage>

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
