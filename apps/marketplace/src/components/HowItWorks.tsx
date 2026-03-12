"use client";

import { useState } from "react";

const STEPS = [
  {
    num: 1,
    label: "Lock",
    description: "Buyer locks USDC in an HTLC smart contract with the seller's hash commitment",
    detail: "The seller generates a secret preimage and sends its SHA-256 hash (the hashlock) to the buyer. The buyer locks USDC on-chain against this hashlock. Only someone who knows the preimage can unlock the funds.",
  },
  {
    num: 2,
    label: "Encrypt",
    description: "Seller encrypts data using the preimage as the AES-256-GCM key and posts the hash on-chain",
    detail: "The seller verifies the lock on-chain, then encrypts their data using the preimage as the AES-256-GCM key. The ciphertext hash (dataHash) is posted on-chain so the buyer can verify data was committed.",
  },
  {
    num: 3,
    label: "Confirm",
    description: "Buyer verifies encrypted data was posted and confirms receipt on-chain",
    detail: "The buyer checks that the seller posted a valid dataHash on-chain. By confirming receipt, the buyer signals they received the ciphertext. If the seller never posted data, the buyer can refund instead.",
  },
  {
    num: 4,
    label: "Claim",
    description: "Seller reveals preimage on-chain to claim USDC payment",
    detail: "The seller submits the preimage to the smart contract. The contract verifies SHA-256(preimage) matches the hashlock, then releases the locked USDC to the seller. The preimage is now public on-chain.",
  },
  {
    num: 5,
    label: "Decrypt",
    description: "Buyer reads the preimage from the claim transaction and decrypts the data",
    detail: "The preimage — now visible on-chain from the claim transaction — is the AES-256-GCM decryption key. The buyer uses it to decrypt the data. Payment and data delivery are mathematically atomic.",
  },
];

export default function HowItWorks() {
  const [open, setOpen] = useState(false);
  const [activeStep, setActiveStep] = useState<number | null>(null);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-3 py-1.5 rounded-full border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
      >
        How it works
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <div>
                <h2 className="text-lg font-bold text-white">How Payproof Works</h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  Atomic data-for-payment — no trust required
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-500 hover:text-white text-xl leading-none px-2"
              >
                x
              </button>
            </div>

            <div className="px-6 py-4">
              <p className="text-sm text-gray-300 mb-4">
                The HTLC preimage <span className="font-bold text-white">IS</span> the
                AES-256-GCM decryption key. When the seller reveals it on-chain to claim payment,
                the buyer automatically gets the key to decrypt the data. Cheating is
                mathematically impossible.
              </p>

              <div className="space-y-3">
                {STEPS.map((step) => (
                  <button
                    key={step.num}
                    onClick={() => setActiveStep(activeStep === step.num ? null : step.num)}
                    className="w-full text-left"
                  >
                    <div className="flex items-start gap-3 p-3 rounded-lg border border-gray-800 hover:border-gray-600 transition-colors">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 text-sm font-bold">
                        {step.num}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{step.label}</span>
                          <span className="text-xs text-gray-500">
                            {activeStep === step.num ? "▼" : "▶"}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{step.description}</p>
                        {activeStep === step.num && (
                          <p className="text-xs text-gray-300 mt-2 pl-0 border-l-2 border-blue-500/30 ml-0 px-2">
                            {step.detail}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                <p className="text-xs text-gray-400">
                  <span className="text-emerald-400 font-medium">Key insight:</span>{" "}
                  Unlike x402 &quot;exact&quot; (pay-and-pray), Payproof&apos;s &quot;direct&quot; scheme guarantees
                  that payment and data delivery happen atomically. The seller cannot take payment
                  without revealing the decryption key, and the buyer cannot get the data without
                  paying.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
