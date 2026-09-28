export type ApiErrorKind = "network" | "http" | "invalid";
export type TrainRouteSearchResponse = {
  found: boolean;
  message: string | null;
  trains: unknown[];
  warning?: string;
};
export type LiveStationSearchResult = {
  station_code: string;
  station_name: string;
  city?: string | null;
  is_active?: boolean | null;
};

export class ApiError extends Error {
  kind: ApiErrorKind;
  status?: number;

  constructor(message: string, kind: ApiErrorKind = "http", status?: number) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api/v1").replace(/\/$/, "");

function userMessage(status?: number) {
  if (status === 404) return "The live provider did not find that station or route.";
  if (status === 429) return "The live provider is rate limiting requests. Try again shortly.";
  if (status === 401 || status === 403) return "Live API access is not authorized.";
  if (status === 504) return "The live API request timed out.";
  if (status === 502 || status === 503) return "The live API is temporarily unavailable.";
  if (status && status >= 500) return "RailETA is temporarily unable to reach the backend.";
  return "RailETA could not load this railway data.";
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(import.meta.env.VITE_API_KEY ? { "X-API-Key": import.meta.env.VITE_API_KEY } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError("RailETA backend is unavailable. Start FastAPI and try again.", "network");
  }

  if (!response.ok) {
    let detail: string | undefined;
    try {
      const payload = (await response.json()) as { detail?: string };
      detail = payload.detail;
    } catch {
      detail = undefined;
    }
    throw new ApiError(detail ?? userMessage(response.status), "http", response.status);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError("RailETA received an invalid response from the backend.", "invalid", response.status);
  }
}

export const api = {
  searchTrains: (query = "") => apiFetch<unknown[]>(`/trains/search${query ? `?query=${encodeURIComponent(query)}` : ""}`),
  searchStations: (query: string, signal?: AbortSignal) => apiFetch<LiveStationSearchResult[]>(`/trains/stations?query=${encodeURIComponent(query)}`, { signal }),
  searchTrainsBetween: (from: string, to: string) => {
    const params = new URLSearchParams({ from, to });
    return apiFetch<TrainRouteSearchResponse>(`/trains/search?${params.toString()}`);
  },
  getRoute: (trainNumber: string) => apiFetch<unknown>(`/trains/${encodeURIComponent(trainNumber)}/route`),
  getDelay: (trainNumber: string) => apiFetch<unknown>(`/delays/trains/${encodeURIComponent(trainNumber)}`),
  getLive: (trainNumber: string) => apiFetch<unknown>(`/live/trains/${encodeURIComponent(trainNumber)}`),
  getPrediction: (trainNumber: string) => apiFetch<unknown>(`/predictions/trains/${encodeURIComponent(trainNumber)}`),
  getForecast: (trainNumber: string) => apiFetch<unknown>(`/predictions/trains/${encodeURIComponent(trainNumber)}/forecast`),
  getAnalyticsSummary: () => apiFetch<unknown>("/analytics/summary"),
  getCorridors: () => apiFetch<unknown>("/analytics/corridors"),
  getTrainAnalytics: (trainNumber: string) => apiFetch<unknown>(`/analytics/trains/${encodeURIComponent(trainNumber)}`),
  getPredictionSummary: () => apiFetch<unknown>("/predictions/summary"),
  getNetworkConditions: (trainNumber: string) => apiFetch<unknown>(`/network/trains/${encodeURIComponent(trainNumber)}/conditions`),
  getLiveTrains: () => apiFetch<unknown>("/live/trains"),
  syncByTrain: (trainNumber: string) => apiFetch<{ train_number: string }>("/live/sync-by-train", {
    method: "POST",
    body: JSON.stringify({ train_number: trainNumber }),
  }),
};
