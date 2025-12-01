import type { NextApiRequest, NextApiResponse } from "next";
import { createServerSupabaseClient } from "@supabase/auth-helpers-nextjs";
import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabaseAuth = createServerSupabaseClient({ req, res });
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { period, year } = req.query;

    let query = supabaseServer
      .from("dm_presenters")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (period) query = query.eq("period", period as string);
    if (year) query = query.eq("year", year as string);

    const { data, error } = await query.limit(1).single();

    if (error && error.code !== "PGRST116") throw error;

    if (!data) {
      return res.status(200).json({ ok: true, draft: null });
    }

    return res.status(200).json({ ok: true, draft: data.payload });
  } catch (err) {
    console.error("load-draft error:", err);
    return res.status(500).json({ error: "Failed to load draft" });
  }
}
