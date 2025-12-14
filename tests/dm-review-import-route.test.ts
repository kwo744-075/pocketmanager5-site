import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/dm-review/import/route";

async function callRoute(formData: FormData) {
  const request = new Request("http://localhost/api/dm-review/import", {
    method: "POST",
    body: formData,
  });

  return POST(request as Request);
}

test("dm-review import returns mock draft", async () => {
  const csv = "Sales,Profit\n100,25";
  const file = new File([csv], "demo.csv", { type: "text/csv" });
  const formData = new FormData();
  formData.append("file", file);
  formData.append("mode", "weekly");

  const response = await callRoute(formData);
  assert.equal(response.status, 200);

  const payload = (await response.json()) as { draft: Record<string, unknown>; meta: Record<string, unknown> };
  assert.ok(payload.draft, "response should include draft");
  assert.equal(payload.meta?.mode, "weekly");
  assert.equal(payload.draft.dayOrWeekLabel, "Week ending");
  assert.equal(payload.draft.salesActual, "$415K");
});

test("dm-review import requires file", async () => {
  const formData = new FormData();
  formData.append("mode", "daily");

  const response = await callRoute(formData);
  assert.equal(response.status, 400);

  const payload = (await response.json()) as { error?: string };
  assert.match(payload.error ?? "", /upload is required/i);
});
