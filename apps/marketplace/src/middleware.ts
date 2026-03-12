import { createNextMiddleware } from "@payproof/server/next";
import { payproofServer } from "./lib/server-instance";

const routes = {
  "/api/provider/weather": {
    accepts: payproofServer.multiChainAccepts("$0.001"),
    description: "Weather data for commodity analysis",
  },
  "/api/provider/markets": {
    accepts: payproofServer.multiChainAccepts("$0.01"),
    description: "Crypto market prices and volume data",
  },
  "/api/provider/sentiment": {
    accepts: payproofServer.multiChainAccepts("$0.05"),
    description: "AI-powered market sentiment analysis",
  },
};

const handler = createNextMiddleware(payproofServer, routes);

export const middleware = async (req: import("next/server").NextRequest) => {
  try {
    const res = await handler(req);
    return res;
  } catch (err) {
    console.error(`[middleware] error:`, err);
    throw err;
  }
};

export const config = {
  matcher: "/api/provider/:path*",
};
