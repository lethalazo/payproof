# API Reference

> Reference app API endpoints and agent tool specifications. The production SDK exposes `createNextMiddleware()` and `createPayproofServer()` rather than these specific routes.

## HTTP Endpoints

### `POST /api/agent`

Runs the AI agent with a research goal and budget. Returns a Server-Sent Events (SSE) stream.

**Request body**:
```json
{
  "goal": "Research commodity weather patterns affecting corn futures",
  "budget": "0.05"
}
```

**SSE event types**:

| Event type | Fields | Description |
|------------|--------|-------------|
| `text` | `content` | Agent's natural language reasoning |
| `tool_call` | `content`, `toolName`, `toolInput` | Agent invokes a tool |
| `tool_result` | `content`, `toolName` | Tool execution result (JSON string) |
| `error` | `content`, `toolName?` | Error during API call or tool execution |
| `done` | `content` | Agent finished its research |

Each event also includes a `timestamp` (unix ms).

**Example SSE stream**:
```
data: {"type":"text","content":"Let me check my wallet balances...","timestamp":1740700000000}

data: {"type":"tool_call","content":"Calling check_wallet_balance","toolName":"check_wallet_balance","toolInput":{},"timestamp":1740700001000}

data: {"type":"tool_result","content":"{\"chains\":[...]}","toolName":"check_wallet_balance","timestamp":1740700002000}

data: {"type":"done","content":"Agent completed","timestamp":1740700030000}
```

---

### `GET /api/wallet`

Returns agent USDC balances across all supported chains.

**Response**:
```json
{
  "balances": {
    "baseSepolia": { "address": "0x...", "balance": "10.500000" },
    "arcTestnet": { "address": "0x...", "balance": "5.250000" }
  }
}
```

---

### `GET /api/merchant`

Returns merchant wallet balances and accumulated revenue.

**Response**:
```json
{
  "balances": {
    "arcTestnet": { "address": "0x...", "balance": "12.340000" }
  },
  "revenue": {
    "Arc Testnet": 0.061
  }
}
```

---

### `GET /api/merchant/transactions`

Returns the settlement ledger (all HTLC claims and exact payments).

**Response**:
```json
{
  "transactions": [
    {
      "id": "0xabc...",
      "timestamp": 1740700000000,
      "network": "eip155:5042002",
      "chain": "Arc Testnet",
      "txHash": "0xdef...",
      "amount": "0.001000",
      "payer": "0x...",
      "endpoint": "weather",
      "type": "htlc-claim"
    }
  ]
}
```

### `POST /api/merchant/transactions`

Records a settlement transaction (called internally by the facilitator).

**Request body**: Same shape as individual transaction objects above.

---

## Paywalled Data Endpoints

All endpoints under `/api/provider/*` are protected by the x402 middleware (`createNextMiddleware`). Requests without payment receive `HTTP 402` with payment requirements. Requests with valid payment receive the data.

### 402 Response Format (Direct Scheme)

When requesting without payment, the middleware returns:

```
HTTP/1.1 402 Payment Required
Content-Type: application/json
```

```json
{
  "x402Version": 2,
  "accepts": [
    {
      "scheme": "direct",
      "network": "eip155:5042002",
      "asset": "0x3600000000000000000000000000000000000000",
      "amount": "1000",
      "payTo": "0xMerchantAddress",
      "maxTimeoutSeconds": 60,
      "extra": {
        "transferType": "htlc",
        "hashlock": "0xSHA256...",
        "htlcContract": "0xHTLCAddress",
        "timelockSeconds": 300,
        "protocolVersion": 1
      }
    }
  ]
}
```

### Encrypted Response Format

After successful payment verification (direct scheme), the middleware returns:

```
HTTP/1.1 200 OK
Content-Type: application/json
x-payproof-encrypted: true
```

```json
{
  "encryptedBlob": "base64EncodedCiphertext...",
  "nonce": "a1b2c3d4e5f6a1b2c3d4e5f6",
  "authTag": "0123456789abcdef0123456789abcdef",
  "dataHash": "0xSHA256OfCiphertextBytes..."
}
```

The `EncryptedPayload` fields:
- `encryptedBlob`: Base64-encoded AES-256-GCM ciphertext
- `nonce`: Hex-encoded 12-byte nonce (24 hex characters)
- `authTag`: Hex-encoded 16-byte authentication tag (32 hex characters)
- `dataHash`: `0x`-prefixed SHA-256 hash of the raw ciphertext bytes

---

### `GET /api/provider/weather`

**Price**: $0.001 USDC | **Protected by**: x402 middleware

Returns agricultural weather intelligence data.

**Response** (after payment and decryption):
```json
{
  "type": "weather",
  "timestamp": "2026-02-28T07:00:00.000Z",
  "data": {
    "regions": [
      {
        "name": "US Midwest",
        "temperature": { "current": 72.5, "unit": "F", "trend": "rising" },
        "precipitation": { "last24h": 0.3, "unit": "inches", "forecast": "scattered showers" },
        "humidity": { "current": 65, "unit": "%", "trend": "stable" },
        "wind": { "speed": 12, "unit": "mph", "direction": "SW" },
        "impact": { "crop": "corn", "assessment": "favorable", "risk_level": "low" }
      }
    ]
  }
}
```

---

### `GET /api/provider/markets`

**Price**: $0.01 USDC | **Protected by**: x402 middleware

Returns cryptocurrency market data.

