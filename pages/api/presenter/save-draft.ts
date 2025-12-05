import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseServer } from "../../../lib/supabaseServer";
import { createSupabaseRouteClient } from "../../../lib/createSupabaseRouteClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabaseAuth = createSupabaseRouteClient(req, res);
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const payload = req.body;
    const { districtName, dmName, period, year } = payload;

    const { data, error } = await supabaseServer
      .from("dm_presenters")
      .upsert(
        {
          user_id: user.id,
          district_name: districtName ?? null,
          dm_name: dmName ?? null,
          period: period ?? null,
          year: year ?? null,
          payload,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,period,year",
        }
      )
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({ ok: true, draft: data });
  } catch (err) {
    console.error("save-draft error:", err);
    return res.status(500).json({ error: "Failed to save draft" });
  }
}
