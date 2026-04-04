"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SectionWrapper } from "@/components/section-wrapper";

/* ------------------------------------------------------------------ */
/*  Notify / email signup section                                       */
/* ------------------------------------------------------------------ */

export function Notify() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email || !email.includes("@")) {
      setError("Please enter a valid email.");
      return;
    }

    setLoading(true);

    // TODO: Supabase integration
    // For now, simulate success
    await new Promise((r) => setTimeout(r, 400));
    setLoading(false);
    setSuccess(true);
  }

  return (
    <SectionWrapper className="py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <h2 className="font-serif text-2xl md:text-3xl text-center">
          Get notified at mainnet launch.
        </h2>

        <div className="mt-8 max-w-md mx-auto">
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                key="success"
                className="flex items-center justify-center gap-2 py-3"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
              >
                <svg
                  className="w-5 h-5 text-payment"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="font-sans text-sm text-foreground font-medium">
                  You&apos;re on the list.
                </span>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                onSubmit={handleSubmit}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex flex-col sm:flex-row">
                  <input
                    type="email"
                    aria-label="Email address"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(null); }}
                    placeholder="your@email.com"
                    className="bg-white border border-muted rounded-full sm:rounded-l-full sm:rounded-r-none px-6 py-3 text-sm font-sans flex-1 focus:outline-none focus:border-agent min-w-0"
                    disabled={loading}
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-primary text-primary-foreground rounded-full sm:rounded-r-full sm:rounded-l-none px-6 py-3 text-sm font-sans font-medium hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-60 shrink-0 mt-2 sm:mt-0"
                  >
                    {loading ? "..." : "Notify me \u2192"}
                  </button>
                </div>

                {error && (
                  <motion.p
                    className="text-xs text-problem text-center mt-3 font-sans"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    {error}
                  </motion.p>
                )}

                <p className="text-xs text-muted-foreground text-center mt-3 font-sans">
                  No spam. One email when we go live.
                </p>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </SectionWrapper>
  );
}
