export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center px-4 py-10 sm:px-6">
      <section className="panel w-full rounded-[32px] border border-white/10 px-8 py-12 text-center">
        <p className="text-xs uppercase tracking-[0.34em] text-slate-400">404</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
          Route not found.
        </h1>
        <p className="mt-4 text-base text-slate-300/75">
          The requested page does not exist on this host.
        </p>
      </section>
    </main>
  );
}
