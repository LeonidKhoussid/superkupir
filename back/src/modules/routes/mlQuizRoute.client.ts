import type { CreateRouteFromQuizBody } from "./routes.schemas";

export type MlQuizRouteResponse = {
  place_ids?: unknown;
  confidence?: unknown;
  rationale?: unknown;
};

export type MlQuizFetchResult = {
  ids: number[];
  /** Для логов: почему пусто или что ответил ML. */
  detail?: string;
};

/**
 * POST JSON на ML `/v1/quiz/route` (Avalin Mini Backend).
 */
export async function fetchMlQuizPlaceIds(
  url: string,
  timeoutMs: number,
  body: Pick<
    CreateRouteFromQuizBody,
    "people_count" | "season" | "budget_from" | "budget_to" | "excursion_type" | "days_count"
  > & { city?: string | null },
): Promise<MlQuizFetchResult> {
  const trimmedUrl = url.trim();
  if (trimmedUrl === "") {
    return { ids: [], detail: "пустой URL" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const payload: Record<string, unknown> = {
      people_count: body.people_count,
      season: body.season,
      budget_from: body.budget_from,
      budget_to: body.budget_to,
      excursion_type: body.excursion_type,
      days_count: body.days_count,
      locale: "ru",
    };

    const city = body.city?.trim();
    if (city) {
      payload.city = city;
    }

    const res = await fetch(trimmedUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      const snippet = text.length > 120 ? `${text.slice(0, 120)}…` : text;
      return { ids: [], detail: `HTTP ${res.status} ${snippet}` };
    }

    const data = (await res.json()) as MlQuizRouteResponse;
    if (!Array.isArray(data.place_ids)) {
      return { ids: [], detail: "в JSON нет массива place_ids" };
    }

    const out: number[] = [];
    for (const x of data.place_ids) {
      const n = typeof x === "number" ? x : typeof x === "string" ? Number(x) : NaN;
      if (Number.isInteger(n) && n > 0) {
        out.push(n);
      }
    }
    return { ids: out, detail: `OK, ${out.length} id` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ids: [], detail: msg.includes("abort") ? `таймаут ${timeoutMs}ms` : msg };
  } finally {
    clearTimeout(timer);
  }
}
