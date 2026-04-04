const footerLinks = [
  { label: "Protocol", href: "/whitepaper/" },
  { label: "GitHub", href: "https://github.com/lethalazo/payproof" },
  { label: "SDK Docs", href: "https://github.com/lethalazo/payproof#sdk-packages" },
];

const footerLinkClass = "text-sm opacity-70 hover:opacity-100 transition-opacity";

export function Footer() {
  return (
    <footer className="bg-foreground text-primary-foreground">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div>
            <span className="font-serif text-lg">Payproof</span>
            <p className="text-sm opacity-60 mt-2">
              Atomic payments for autonomous agents.
            </p>
            <p className="text-xs opacity-40 mt-1">v0.1</p>
          </div>

          <div className="flex flex-col gap-2">
            {footerLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target={link.href.startsWith("http") ? "_blank" : undefined}
                rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
                className={footerLinkClass}
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex flex-col gap-2 md:items-end">
            <span className="text-sm opacity-70">
              A Discontinuity Research project
            </span>
            <a
              href="https://discontinuity.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm opacity-50 hover:opacity-80 transition-opacity"
            >
              discontinuity.xyz
            </a>
          </div>
        </div>

        <div className="border-t border-primary-foreground/10 mt-8 pt-6">
          <p className="text-xs opacity-40">
            Apache 2.0 &middot; 2026 Discontinuity Research
          </p>
        </div>
      </div>
    </footer>
  );
}
