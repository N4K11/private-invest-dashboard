export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <section className="panel w-full rounded-[36px] border border-white/10 px-6 py-10 sm:px-10 sm:py-14">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.34em] text-cyan-200/65">
            Private infrastructure
          </p>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-6xl">
            Personal digital asset tooling, kept off the public navigation layer.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300/80">
            This host can serve internal finance workflows and hidden operator surfaces without exposing them from the main domain entry point.
          </p>
        </div>
      </section>
    </main>
  );
}
