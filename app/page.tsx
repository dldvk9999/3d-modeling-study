import AgenticScene from "./components/AgenticScene";
import HeroScene from "./components/HeroScene";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-[#1b1a22]">
      <section
        className="relative flex h-[100svh] w-full flex-col overflow-hidden"
        style={{ fontFamily: "var(--font-inter)" }}
      >
        <HeroScene fontFamily="var(--font-inter), Inter, Helvetica, Arial, sans-serif" />

        <header className="relative z-10 flex items-center gap-8 px-6 py-4 text-[13px] text-white/90">
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
            <a className="hidden transition-opacity hover:opacity-70 sm:block" href="#">
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

        <div className="relative z-10 mt-auto flex flex-col gap-8 px-6 pb-10 text-[13px] text-white sm:flex-row sm:items-end sm:gap-16">
          <p className="max-w-[220px] leading-snug">
            150+ updates to sell, shop, and build everywhere
          </p>
          <div className="grid grid-cols-2 gap-x-10 gap-y-2 sm:grid-cols-3">
            {[
              "Agentic",
              "Sidekick",
              "Online",
              "Retail",
              "Marketing",
              "Operations",
              "Shop app",
              "Payments",
              "Finance",
              "Developer",
            ].map((item) => (
              <a key={item} className="underline-offset-4 hover:underline" href="#">
                {item}
              </a>
            ))}
          </div>
        </div>
      </section>

      <section
        id="agentic"
        className="relative flex h-[100svh] w-full flex-col overflow-hidden bg-black"
        style={{ fontFamily: "var(--font-inter)" }}
      >
        <AgenticScene />

        <div className="relative z-10 flex flex-1 flex-col justify-center px-6 text-white sm:px-14">
          <h2 className="text-[56px] font-normal leading-none tracking-tight sm:text-[76px]">
            Agentic
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-snug sm:mt-7 sm:text-[26px]">
            The only platform you need to be in every AI channel
          </p>
        </div>

        <div className="relative z-10 flex justify-center pb-8">
          <button
            type="button"
            className="flex items-center gap-8 rounded-full bg-white px-5 py-2.5 text-[13px] font-medium text-black shadow-lg transition-opacity hover:opacity-90"
          >
            Agentic
            <span aria-hidden className="flex flex-col gap-[3px]">
              <span className="block h-px w-4 bg-black" />
              <span className="block h-px w-4 bg-black" />
              <span className="block h-px w-4 bg-black" />
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}
