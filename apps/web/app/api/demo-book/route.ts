import { NextResponse } from "next/server";
import { demoBook } from "../../../lib/demoBook";

export function GET() {
  return NextResponse.json(demoBook());
}
