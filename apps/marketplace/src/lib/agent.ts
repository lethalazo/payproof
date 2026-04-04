import Anthropic from "@anthropic-ai/sdk";
import { toolDefinitions, executeTool } from "./tools";
import type { AgentEvent } from "./types";

const anthropic = new Anthropic({
  defaultHeaders: {
    "anthropic-beta": "oauth-2025-04-20",
  },
});

const SYSTEM_PROMPT = `You are an autonomous AI research agent with access to a USDC cryptocurrency wallet on two blockchain networks:

1. **Base Sepolia** - x402 "exact" scheme (Permit2-based). Used for micropayments to purchase premium data APIs.
2. **Arc Testnet** - x402 "direct" scheme (HTLC-based atomic protocol). Circle's chain where USDC is the native gas token, so no separate gas management needed. Great for zero-friction payments with cryptographic atomicity guarantees.

Your workflow:
1. First, check your wallet balances and list available APIs
2. Plan which data sources to purchase within the user's budget
3. The x402 payment system auto-selects the best chain - it will use whichever chain you have funds on
4. Purchase data by calling the paid APIs (payments happen automatically via x402)
5. Analyze all purchased data and synthesize actionable insights
6. Present a clear research report with your findings

Be strategic about spending - check prices first, prioritize the most valuable data for the research goal, and stay within budget. After purchasing data, always provide thorough analysis.

When you're done with your research, provide a final summary with:
- What data you purchased and why
- Key findings and insights
- Total amount spent
- Which chain was used for payment
- Recommendations based on the data`;

interface AgentInput {
  goal: string;
  budget: string;
}

export async function* runAgent(input: AgentInput): AsyncGenerator<AgentEvent> {
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Research goal: ${input.goal}\n\nBudget: $${input.budget} USDC\n\nYou have wallets on Base Sepolia and Arc Testnet. Please conduct this research autonomously, purchasing whatever data you need within the budget. Start by checking your wallet balances and listing available APIs.`,
    },
  ];

  let continueLoop = true;
  let iterations = 0;
  const MAX_ITERATIONS = 25;

  while (continueLoop) {
    if (++iterations > MAX_ITERATIONS) {
      yield {
        type: "error",
        content: `Agent reached maximum iteration limit (${MAX_ITERATIONS}). Stopping to prevent runaway spending.`,
        timestamp: Date.now(),
      };
      break;
    }
    let response: Anthropic.Message;
    try {
      response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: toolDefinitions,
        messages,
      });
    } catch (err) {
      yield {
        type: "error",
        content: `API error: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now(),
      };
      return;
    }

    // Process response content blocks
    const assistantContent: Anthropic.ContentBlock[] = [];

    for (const block of response.content) {
      assistantContent.push(block);

      if (block.type === "text") {
        yield {
          type: "text",
          content: block.text,
          timestamp: Date.now(),
        };
      } else if (block.type === "tool_use") {
        yield {
          type: "tool_call",
          content: `Calling ${block.name}`,
          toolName: block.name,
          toolInput: block.input as Record<string, unknown>,
          timestamp: Date.now(),
        };
      }
    }

    // Add assistant message to history
    messages.push({ role: "assistant", content: assistantContent });

    // If the model wants to use tools, execute them
    if (response.stop_reason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type === "tool_use") {
          try {
            const result = await executeTool(
              block.name,
              block.input as Record<string, unknown>,
            );
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: result,
            });
            yield {
              type: "tool_result",
              content: result,
              toolName: block.name,
              timestamp: Date.now(),
            };
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: `Error: ${errorMsg}`,
              is_error: true,
            });
            yield {
              type: "error",
              content: `Tool error (${block.name}): ${errorMsg}`,
              toolName: block.name,
              timestamp: Date.now(),
            };
          }
        }
      }

      messages.push({ role: "user", content: toolResults });
    } else if (response.stop_reason === "max_tokens") {
      yield {
        type: "text",
        content: "Agent reached output limit - response was truncated.",
        timestamp: Date.now(),
      };
      continueLoop = false;
    } else {
      // stop_reason is "end_turn" - agent is done
      continueLoop = false;
    }
  }

  yield { type: "done", content: "Agent completed", timestamp: Date.now() };
}
