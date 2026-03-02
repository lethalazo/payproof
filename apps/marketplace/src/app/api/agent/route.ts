import { runAgent } from "@/lib/agent";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { goal, budget } = await req.json();

  if (!goal || !budget) {
    return new Response(JSON.stringify({ error: "goal and budget required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of runAgent({ goal, budget })) {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        }
      } catch (err) {
        const errorEvent = {
          type: "error",
          content: err instanceof Error ? err.message : "Unknown error",
          timestamp: Date.now(),
        };
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
