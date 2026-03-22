import { randomUUID } from "node:crypto";
import { z } from "zod";

const mlOkSchema = z.object({
  place_ids: z.array(z.coerce.number().int().positive()),
  confidence: z.number().optional(),
  rationale: z.string().optional(),
});

export type QuizRouteMlEnv = {
  QUIZ_ROUTE_ML_BASE_URL?: string | undefined;
  QUIZ_ROUTE_ML_AUTHORIZATION?: string | undefined;
};

export type QuizRouteMlRequestBody = {
  people_count: number;
  season: string;
  budget_from: number;
  budget_to: number;
  excursion_type: string;
  days_count: number;
  /** Город края или `__any__` — если внешний сервис поддерживает. */
  preferred_city?: string;
  request_id?: string;
  locale?: string;
};

const REQUEST_TIMEOUT_MS = 25_000;

/**
 * Вызывает внешний ML-сервис квиз→маршрут. Возвращает null, если URL не задан или запрос неуспешен.
 */
export async function fetchQuizRoutePlaceIds(
  cfg: QuizRouteMlEnv,
  body: QuizRouteMlRequestBody,
): Promise<number[] | null> {
  const base = cfg.QUIZ_ROUTE_ML_BASE_URL?.trim();
  if (!base) {
    return null;
  }

  const url = `${base.replace(/\/+$/, "")}/v1/quiz/route`;
  const requestId = body.request_id?.trim() || randomUUID();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "x-request-id": requestId,
  };
  const auth = cfg.QUIZ_ROUTE_ML_AUTHORIZATION?.trim();
  if (auth) {
    headers.authorization = auth;
  }

  const payload: Record<string, unknown> = {
    people_count: body.people_count,
    season: body.season,
    budget_from: body.budget_from,
    budget_to: body.budget_to,
    excursion_type: body.excursion_type,
    days_count: body.days_count,
  };
  const pc = body.preferred_city?.trim();
  if (pc != null && pc !== "") {
    payload.preferred_city = pc;
  }
  if (body.request_id != null && body.request_id.trim() !== "") {
    payload.request_id = body.request_id.trim();
  }
  if (body.locale != null && body.locale.trim() !== "") {
    payload.locale = body.locale.trim();
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    console.warn(
      "[quiz-route-ml] fetch failed (network/timeout)",
      err instanceof Error ? err.message : err,
    );
    return null;
  }

  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    console.warn("[quiz-route-ml] non-JSON body, status=", res.status, text.slice(0, 300));
    return null;
  }

  if (res.status === 422) {
    console.warn("[quiz-route-ml] upstream 422 (unsatisfiable)", JSON.stringify(json).slice(0, 500));
    return null;
  }

  if (!res.ok) {
    console.warn("[quiz-route-ml] upstream error", res.status, text.slice(0, 500));
    return null;
  }

  const parsed = mlOkSchema.safeParse(json);
  if (!parsed.success || parsed.data.place_ids.length === 0) {
    console.warn(
      "[quiz-route-ml] invalid 200 body (expected place_ids)",
      parsed.success ? "empty place_ids" : parsed.error.flatten(),
    );
    return null;
  }

  const ids = dedupePositiveIdsInOrder(parsed.data.place_ids);
  console.info("[quiz-route-ml] ok, place_ids count=", ids.length);
  return ids;
}

function dedupePositiveIdsInOrder(ids: number[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const id of ids) {
    if (!Number.isFinite(id) || id <= 0) {
      continue;
    }
    const n = Math.trunc(id);
    if (seen.has(n)) {
      continue;
    }
    seen.add(n);
    out.push(n);
  }
  return out;
}
