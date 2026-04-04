"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { SectionWrapper } from "@/components/section-wrapper";
import { Badge } from "@/components/ui/badge";
import { CodeBlock } from "@/components/ui/code-block";
import { GradientOrbs } from "@/components/animations/gradient-orbs";
import { EASE_OUT_EXPO } from "@/lib/motion";

const agentInstall = `npm install @payproof/client @payproof/contracts`;

const agentCode = `const client = createPayproofClient({
  chains: { evm: { privateKey: "0x..." } },
});

const fetch = client.getFetchWithPayment();
const data = await fetch("https://api.example.com/data")
  .then(r => r.json()); // decrypted automatically`;

const merchantInstall = `npm install @payproof/server @payproof/contracts`;

const merchantCode = `const server = createPayproofServer({
  chains: { evm: { merchantAddress: "0x..." } },
});

const middleware = createNextMiddleware(server, {
  "/api/data": { accepts: server.multiChainAccepts("$0.01") },
});
// encryption + settlement is automatic`;

export function SDK() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <SectionWrapper id="sdk" className="py-24 md:py-32">
      <GradientOrbs preset="crypto" />

      <div className="relative z-10 max-w-5xl mx-auto px-6">
        {/* Heading */}
        <h2 className="font-serif text-3xl md:text-5xl text-center text-foreground">
          Three lines of code. Full atomic payments.
        </h2>
        <p className="text-lg text-muted-foreground text-center mt-4 font-sans max-w-3xl mx-auto">
          Your agent sees{" "}
          <code className="font-mono text-code-foreground bg-code-bg px-1.5 py-0.5 rounded">
            fetch()
          </code>
          . Your server sees route handlers. The entire protocol is invisible.
        </p>

        {/* Two-column code layout */}
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
          className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-16"
        >
          {/* Agent column */}
          <div className="space-y-4">
            <span className="text-sm font-medium text-agent uppercase tracking-wider font-sans">
              For Agents
            </span>
            <CodeBlock language="bash">{agentInstall}</CodeBlock>
            <CodeBlock language="typescript">{agentCode}</CodeBlock>
          </div>

          {/* Merchant column */}
          <div className="space-y-4">
            <span className="text-sm font-medium text-merchant uppercase tracking-wider font-sans">
              For Merchants
            </span>
            <CodeBlock language="bash">{merchantInstall}</CodeBlock>
            <CodeBlock language="typescript">{merchantCode}</CodeBlock>
          </div>
        </motion.div>

        {/* Coming soon badges */}
        <div className="flex gap-3 justify-center mt-12 flex-wrap">
          <Badge variant="coming">MCP Tools</Badge>
          <Badge variant="coming">OpenAI Functions</Badge>
          <Badge variant="coming">LlamaIndex</Badge>
        </div>
      </div>
    </SectionWrapper>
  );
}
