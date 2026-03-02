import { NextResponse } from "next/server";
import { generateMarketsData } from "@/lib/providers";

export async function GET() {
  return NextResponse.json(generateMarketsData());
}
