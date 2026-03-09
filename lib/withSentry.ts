import { Sentry } from "./sentry";

type Handler = (req: any, res: any) => Promise<void>;

export function withSentry(name: string, handler: Handler): Handler {
  return async function wrapped(req: any, res: any): Promise<void> {
    try {
      await handler(req, res);
    } catch (error) {
      Sentry.withScope((scope) => {
        scope.setTag("function", name);
        scope.setContext("request", {
          method: req.method,
          url: req.url,
        });
        Sentry.captureException(error);
      });

      await Sentry.flush(2000);

      res.status(500).json({
        error: "internal_error",
        function: name,
      });
    }
  };
}
