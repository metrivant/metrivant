import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { verifyCronSecret } from "../lib/withCronAuth";

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  // generate-brief is not yet implemented.
  // No Sentry check-in is sent — a stub reporting "ok" to monitors is a
  // false-green operational signal. When the feature ships, this block is replaced
  // with real logic and check-ins are re-enabled.
  return res.status(200).json({
    ok: true,
    job: "generate-brief",
    disabled: true,
  });
}

export default withSentry("generate-brief", handler);