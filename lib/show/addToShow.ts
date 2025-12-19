export type AddToShowPayload = {
  title: string;
  awardKey?: string | null;
  meta?: Record<string, any> | null;
};

export async function addToShow(payload: AddToShowPayload) {
  const res = await fetch("/api/recognition/awards/add-to-show", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Add to show failed: ${res.status} ${text}`);
  }
  return res.json();
}

export default addToShow;
