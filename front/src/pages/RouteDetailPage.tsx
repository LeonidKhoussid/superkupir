import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { LoginButton } from "../components/LoginButton";
import { RouteAddStopModal } from "../components/RouteAddStopModal";
import {
  RouteYandexMap,
  type RouteMapMetrics,
} from "../components/RouteYandexMap";
import brandLogo from "../assets/brand-logo.svg";
import { useAuthStore } from "../features/auth/authStore";
import {
  getPrimaryDisplayPhotoUrl,
  type PublicPlace,
} from "../features/places/placesApi";
import {
  newClientRouteStop,
  stopsFromUserRoute,
  type EditableRouteStop,
} from "../features/routes/editableRouteStops";
import {
  buildPublicRouteShareUrl,
  deriveBudgetFallback,
  deriveRouteDurationDays,
  deriveSeasonLabelFromPlaces,
  formatSeasonSlugLabel,
  isHospitalityTypeSlug,
} from "../features/routes/routeReviewHelpers";
import { syncRouteStopsToServer } from "../features/routes/syncRouteStopsToServer";
import {
  createRouteShareLink,
  fetchUserRouteById,
  RoutesApiError,
  type UserRouteDetail,
} from "../features/routes/routesApi";
import { useQuizStore } from "../features/quiz/quizStore";

const yandexKey = import.meta.env.VITE_YANDEX_MAPS_API_KEY as
  | string
  | undefined;

function typeSlugLabel(slug: string | null): string {
  if (!slug) return "";

  const map: Record<string, string> = {
    hotel: "Гостиница",
    guest_house: "Гостевой дом",
    recreation_base: "База отдыха",
    restaurant: "Ресторан",
    gastro: "Гастрономия",
    cheese: "Сыроварня",
    winery: "Винодельня",
    park: "Парк",
    museum: "Музей",
    farm: "Ферма",
    mountain: "Горы",
    event: "Событие",
  };

  return map[slug] ?? slug.replace(/_/g, " ");
}

function creationModeLabel(mode: string): string {
  switch (mode) {
    case "quiz":
      return "Квиз";
    case "selection_builder":
      return "Подбор мест";
    case "shared_copy":
      return "Общая копия";
    case "manual":
      return "Ручной";
    default:
      return mode;
  }
}

function accessTypeLabel(accessType: string): string {
  switch (accessType) {
    case "owner":
      return "Владелец";
    case "collaborator":
      return "Совместное редактирование";
    case "viewer":
      return "Только просмотр";
    case "shared":
      return "Открыт по ссылке";
    default:
      return accessType;
  }
}

function formatMoney(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  return `${Math.round(value).toLocaleString("ru-RU")} ₽`;
}

function formatDistance(
  distanceKm: number | null,
  source: RouteMapMetrics["source"],
): string {
  if (distanceKm == null || !Number.isFinite(distanceKm)) {
    return "—";
  }

  const rounded =
    distanceKm >= 100 ? Math.round(distanceKm) : Number(distanceKm.toFixed(1));
  const prefix = source === "polyline-fallback" ? "≈ " : "";
  return `${prefix}${rounded.toLocaleString("ru-RU")} км`;
}

function formatDate(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(parsed));
}

