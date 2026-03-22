/**
 * Hero strip — establishes trust (devnet, program live) without blocking the operational UI below.
 */
export default function HeroCard() {
  return (
    <section
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-navy to-[#0f3460] px-8 py-10 text-white shadow-lg"
      aria-labelledby="hero-title"
    >
      <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
        <span className="h-2 w-2 rounded-full bg-green" aria-hidden />
        Devnet · Program live
      </div>
      <img src="/logo.png" alt="Medovant" className="mb-3 h-14 w-auto opacity-95" />
      <h2 id="hero-title" className="text-[32px] font-bold tracking-tight">
        MEDOVANT
      </h2>
      <p className="mt-2 max-w-xl text-sm text-white/75">
        On-chain escrow for hospital equipment maintenance: vault PDAs, technician reputation, and Anchor-powered
        instructions.
      </p>
      <ul className="mt-6 flex flex-wrap gap-2">
        {['Vault PDA escrow', 'Technician reputation', 'Digital asset twins', 'Anchor 0.32.1'].map((pill) => (
          <li
            key={pill}
            className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-medium text-white/90"
          >
            {pill}
          </li>
        ))}
      </ul>
    </section>
  )
}
