import ChapterBlock, {
  ChapterFeatures,
  ChapterIntro,
} from "./components/ChapterBlock";
import HeroScene from "./components/HeroScene";
import WaveSections from "./components/WaveSections";
import { CHAPTERS } from "./data/chapters";

const [FIRST_CHAPTER, ...REST_CHAPTERS] = CHAPTERS;

export default function Home() {
  // the bar rides above both sections, the way it stays put on the original
  const topBar = (
    <header className="fixed inset-x-0 top-0 z-50 flex items-center gap-8 px-6 py-4 text-[13px] text-white/90">
      <div className="flex items-center gap-2">
        <span className="font-semibold">Shopify Editions</span>
        <span className="text-white/60">Spring &apos;26</span>
      </div>
      <nav className="hidden items-center gap-6 md:flex">
        <a className="transition-opacity hover:opacity-70" href="#">
          Editions
        </a>
        <a className="transition-opacity hover:opacity-70" href="#">
          Search
        </a>
      </nav>
      <div className="ml-auto flex items-center gap-5">
        <a
          className="hidden transition-opacity hover:opacity-70 sm:block"
          href="#"
        >
          Shopify.com
        </a>
        <a
          className="rounded-full bg-white px-4 py-2 text-[13px] font-medium text-black transition-opacity hover:opacity-90"
          href="#"
        >
          Start for free
        </a>
      </div>
    </header>
  );

  const hero = (
    <section
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ fontFamily: "var(--font-inter)" }}
    >
      <HeroScene fontFamily="var(--font-inter), Inter, Helvetica, Arial, sans-serif" />

      <div className="relative z-10 mt-auto flex flex-col gap-8 px-6 pb-10 text-[13px] text-white sm:flex-row sm:items-end sm:gap-16">
        <p className="max-w-[220px] leading-snug">
          150+ updates to sell, shop, and build everywhere
        </p>
        <div className="grid grid-cols-2 gap-x-10 gap-y-2 sm:grid-cols-3">
          {CHAPTERS.map((chapter) => (
            <a
              key={chapter.id}
              className="underline-offset-4 hover:underline"
              href={`#${chapter.id}`}
            >
              {chapter.name}
            </a>
          ))}
        </div>
      </div>
    </section>
  );

  return (
    <div className="flex flex-1 flex-col bg-[#1b1a22]">
      {topBar}

      {/* the hero gives way to the first chapter through the glass wave */}
      <WaveSections
        first={hero}
        second={<ChapterIntro chapter={FIRST_CHAPTER} />}
      />
      <ChapterFeatures chapter={FIRST_CHAPTER} />

      {REST_CHAPTERS.map((chapter) => (
        <ChapterBlock key={chapter.id} chapter={chapter} />
      ))}

      <section
        className="relative bg-black px-6 pt-28 pb-20 text-white sm:px-14"
        style={{ fontFamily: "var(--font-inter)" }}
      >
        <h2 className="max-w-3xl text-[38px] leading-[1.05] font-normal tracking-tight sm:text-[64px]">
          Get notified about the next edition
        </h2>
        <form className="mt-10 flex max-w-xl gap-3" onSubmit={undefined}>
          <input
            type="email"
            placeholder="Email address"
            className="min-w-0 flex-1 rounded-full border border-white/20 bg-transparent px-5 py-3 text-[15px] placeholder:text-white/40 focus:border-white/60 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-full bg-white px-6 py-3 text-[15px] font-medium text-black transition-opacity hover:opacity-90"
          >
            Sign up
          </button>
        </form>

        <div className="mt-24 grid gap-x-10 gap-y-3 border-t border-white/10 pt-10 text-[13px] text-white/60 sm:grid-cols-3 lg:grid-cols-5">
          {CHAPTERS.map((chapter) => (
            <a
              key={chapter.id}
              className="hover:text-white"
              href={`#${chapter.id}`}
            >
              {chapter.name}
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
