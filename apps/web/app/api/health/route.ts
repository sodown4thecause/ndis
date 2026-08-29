export function GET(): Response {
  return Response.json({ status: "ok" }, { status: 200 });
}
