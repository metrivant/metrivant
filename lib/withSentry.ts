import { Sentry } from "./sentry";

export interface ApiReq {
  method?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
}

export interface ApiRes {
  headersSent: boolean;
  status(code: number): ApiRes;
  json(body: unknown): void;
}

type Handler = (req: ApiReq, res: ApiRes) => Promise<void>;

export function withSentry(name: string, handler: Handler): Handler {
  return async function wrapped(req: ApiReq, res: ApiRes): Promise<void> {
    try {
      await handler(req, res);
    } catch (error) {
      Sentry.withScope((scope) => {
        scope.setTag("function", name);
        scope.setContext("request", {
          method: req?.method,
          url: req?.url,
        });
        Sentry.captureException(error);
      });
      await Sentry.flush(2000);

      if (!res.headersSent) {
        res.status(500).json({
          error: "internal_error",
          function: name,
        });
      }
    }
  };
}