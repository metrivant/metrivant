import "../lib/sentry";
import { withSentry } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/db/supabase";

async function handler(req: any, res: any) {

  const startedAt = Date.now();

  Sentry.captureCheckIn({
    monitorSlug: "build-baselines",
    status: "in_progress",
  });

  try {

    const { data, error } = await supabase.rpc("build_section_baselines");

    if (error) {
      throw error;
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.captureCheckIn({
      monitorSlug: "build-baselines",
      status: "ok",
    });

    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "build-baselines",
      baselinesCreated: data,
      runtimeDurationMs
    });

  } catch (error) {

    Sentry.captureException(error);

    Sentry.captureCheckIn({
      monitorSlug: "build-baselines",
      status: "error",
    });

    await Sentry.flush(2000);

    throw error;
  }
}

export default withSentry("build-baselines", handler);