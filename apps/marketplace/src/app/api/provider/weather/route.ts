import { NextResponse } from "next/server";
import { generateWeatherData } from "@/lib/providers";

export async function GET() {
  return NextResponse.json(generateWeatherData());
}
