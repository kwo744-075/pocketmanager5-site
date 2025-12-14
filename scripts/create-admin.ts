import { getSupabaseAdmin } from "../lib/supabaseAdmin";

function guardEnv(name: string, value?: string | undefined) {
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(2);
  }
}

async function main() {
  // Defaults — change via env if you want
  const email = process.env.ADMIN_EMAIL ?? "admin@take5.local";
  const password = process.env.ADMIN_PASSWORD ?? "take5";

  // getSupabaseAdmin will throw if service-role key or URL missing
  const admin = getSupabaseAdmin();

  console.log(`Creating admin user: ${email}`);

  try {
    // Create the auth user via the Supabase Admin API
    const createRes: any = await (admin as any).auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createRes.error) {
      console.error("Error creating auth user:", createRes.error);
      process.exit(3);
    }

    const user = createRes.data?.user ?? createRes.data ?? createRes.user ?? createRes;

    const userId = user?.id ?? user?.user?.id;
    if (!userId) {
      console.error("Could not determine created user id. Response:", JSON.stringify(createRes));
      process.exit(4);
    }

    console.log(`Auth user created with id=${userId}. Upserting role...`);

    const { error: roleErr } = await admin.from("user_roles").upsert([
      { user_id: userId, role: "admin" },
    ]);

    if (roleErr) {
      console.error("Failed to upsert user_roles:", roleErr);
      process.exit(5);
    }

    console.log("Admin role assigned. You can now sign in with:");
    console.log(`  email: ${email}`);
    console.log(`  password: ${password}`);
    console.log("IMPORTANT: This password is intentionally simple for initial access. Change it immediately after signing in, or use the password reset flow.");
  } catch (err: any) {
    console.error("Unexpected error creating admin user:", err?.message ?? err);
    process.exit(99);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
