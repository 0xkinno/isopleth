import { NextResponse } from "next/server";
import { ask } from "../../../lib/ask";
import { validateBook } from "../../../lib/bookValidate";

export async function POST(req: Request) {
  let body: { question?: unknown; book?: unknown; thesis?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "request body must be valid JSON" }, { status: 400 });
  }
  if (typeof body.question !== "string" || body.question.trim().length === 0) {
    return NextResponse.json({ ok: false, error: "question is required (a short sentence)" }, { status: 400 });
  }
  let book: Record<string, unknown> | null = null;
  if (body.book !== undefined && body.book !== null) {
    const v = validateBook(body.book);
    if (!v.ok) return NextResponse.json({ ok: false, error: `invalid book: ${v.errors.join("; ")}` }, { status: 400 });
    book = body.book as Record<string, unknown>;
  }
  try {
    return NextResponse.json(await ask(body.question, book, typeof body.thesis === "string" ? body.thesis : ""));
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
