type ApiData = Record<string, unknown>;

export type ApiResult<T extends ApiData = ApiData> = {
  ok: boolean;
  status: number;
  data: T | null;
  error: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

export const readJsonSafely = async <T extends ApiData = ApiData>(
  response: Response
): Promise<T | null> => {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

export const readApiErrorMessage = (
  payload: unknown,
  fallbackMessage: string
): string => {
  if (!isRecord(payload)) {
    return fallbackMessage;
  }

  const directError = payload.error;
  if (typeof directError === "string" && directError.trim()) {
    return directError;
  }

  const message = payload.message;
  if (typeof message === "string" && message.trim()) {
    return message;
  }

  return fallbackMessage;
};

export const readApiResult = async <T extends ApiData = ApiData>(
  response: Response,
  fallbackErrorMessage: string
): Promise<ApiResult<T>> => {
  const data = await readJsonSafely<T>(response);

  if (response.ok) {
    return {
      ok: true,
      status: response.status,
      data,
      error: "",
    };
  }

  return {
    ok: false,
    status: response.status,
    data,
    error: readApiErrorMessage(data, fallbackErrorMessage),
  };
};