function formatDayCountLabel(days: number): string {
  const mod10 = days % 10;
  const mod100 = days % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return `${days} день`;
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${days} дня`;
  }
  return `${days} дней`;
}

function placeIdsSignature(stops: EditableRouteStop[]): string {
  return JSON.stringify(stops.map((stop) => stop.place.id));
}

async function copyTextToClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function BadIdView() {
  return (
    <div className="min-h-dvh bg-[#e8f4fc] px-5 py-16 text-center">
      <p className="font-display text-lg font-bold text-neutral-800">
        Некорректная ссылка
      </p>
      <Link
        to="/places"
        className="mt-6 inline-block rounded-full bg-kr-blue px-8 py-3 font-bold text-white">
        К каталогу мест
      </Link>
    </div>
  );
}

function AuthWall() {
  return (
    <div className="min-h-dvh bg-[#e8f4fc] px-5 py-16 text-center">
      <p className="font-display text-lg font-bold text-neutral-800">
        Войдите, чтобы просмотреть и сохранить маршрут.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <LoginButton variant="on-catalog" />
        <Link
          to="/places"
          className="inline-flex min-h-11 items-center rounded-full border border-kr-blue bg-white px-8 font-bold text-kr-blue">
          К каталогу
        </Link>
      </div>
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "accent";
}) {
  return (
    <div
      className={
        tone === "accent"
          ? "rounded-2xl border border-kr-blue/20 bg-kr-blue/10 p-4"
          : "rounded-2xl border border-sky-200/80 bg-white/75 p-4"
      }>
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-500">
        {label}
      </p>
      <p className="mt-2 font-display text-[18px] font-bold uppercase leading-tight text-neutral-900">
        {value}
      </p>
    </div>
  );
}

function ShareModal({
  open,
  shareUrl,
  phase,
  message,
  collaborativeEdit,
  onClose,
  onCopy,
}: {
  open: boolean;
  shareUrl: string | null;
  phase: "idle" | "creating" | "ready" | "error";
  message: string | null;
  /** Соответствует `can_edit` у созданной ссылки: совместное редактирование одного маршрута по `revision_number`. */
  collaborativeEdit: boolean;
  onClose: () => void;
  onCopy: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/55"
        aria-label="Закрыть окно шаринга"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-lg rounded-[28px] border border-sky-200/80 bg-white p-6 shadow-2xl shadow-sky-950/20">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-kr-blue">
              Поделиться
            </p>
            <h2 className="font-display mt-2 text-[24px] font-bold uppercase leading-tight text-neutral-900">
              Ссылка на маршрут
            </h2>
          </div>
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-full text-[22px] leading-none text-neutral-500 hover:bg-neutral-100"
            onClick={onClose}
            aria-label="Закрыть">
            ×
          </button>
        </div>

        <p className="mt-3 text-[14px] leading-relaxed text-neutral-600">
          Ссылка ведёт на страницу приложения (не на API). Получатель откроет тот же маршрут на сервере; после
          входа сможет добавить его к себе и редактировать на экране «Мои туры» → маршрут, если ссылка это
          разрешает.
        </p>

        {collaborativeEdit && shareUrl ? (
          <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-[13px] leading-relaxed text-emerald-950">
            <span className="font-bold">Совместное редактирование.</span> По ссылке можно не только смотреть
            маршрут, но и сохранять правки того же маршрута. Изменения не синхронизируются в реальном времени:
            при сохранении проверяется версия; если кто-то уже сохранил новее, нужно загрузить актуальные данные с
            сервера.
          </p>
        ) : null}

        {phase === "creating" ? (
          <p className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-[14px] text-neutral-700">
            Готовим ссылку…
          </p>
        ) : null}

        {phase === "error" ? (
          <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-800">
            {message ?? "Не удалось подготовить ссылку."}
          </p>
        ) : null}

        {shareUrl ? (
          <div className="mt-5 rounded-2xl border border-sky-200/80 bg-slate-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-500">
              Ссылка
            </p>
            <p className="mt-2 break-all text-[13px] leading-relaxed text-neutral-700">
              {shareUrl}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                className="inline-flex min-h-11 items-center rounded-full bg-kr-blue px-5 text-[13px] font-bold uppercase tracking-wide text-white hover:brightness-105"
                onClick={onCopy}>
                Скопировать
              </button>
            </div>
          </div>
        ) : null}

        {message && phase !== "error" ? (
          <p className="mt-4 text-[13px] text-neutral-600">{message}</p>
        ) : null}
      </div>
    </div>
  );
}

function RoutePointCard({
  stop,
  overallIndex,
  totalStops,
  editable,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  stop: EditableRouteStop;
  overallIndex: number;
  totalStops: number;
  editable: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const photo = getPrimaryDisplayPhotoUrl(stop.place);
  const description =
    stop.place.short_description ??
    stop.place.description ??
    stop.place.source_location;

  return (
    <li className="rounded-[24px] border border-sky-200/80 bg-white p-4 shadow-sm shadow-sky-900/5">
      <div className="flex gap-3">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-kr-blue text-[15px] font-bold text-white"
          aria-hidden>
          {overallIndex + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Link
                to={`/places/${stop.place.id}`}
                className="font-display text-[16px] font-bold uppercase leading-tight tracking-wide text-neutral-900 underline-offset-2 hover:text-kr-blue hover:underline">
                {stop.place.name}
              </Link>
              {stop.place.type_slug ? (
                <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-kr-blue/80">
                  {typeSlugLabel(stop.place.type_slug)}
                </p>
              ) : null}
            </div>
            {photo ? (
              <img
                src={photo}
                alt=""
                className="size-20 shrink-0 rounded-2xl object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <span className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-[11px] font-semibold uppercase tracking-wide text-sky-700">
                Без фото
              </span>
            )}
          </div>

          {description ? (
            <p className="mt-3 line-clamp-3 text-[13px] leading-relaxed text-neutral-600">
              {description}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2 text-[12px] text-neutral-500">
            {stop.place.source_location ? (
              <span className="rounded-full bg-sky-50 px-3 py-1">
                {stop.place.source_location}
              </span>
            ) : null}
            {stop.place.address ? (
              <span className="rounded-full bg-slate-100 px-3 py-1">
                {stop.place.address}
              </span>
            ) : null}
            {stop.serverRoutePlaceId == null ? (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-900">
                Новая точка — будет сохранена на сервере
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-sky-100 pt-4">
        <Link
          to={`/places/${stop.place.id}`}
          className="inline-flex min-h-10 items-center rounded-full border border-neutral-300 bg-white px-4 text-[12px] font-bold uppercase tracking-wide text-neutral-800 hover:bg-neutral-50">
          Открыть место
        </Link>

        {editable ? (
          <>
            <button
              type="button"
              className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-neutral-300 bg-white px-3 text-[13px] font-bold text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-35"
              onClick={onMoveUp}
              disabled={overallIndex === 0}
              aria-label="Переместить выше">
              ↑
            </button>
            <button
              type="button"
              className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-neutral-300 bg-white px-3 text-[13px] font-bold text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-35"
              onClick={onMoveDown}
              disabled={overallIndex >= totalStops - 1}
              aria-label="Переместить ниже">
              ↓
            </button>
            <button
              type="button"
              className="ml-auto inline-flex min-h-10 items-center rounded-full border border-red-200 bg-red-50 px-4 text-[12px] font-bold uppercase tracking-wide text-red-800 hover:bg-red-100"
              onClick={onRemove}>
              Убрать
            </button>
          </>
        ) : null}
      </div>
    </li>
  );
}

function RouteReviewLoaded({ id }: { id: number }) {
  const token = useAuthStore((state) => state.token);
  const peopleCount = useQuizStore((state) => state.peopleCount);

  const [phase, setPhase] = useState<"loading" | "ok" | "error">("loading");
  const [route, setRoute] = useState<UserRouteDetail | null>(null);
  const [message, setMessage] = useState("");
  const [editorStops, setEditorStops] = useState<EditableRouteStop[]>([]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [baselineSig, setBaselineSig] = useState<string | null>(null);
  const [savePhase, setSavePhase] = useState<
    "idle" | "saving" | "saved" | "error" | "conflict"
  >("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [sharePhase, setSharePhase] = useState<
    "idle" | "creating" | "ready" | "error"
  >("idle");
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCollaborative, setShareCollaborative] = useState(false);
  const [mapMetrics, setMapMetrics] = useState<RouteMapMetrics>({
    distanceKm: null,
    durationMinutes: null,
    source: "insufficient-points",
  });

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    void fetchUserRouteById(token, id)
      .then((loadedRoute) => {
        if (cancelled) return;
        setRoute(loadedRoute);
        const initialStops = stopsFromUserRoute(loadedRoute);
        setEditorStops(initialStops);
        setBaselineSig(placeIdsSignature(initialStops));
        setPhase("ok");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setMessage(
          error instanceof RoutesApiError
            ? error.message
            : "Не удалось загрузить маршрут.",
        );
        setPhase("error");
      });

    return () => {
      cancelled = true;
    };
  }, [id, token]);

  const orderedPlaces = useMemo(
    () => editorStops.map((stop) => stop.place),
    [editorStops],
  );
  const canEditRoute = route != null && route.access_type !== "viewer";
  const existingPlaceIds = useMemo(
    () => new Set(editorStops.map((stop) => stop.place.id)),
    [editorStops],
  );
  const isDirty = useMemo(() => {
    if (baselineSig == null) return false;
    return placeIdsSignature(editorStops) !== baselineSig;
  }, [baselineSig, editorStops]);

  const groupedStops = useMemo(() => {
    const mainStops: { stop: EditableRouteStop; overallIndex: number }[] = [];
    const hospitalityStops: {
      stop: EditableRouteStop;
      overallIndex: number;
    }[] = [];

    editorStops.forEach((stop, overallIndex) => {
      if (isHospitalityTypeSlug(stop.place.type_slug)) {
        hospitalityStops.push({ stop, overallIndex });
      } else {
        mainStops.push({ stop, overallIndex });
      }
    });

    return { mainStops, hospitalityStops };
  }, [editorStops]);

  const derivedDurationDays = useMemo(
    () => deriveRouteDurationDays(orderedPlaces),
    [orderedPlaces],
  );
  const derivedBudget = useMemo(
    () => deriveBudgetFallback(orderedPlaces),
    [orderedPlaces],
  );
  const seasonText = route?.season_slug
    ? formatSeasonSlugLabel(route.season_slug)
    : (deriveSeasonLabelFromPlaces(orderedPlaces) ?? "—");

  const sharedWithText = shareUrl
    ? "Есть активная ссылка доступа"
    : route?.access_type && route.access_type !== "owner"
      ? "Маршрут открыт по совместному доступу"
      : "Пока ни с кем не поделились";

  const summaryDescription =
    route?.description?.trim() ||
    "Проверьте маршрут на карте, разделите основные точки и места для отдыха, затем сохраните итоговый план.";

  const resetToLoaded = useCallback(() => {
    if (!route) return;
    const initialStops = stopsFromUserRoute(route);
    setEditorStops(initialStops);
    setBaselineSig(placeIdsSignature(initialStops));
    setSaveMessage(null);
    setSavePhase("idle");
  }, [route]);

  const removeAt = useCallback((index: number) => {
    setEditorStops((current) =>
      current.filter((_, currentIndex) => currentIndex !== index),
    );
    setSaveMessage(null);
    setSavePhase("idle");
  }, []);

  const moveStop = useCallback((from: number, to: number) => {
    setEditorStops((current) => {
      if (to < 0 || to >= current.length) return current;
      const next = current.slice();
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setSaveMessage(null);
    setSavePhase("idle");
  }, []);

  const addStop = useCallback((place: PublicPlace) => {
    setEditorStops((current) => {
      if (current.some((stop) => stop.place.id === place.id)) {
        return current;
      }

      return [...current, newClientRouteStop(place)];
    });
    setSaveMessage(null);
    setSavePhase("idle");
  }, []);

  const handleSave = useCallback(async () => {
    if (!token || !route) return;

    if (!canEditRoute) {
      setSavePhase("error");
      setSaveMessage("Текущий доступ не позволяет редактировать маршрут.");
      return;
    }

    if (!isDirty) {
      setSavePhase("saved");
      setSaveMessage("Маршрут уже сохранён.");
      return;
    }

    setSavePhase("saving");
    setSaveMessage(null);

    try {
      const syncedRoute = await syncRouteStopsToServer(
        token,
        route,
        editorStops,
      );
      const syncedStops = stopsFromUserRoute(syncedRoute);
      setRoute(syncedRoute);
      setEditorStops(syncedStops);
      setBaselineSig(placeIdsSignature(syncedStops));
      setSavePhase("saved");
      setSaveMessage("Маршрут сохранён на сервере.");
    } catch (error) {
      const isConflict =
        error instanceof RoutesApiError && error.status === 409;
      setSavePhase("error");
      setSaveMessage(
        isConflict
          ? "Маршрут изменился в другой сессии. Обновите страницу и повторите сохранение."
          : error instanceof RoutesApiError
            ? error.message
            : "Не удалось сохранить маршрут.",
      );
    }
  }, [canEditRoute, editorStops, isDirty, route, token]);

  const handleShare = useCallback(async () => {
    if (!token || !route) return;

    if (!canEditRoute) {
      setSharePhase("error");
      setShareMessage(
        "Текущий доступ не позволяет создать ссылку для маршрута.",
      );
      setShareModalOpen(true);
      return;
    }

    setShareModalOpen(true);

    if (shareUrl) {
      setSharePhase("ready");
      setShareMessage("Ссылка уже готова — можно копировать или открыть.");
      return;
    }

    setSharePhase("creating");
    setShareMessage(null);

    try {
      const link = await createRouteShareLink(token, route.id, {
        can_edit: true,
      });
      const nextShareUrl = buildPublicRouteShareUrl(link.token);
      setShareUrl(nextShareUrl);
      setShareCollaborative(link.can_edit);
      setSharePhase("ready");

      const copied = await copyTextToClipboard(nextShareUrl);
      setShareMessage(
        copied
          ? "Ссылка создана и скопирована в буфер обмена."
          : "Ссылка создана. Если буфер недоступен, скопируйте её вручную.",
      );
    } catch (error) {
      setSharePhase("error");
      setShareMessage(
        error instanceof RoutesApiError
          ? error.message
          : "Не удалось создать ссылку.",
      );
    }
  }, [canEditRoute, route, shareUrl, token]);

  const handleCopyShareLink = useCallback(() => {
    if (!shareUrl) return;

    void copyTextToClipboard(shareUrl).then((copied) => {
      setShareMessage(
        copied
          ? "Ссылка снова скопирована."
          : "Не удалось скопировать ссылку автоматически.",
      );
    });
  }, [shareUrl]);

  if (phase === "loading") {
    return (
      <div className="min-h-dvh bg-[#e8f4fc] px-5 py-16">
        <div className="mx-auto max-w-6xl animate-pulse space-y-4">
          <div className="h-10 w-2/3 rounded-lg bg-slate-200" />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,420px)]">
            <div className="h-72 rounded-3xl bg-slate-200 lg:h-[min(78vh,720px)]" />
            <div className="space-y-4">
              <div className="h-52 rounded-3xl bg-slate-200" />
              <div className="h-64 rounded-3xl bg-slate-200" />
              <div className="h-48 rounded-3xl bg-slate-200" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="min-h-dvh bg-[#e8f4fc] px-5 py-16 text-center">
        <p className="font-display text-lg font-bold text-red-800">Ошибка</p>
        <p className="mt-2 text-neutral-600">{message}</p>
        <Link
          to="/myroutes"
          className="mt-8 inline-block rounded-full bg-kr-blue px-8 py-3 font-bold text-white">
          К моим турам
        </Link>
      </div>
    );
  }

  if (!route) return null;

  return (
    <div className="min-h-dvh bg-[#e8f4fc] text-neutral-900 lg:flex lg:h-dvh lg:flex-col">
      <RouteAddStopModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        existingPlaceIds={existingPlaceIds}
        onPick={addStop}
      />
      <ShareModal
        open={shareModalOpen}
        shareUrl={shareUrl}
        phase={sharePhase}
        message={shareMessage}
        collaborativeEdit={shareCollaborative}
        onClose={() => setShareModalOpen(false)}
        onCopy={handleCopyShareLink}
      />

      <header className="shrink-0 border-b border-sky-200/70 bg-white/95 px-4 py-3 backdrop-blur-md sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-5">
            <Link
              to="/myroutes"
              className="shrink-0 text-[13px] font-semibold text-kr-blue underline-offset-2 hover:underline">
              ← Мои туры
            </Link>
            <Link
              to="/"
              className="flex shrink-0 items-center gap-2"
              aria-label="Край Тур — на главную">
              <img
                src={brandLogo}
                alt=""
                className="h-8 w-auto object-contain sm:h-9"
              />
              <span className="font-display hidden text-[14px] font-bold uppercase tracking-wide text-kr-blue sm:inline">
                Край Тур
              </span>
            </Link>
          </div>
          <LoginButton variant="on-catalog" />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1480px] flex-1 min-h-0 flex-col gap-6 px-4 py-4 sm:px-8 lg:grid lg:h-full lg:min-h-0 lg:max-h-full lg:grid-cols-[minmax(0,1.18fr)_minmax(360px,450px)] lg:grid-rows-[minmax(0,1fr)] lg:gap-6 lg:overflow-hidden lg:px-10 lg:py-6">
        <section className="min-w-0 w-full lg:min-h-0 lg:overflow-y-auto lg:pr-1">
          <div className="flex flex-col overflow-hidden rounded-[32px] border border-sky-200/70 bg-white/85 p-3 shadow-[0_30px_80px_-40px_rgba(3,105,161,0.5)] backdrop-blur-sm">
            <div className="shrink-0 rounded-[26px] bg-white p-3">
              <div className="h-[clamp(220px,60vh,720px)] w-full">
                <RouteYandexMap
                  compact
                  orderedPlaces={orderedPlaces}
                  apiKey={yandexKey}
                  onMetricsChange={setMapMetrics}
                />
              </div>
            </div>

            <div className="shrink-0 border-t border-sky-100/90 px-3 py-4 sm:px-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-kr-blue">
                Действия
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Link
                  to={`/routes/${id}/panorama`}
                  className="inline-flex min-h-12 items-center rounded-full border border-kr-blue/20 bg-kr-blue/10 px-5 text-[12px] font-bold uppercase tracking-wide text-kr-blue hover:bg-kr-blue/15 sm:px-6 sm:text-[13px]">
                  360 / Панорама
                </Link>
                <button
                  type="button"
                  className="inline-flex min-h-12 items-center rounded-full bg-kr-blue px-5 text-[12px] font-bold uppercase tracking-wide text-white hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55 sm:px-6 sm:text-[13px]"
                  onClick={() => void handleSave()}
                  disabled={!canEditRoute || savePhase === "saving"}>
                  {savePhase === "saving"
                    ? "Сохраняем…"
                    : isDirty
                      ? "Сохранить маршрут"
                      : savePhase === "conflict"
                        ? "Сохранить маршрут"
                        : "Маршрут сохранён"}
                </button>
                <button
                  type="button"
                  className="inline-flex min-h-12 items-center rounded-full border border-neutral-300 bg-white px-5 text-[12px] font-bold uppercase tracking-wide text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-55 sm:px-6 sm:text-[13px]"
                  onClick={() => void handleShare()}
                  disabled={!canEditRoute || sharePhase === "creating"}>
                  {sharePhase === "creating" ? "Готовим ссылку…" : "Поделиться"}
                </button>
              </div>

              {saveMessage ? (
                <p
                  className={
                    savePhase === "error"
                      ? "mt-3 text-[13px] text-red-700"
                      : "mt-3 text-[13px] text-neutral-600"
                  }>
                  {saveMessage}
                </p>
              ) : null}

              <p className="mt-3 text-[13px] leading-relaxed text-neutral-500">
                Панорама открывается на отдельной странице: список всех точек и просмотр через Google Street View по
                координатам каждой остановки.
              </p>

              {!canEditRoute ? (
                <p className="mt-3 text-[13px] leading-relaxed text-neutral-500">
                  У текущего доступа только просмотр, поэтому редактирование и
                  шаринг на этой странице отключены.
                </p>
              ) : (
                <p className="mt-3 text-[13px] leading-relaxed text-neutral-500">
                  Сначала правьте точки в колонке справа, затем сохраните итоговый порядок и состав на сервере.
                  {route.access_type === "collaborator" ? (
                    <>
                      {" "}
                      У вас совместный доступ: другой участник может сохранить изменения раньше — тогда появится
                      конфликт версий, и нужно будет подтянуть данные с сервера без потери смысла правок (повторить
                      их после загрузки).
                    </>
                  ) : null}
                </p>
              )}
            </div>
          </div>
        </section>

        <aside className="flex min-h-0 w-full min-w-0 flex-col gap-4 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
          <section className="shrink-0 rounded-[32px] border border-sky-200/80 bg-white/95 p-6 shadow-[0_24px_64px_-40px_rgba(15,23,42,0.5)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-kr-blue">
                  {creationModeLabel(route.creation_mode)}
                </p>
                <h1 className="font-display mt-2 text-[clamp(1.4rem,4vw,2.05rem)] font-bold uppercase leading-tight text-neutral-900">
                  {route.title}
                </h1>
                <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-neutral-600">
                  {summaryDescription}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-[12px] text-neutral-500">
                  <span className="rounded-full bg-slate-100 px-3 py-1">
                    Создан {formatDate(route.created_at)}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1">
                    Доступ: {accessTypeLabel(route.access_type)}
                  </span>
                  {isDirty ? (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-900">
                      Есть несохранённые правки
                    </span>
                  ) : null}
                </div>
              </div>
              {canEditRoute ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center rounded-full border border-neutral-300 bg-white px-5 text-[12px] font-bold uppercase tracking-wide text-neutral-800 hover:bg-neutral-50"
                    onClick={() => setAddModalOpen(true)}>
                    Добавить точку
                  </button>
                  {isDirty ? (
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center rounded-full border border-neutral-300 bg-white px-5 text-[12px] font-bold uppercase tracking-wide text-neutral-800 hover:bg-neutral-50"
                      onClick={resetToLoaded}>
                      Сбросить
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {route.creation_mode === "quiz" ? (
                <SummaryMetric
                  label="Группа"
                  value={peopleCount != null ? `${peopleCount} чел.` : "—"}
                />
              ) : null}
              <SummaryMetric
                label="Длительность"
                value={formatDayCountLabel(derivedDurationDays)}
                tone="accent"
              />
              <SummaryMetric
                label="Бюджет"
                value={formatMoney(route.total_estimated_cost ?? derivedBudget)}
              />
              <SummaryMetric label="Сезон" value={seasonText} />
              <SummaryMetric
                label="Маршрут"
                value={
                  orderedPlaces.length >= 2 && mapMetrics.distanceKm == null
                    ? "Считаем…"
                    : formatDistance(mapMetrics.distanceKm, mapMetrics.source)
                }
              />
              <SummaryMetric label="Поделились с" value={sharedWithText} />
            </div>

            {mapMetrics.source === "polyline-fallback" &&
            orderedPlaces.length >= 2 ? (
              <p className="mt-4 text-[12px] leading-relaxed text-neutral-500">
                Яндекс-маршрут сейчас не отдал дорожную длину, поэтому в сводке
                показана приблизительная дистанция между точками.
              </p>
            ) : null}
          </section>

          <section className="shrink-0 rounded-[32px] border border-sky-200/80 bg-white/95 p-6 shadow-[0_24px_64px_-40px_rgba(15,23,42,0.45)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-kr-blue">
                  Основные точки
                </p>
                <h2 className="font-display mt-2 text-[20px] font-bold uppercase text-neutral-900">
                  Маршрут дня
                </h2>
              </div>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-[12px] font-semibold text-sky-800">
                {groupedStops.mainStops.length}
              </span>
            </div>

            {groupedStops.mainStops.length === 0 ? (
              <p className="mt-5 rounded-2xl border border-dashed border-sky-300 bg-sky-50/70 px-4 py-6 text-[14px] text-neutral-600">
                Главные точки пока не выбраны. Добавьте места в маршрут, чтобы
                появилось основное путешествие.
              </p>
            ) : (
              <div className="mt-5 min-h-[12rem]">
                <ul className="space-y-3">
                  {groupedStops.mainStops.map(({ stop, overallIndex }) => (
                    <RoutePointCard
                      key={stop.key}
                      stop={stop}
                      overallIndex={overallIndex}
                      totalStops={editorStops.length}
                      editable={Boolean(canEditRoute)}
                      onMoveUp={() => moveStop(overallIndex, overallIndex - 1)}
                      onMoveDown={() =>
                        moveStop(overallIndex, overallIndex + 1)
                      }
                      onRemove={() => removeAt(overallIndex)}
                    />
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="shrink-0 rounded-[32px] border border-sky-200/80 bg-white/95 p-6 shadow-[0_24px_64px_-40px_rgba(15,23,42,0.45)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-kr-blue">
                  Отдых и еда
                </p>
                <h2 className="font-display mt-2 text-[20px] font-bold uppercase text-neutral-900">
                  Гостиницы и рестораны
                </h2>
              </div>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-[12px] font-semibold text-sky-800">
                {groupedStops.hospitalityStops.length}
              </span>
            </div>

            {groupedStops.hospitalityStops.length === 0 ? (
              <p className="mt-5 rounded-2xl border border-dashed border-sky-300 bg-sky-50/70 px-4 py-6 text-[14px] text-neutral-600">
                Пока нет отдельных точек для ночёвки и еды. Их можно добавить
                через каталог мест.
              </p>
            ) : (
              <div className="mt-5 min-h-[12rem]">
                <ul className="space-y-3">
                  {groupedStops.hospitalityStops.map(
                    ({ stop, overallIndex }) => (
                      <RoutePointCard
                        key={stop.key}
                        stop={stop}
                        overallIndex={overallIndex}
                        totalStops={editorStops.length}
                        editable={Boolean(canEditRoute)}
                        onMoveUp={() =>
                          moveStop(overallIndex, overallIndex - 1)
                        }
                        onMoveDown={() =>
                          moveStop(overallIndex, overallIndex + 1)
                        }
                        onRemove={() => removeAt(overallIndex)}
                      />
                    ),
                  )}
                </ul>
              </div>
            )}
          </section>
        </aside>
      </main>
    </div>
  );
}

export function RouteDetailPage() {
  const { id: idParam } = useParams();
  const token = useAuthStore((state) => state.token);
  const id = Number(idParam);

  if (!Number.isFinite(id) || id < 1 || !Number.isInteger(id)) {
    return <BadIdView />;
  }

  if (!token) {
    return <AuthWall />;
  }

  return <RouteReviewLoaded key={id} id={id} />;
}
