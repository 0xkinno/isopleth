// E4 (window-set slice): build the closed-market window set from the NYSE
// calendar, since the rToken margin launch date (2026-06-04, F5). Pure
// calendar arithmetic - no network, no Bitget dependency - so this runs
// regardless of the connectivity issue affecting the live-data scripts.
//
// Each "window" is a maximal run of consecutive non-trading days (a weekend,
// a holiday, or a holiday adjacent to a weekend) bounded by the last trading
// day before it (freeze candidate) and the first trading day after it (thaw
// candidate). This only states calendar facts; it does NOT yet claim a freeze
// or thaw was observed there - that is E1's job, which can only speak for
// windows that occur while the recorder is running.
import { mkdir, readFile, writeFile } from "node:fs/promises";

const LAUNCH_DATE = "2026-06-04"; // rToken margin launch, F5
const HORIZON_END = "2026-12-31"; // end of the 2026 calendar year covered by nyse-2026.json

interface Calendar {
  source: string;
  fetchedAt: string;
  year: number;
  fullClosures: Array<{ date: string; name: string }>;
  earlyCloses_1pmET: Array<{ date: string; name: string }>;
}

function* dateRange(startIso: string, endIso: string): Generator<string> {
  const d = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  while (d <= end) {
    yield d.toISOString().slice(0, 10);
    d.setUTCDate(d.getUTCDate() + 1);
  }
}

function isWeekend(iso: string): boolean {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

async function main() {
  const calendar = JSON.parse(await readFile("data/calendar/nyse-2026.json", "utf8")) as Calendar;
  const holidaySet = new Set(calendar.fullClosures.map((h) => h.date));
  const earlyCloseSet = new Set(calendar.earlyCloses_1pmET.map((h) => h.date));
  const holidayName = new Map(calendar.fullClosures.map((h) => [h.date, h.name]));

  const isTradingDay = (iso: string) => !isWeekend(iso) && !holidaySet.has(iso);

  const allDates = [...dateRange(LAUNCH_DATE, HORIZON_END)];

  type Window = {
    id: string;
    freezeStart: string; // last trading day before the closed run
    thawDate: string; // first trading day after the closed run
    nonTradingDates: string[];
    holidaysInvolved: string[];
    freezeStartIsEarlyClose: boolean;
    kind: "weekend" | "holiday-adjacent-weekend" | "midweek-holiday";
  };

  const windows: Window[] = [];
  let i = 0;
  while (i < allDates.length) {
    const d = allDates[i]!;
    if (isTradingDay(d)) {
      i += 1;
      continue;
    }
    // start of a non-trading run
    const runStart = i;
    while (i < allDates.length && !isTradingDay(allDates[i]!)) i += 1;
    const runDates = allDates.slice(runStart, i);

    // find the trading day immediately before runStart (may be before LAUNCH_DATE's window; walk back from launch date itself if needed)
    let beforeIdx = runStart - 1;
    let freezeStart: string | null = beforeIdx >= 0 ? allDates[beforeIdx]! : null;
    while (freezeStart !== null && !isTradingDay(freezeStart)) {
      beforeIdx -= 1;
      freezeStart = beforeIdx >= 0 ? allDates[beforeIdx]! : null;
    }

    const thawDate = i < allDates.length ? allDates[i]! : null;
    if (freezeStart === null || thawDate === null) {
      // window runs off the edge of our horizon - skip, cannot bound it cleanly
      continue;
    }

    const holidaysInvolved = runDates.filter((x) => holidaySet.has(x)).map((x) => holidayName.get(x)!);
    const kind: Window["kind"] =
      holidaysInvolved.length === 0 ? "weekend" : runDates.length > 2 ? "holiday-adjacent-weekend" : "midweek-holiday";

    windows.push({
      id: `${freezeStart}_to_${thawDate}`,
      freezeStart,
      thawDate,
      nonTradingDates: runDates,
      holidaysInvolved,
      freezeStartIsEarlyClose: earlyCloseSet.has(freezeStart),
      kind,
    });
  }

  await mkdir("data/windows", { recursive: true });
  await writeFile(
    "data/windows/window-set.json",
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        launchDate: LAUNCH_DATE,
        horizonEnd: HORIZON_END,
        calendarSource: calendar.source,
        windowCount: windows.length,
        windows,
      },
      null,
      2,
    ),
  );

  console.log(`[e4] built ${windows.length} closed-market window(s) from ${LAUNCH_DATE} to ${HORIZON_END}`);
  console.log(`[e4] -> data/windows/window-set.json`);
  console.log(
    "[e4] NOTE: this is the calendar scaffold only. G_w (log reference-print ratio) per window requires " +
      "candle data fetched per window - that is a separate replay step (pnpm discovery:e4:replay, not yet built) " +
      "and can only be run once live Bitget connectivity is confirmed.",
  );
}

main().catch((e) => {
  console.error("[e4] fatal:", e);
  process.exitCode = 1;
});
