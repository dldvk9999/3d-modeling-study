import SectionScene from "./SectionScene";
import WaveSections from "./WaveSections";
import type { Chapter } from "../data/chapters";

export function ChapterIntro({ chapter }: { chapter: Chapter }) {
  return (
    <section className="relative flex h-full w-full flex-col overflow-hidden bg-black">
      <SectionScene section={chapter.id} />

      <div className="relative z-10 flex flex-1 flex-col justify-center px-6 text-white sm:px-14">
        <h2 className="text-[56px] leading-none font-normal tracking-tight sm:text-[76px]">
          {chapter.name}
        </h2>
        <p className="mt-5 max-w-2xl text-lg leading-snug sm:mt-7 sm:text-[26px]">
          {chapter.tagline}
        </p>
      </div>

      <div className="relative z-10 flex justify-center pb-8">
        <button
          type="button"
          className="flex items-center gap-8 rounded-full bg-white px-5 py-2.5 text-[13px] font-medium text-black shadow-lg transition-opacity hover:opacity-90"
        >
          {chapter.name}
          <span aria-hidden className="flex flex-col gap-[3px]">
            <span className="block h-px w-4 bg-black" />
            <span className="block h-px w-4 bg-black" />
            <span className="block h-px w-4 bg-black" />
          </span>
        </button>
      </div>
    </section>
  );
}

export function ChapterFeatures({ chapter }: { chapter: Chapter }) {
  const [warm, cool] = chapter.palette;

  return (
    <section
      id={chapter.id}
      className="relative bg-black text-white"
      style={{ fontFamily: "var(--font-inter)" }}
    >
      {/* on the original the scene stays put while the chapter scrolls over it */}
      <div
        aria-hidden
        className="pointer-events-none sticky top-0 -mb-[100svh] h-[100svh] w-full overflow-hidden"
      >
        <SectionScene section={chapter.id} />
      </div>

      <div className="relative px-6 py-24 sm:px-14 sm:py-32">
        <div className="flex flex-col gap-10 border-b border-white/10 pb-16 lg:flex-row lg:items-start lg:gap-20">
          <h3 className="max-w-xl text-[34px] leading-[1.1] font-normal tracking-tight sm:text-[46px]">
            {chapter.lead.title}
          </h3>
          <div className="max-w-md lg:pt-3">
            <p className="text-[15px] leading-relaxed text-white/70">
              {chapter.lead.body}
            </p>
            {chapter.lead.cta ? (
              <a
                className="mt-4 inline-block border-b border-white/40 pb-0.5 text-[15px] hover:border-white"
                href="#"
              >
                {chapter.lead.cta}
              </a>
            ) : null}
          </div>
        </div>

        {/* stands in for the product shot the original runs under each lead */}
        <div
          className="mt-16 h-[38svh] w-full rounded-2xl border border-white/10 sm:h-[52svh]"
          style={{
            background: `radial-gradient(120% 90% at 20% 15%, ${warm}2e, transparent 60%), radial-gradient(120% 90% at 85% 80%, ${cool}33, transparent 62%), #0b0b0f`,
          }}
        />

        <div className="mt-20 grid gap-x-12 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {chapter.features.map((feature) => (
            <article key={feature.title} className="flex flex-col">
              <div
                className="mb-5 h-40 w-full rounded-xl border border-white/10"
                style={{
                  background: `linear-gradient(145deg, ${warm}26, transparent 55%), linear-gradient(315deg, ${cool}2b, transparent 55%), #101016`,
                }}
              />
              <h4 className="text-[17px] leading-snug font-medium">
                {feature.title}
              </h4>
              <p className="mt-2 text-[14px] leading-relaxed text-white/60">
                {feature.body}
              </p>
              {feature.cta ? (
                <a
                  className="mt-3 self-start border-b border-white/30 pb-0.5 text-[14px] text-white/80 hover:border-white hover:text-white"
                  href="#"
                >
                  {feature.cta}
                </a>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function ChapterBlock({ chapter }: { chapter: Chapter }) {
  return (
    <>
      {/* each chapter arrives through the same glass wave as the first */}
      <WaveSections
        second={<ChapterIntro chapter={chapter} />}
        travel={65}
        hold={25}
        overlap={80}
      />
      <ChapterFeatures chapter={chapter} />
    </>
  );
}