**Response** (after payment and decryption):
```json
{
  "type": "markets",
  "timestamp": "2026-02-28T07:00:00.000Z",
  "data": {
    "prices": {
      "BTC": { "price": 65432.10, "change24h": 2.5, "volume24h": 28000000000 },
      "ETH": { "price": 3456.78, "change24h": -1.2, "volume24h": 15000000000 },
      "SOL": { "price": 145.32, "change24h": 5.1, "volume24h": 3200000000 },
      "USDC": { "price": 1.0001, "change24h": 0.01, "volume24h": 8500000000 }
    },
    "indices": {
      "totalMarketCap": "2.4T",
      "btcDominance": "52.3%",
      "fearGreedIndex": 68
    }
  }
}
```

---

### `GET /api/provider/sentiment`

**Price**: $0.05 USDC | **Protected by**: x402 middleware

Returns AI-powered market sentiment analysis.

**Response** (after payment and decryption):
```json
{
  "type": "sentiment",
  "timestamp": "2026-02-28T07:00:00.000Z",
  "data": {
    "overall": "bullish",
    "confidence": 0.73,
    "signals": [
      { "source": "Social Media", "sentiment": "bullish", "weight": 0.3 },
      { "source": "Whale Activity", "sentiment": "neutral", "weight": 0.25 },
      { "source": "Technical Analysis", "sentiment": "bullish", "weight": 0.25 },
      { "source": "Macro Events", "sentiment": "bearish", "weight": 0.2 }
    ],
    "narratives": [
      "Institutional accumulation detected in BTC",
      "ETF inflows remain steady"
    ]
  }
}
```

---

## Agent Tools

The AI agent has access to 7 tools. Each tool returns a JSON string.

### `check_wallet_balance`

Check USDC balance across all supported chains.

**Input**: None

**Output**:
```json
{
  "chains": [
    {
      "chain": "Base Sepolia",
      "network": "eip155:84532",
      "address": "0x...",
      "usdc_balance": "10.500000",
      "payment_scheme": "exact"
    },
    {
      "chain": "Arc Testnet",
      "network": "eip155:5042002",
      "address": "0x...",
      "usdc_balance": "5.250000",
      "payment_scheme": "direct",
      "note": "USDC is native gas token - no separate gas needed"
    }
  ]
}
```

---

### `list_available_apis`

List the marketplace API catalog with pricing.

**Input**: None

**Output**: Array of API objects with endpoint name, URL, price, description, and supported payment networks.

---

### `fetch_paid_data`

Purchase and fetch data from a paywalled API. Handles the full atomic payment flow: lock → encrypt → confirm → claim → decrypt.

**Input**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `endpoint` | `"weather" \| "markets" \| "sentiment"` | Yes | Which API to call |
| `preferred_network` | `"eip155:5042002" \| "eip155:84532"` | No | Chain to pay on |

**Output** (success):
```json
{
  "success": true,
  "endpoint": "weather",
  "url": "http://localhost:3000/api/provider/weather",
  "status": 200,
  "payment": {
    "amount": "0.001000",
    "symbol": "USDC",
    "chain": "Arc Testnet",
    "network": "eip155:5042002",
    "sender": "0x...",
    "receiver": "0x...",
    "txHash": "0x...",
    "explorerUrl": "https://testnet.arcscan.app/tx/0x...",
    "lockId": "0x...",
    "status": "pending_confirmation"
  },
  "data": { ... }
}
```

**Output** (failure):
```json
{
  "success": false,
  "error": "HTTP 402",
  "endpoint": "weather",
  "message": "Payment failed..."
}
```

---

### `transfer_usdc_arc`

Direct USDC transfer on Arc Testnet.

**Input**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `to` | `string` | Yes | Recipient address (0x...) |
| `amount` | `string` | Yes | Amount in USDC (e.g., "1.00") |

**Output**: `{ success, chain, txHash, amount, to, explorer }`

---

### `check_pending_payments`

Inspect on-chain status of all HTLC locks created this session.

**Input**: None

**Output**:
```json
{
  "locks": [
    {
      "lockId": "0xabc...",
      "network": "eip155:5042002",
      "amount": "0.001000 USDC",
      "localStatus": "locked",
      "onChainState": "Locked",
      "refundable": true,
      "timelockExpiry": "2026-02-28T07:05:00.000Z",
      "timelockExpired": true
    }
  ]
}
```

**On-chain state values**: `Empty`, `Locked`, `DataPosted`, `Confirmed`, `Claimed`, `Refunded`, `Treasury`, `NotFound`, or `error: <message>`.

---

### `refund_expired_lock`

Refund an expired HTLC lock to recover funds.

**Input**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `lock_id` | `string` | Yes | Lock ID (hex) |
| `network` | `"eip155:5042002" \| "eip155:84532"` | Yes | Network of the lock |

**Pre-checks** (returns error if):
- Lock state is not `Locked` (already claimed, refunded, or in another state)
- Timelock has not expired yet (returns seconds remaining)

**Output** (success):
```json
{
  "success": true,
  "chain": "Arc Testnet",
  "lockId": "0xabc...",
  "txHash": "0xdef...",
  "amount": "0.001000 USDC",
  "explorer": "https://testnet.arcscan.app/tx/0xdef..."
}
```

**Output** (not yet expired):
```json
{
  "success": false,
  "error": "Timelock has not expired yet - 142s remaining",
  "lockId": "0xabc...",
  "expiresAt": "2026-02-28T07:05:00.000Z"
}
```
