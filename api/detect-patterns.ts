export default async function handler(req: any, res: any) {
  res.status(200).json({
    ok: true,
    job: "detect-patterns",
    status: "planned_not_active"
  });
}