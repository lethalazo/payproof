import { NextResponse } from "next/server";
import { generateSentimentData } from "@/lib/providers";

export async function GET() {
  return NextResponse.json(generateSentimentData());
}
