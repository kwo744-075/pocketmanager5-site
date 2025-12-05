import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireServerSession } from "@/lib/auth/session";
import { userCanManageAlignments } from "@/lib/auth/alignment";
import {
  listAlignmentsWithMembers,
  upsertAlignmentMembership,
  removeAlignmentMembership,
  upsertShopRoleAssignment,
  removeShopRoleAssignment,
} from "@/lib/alignmentAdmin";

const ADMIN_PATH = "/pocket-manager5/admin/alignments";

export const dynamic = "force-dynamic";

const stringValue = (value: FormDataEntryValue | null): string => {
  if (typeof value === "string") {
    return value.trim();
  }
  return "";
};

async function addMembershipAction(formData: FormData) {
  "use server";
  const session = await requireServerSession();
  if (!userCanManageAlignments(session.alignment)) {
    throw new Error("Not authorized to manage alignments");
  }

  const userId = stringValue(formData.get("userId"));
  const alignmentId = stringValue(formData.get("alignmentId"));
  const role = stringValue(formData.get("role"));

  if (!userId || !alignmentId || !role) {
    throw new Error("User, alignment, and role are required");
  }

  await upsertAlignmentMembership(
    {
      userId,
      alignmentId,
      shopId: stringValue(formData.get("membershipShopId")) || null,
      role,
      isPrimary: stringValue(formData.get("isPrimary")) === "on",
    },
    session.user?.id ?? null,
  );

  revalidatePath(ADMIN_PATH);
}

async function removeMembershipAction(formData: FormData) {
  "use server";
  const session = await requireServerSession();
  if (!userCanManageAlignments(session.alignment)) {
    throw new Error("Not authorized to manage alignments");
  }

  const userId = stringValue(formData.get("removeUserId"));
  const alignmentId = stringValue(formData.get("removeAlignmentId"));
  if (!userId || !alignmentId) {
    throw new Error("User and alignment are required to remove a membership");
  }

  await removeAlignmentMembership(
    {
      userId,
      alignmentId,
      shopId: stringValue(formData.get("removeShopId")) || undefined,
    },
    session.user?.id ?? null,
  );

  revalidatePath(ADMIN_PATH);
}

async function assignShopRoleAction(formData: FormData) {
  "use server";
  const session = await requireServerSession();
  if (!userCanManageAlignments(session.alignment)) {
    throw new Error("Not authorized to manage alignments");
  }

  const userId = stringValue(formData.get("roleUserId"));
  const shopId = stringValue(formData.get("roleShopId"));
  const role = stringValue(formData.get("roleName"));
  if (!userId || !shopId || !role) {
    throw new Error("User, shop, and role are required for shop assignments");
  }

  await upsertShopRoleAssignment(
    {
      userId,
      shopId,
      role,
    },
    session.user?.id ?? null,
  );

  revalidatePath(ADMIN_PATH);
}

async function removeShopRoleAction(formData: FormData) {
  "use server";
  const session = await requireServerSession();
  if (!userCanManageAlignments(session.alignment)) {
    throw new Error("Not authorized to manage alignments");
  }

  const userId = stringValue(formData.get("roleRemoveUserId"));
  const shopId = stringValue(formData.get("roleRemoveShopId"));
  if (!userId || !shopId) {
    throw new Error("User and shop are required to remove a role");
  }

  await removeShopRoleAssignment(
    {
      userId,
      shopId,
    },
    session.user?.id ?? null,
  );

  revalidatePath(ADMIN_PATH);
}

export default async function AlignmentAdminPage() {
  const session = await requireServerSession();
  if (!userCanManageAlignments(session.alignment)) {
    redirect("/pocket-manager5");
  }

  const alignments = await listAlignmentsWithMembers();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-12 space-y-10">
        <Link
          href="/pocket-manager5"
          className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-200 transition hover:text-emerald-100"
        >
          <span aria-hidden>↩</span> Back to Pocket Manager5
        </Link>

        <section className="rounded-3xl border border-emerald-500/20 bg-slate-900/70 p-6 shadow-2xl shadow-emerald-900/30">
          <p className="text-[11px] uppercase tracking-[0.3em] text-emerald-300/90">Alignment oversight</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-semibold text-white">Alignment Admin Console</h1>
            <span className="rounded-full border border-emerald-400/30 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
              Ops only
            </span>
          </div>
          <p className="mt-3 text-sm text-slate-300">
            Manage membership records, shop role overrides, and capture audit events for every change. All actions below require service-role
            permissions and are logged automatically.
          </p>
        </section>

        <section className="rounded-3xl border border-slate-800/70 bg-slate-950/70 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Alignment inventory</p>
              <h2 className="text-2xl font-semibold text-white">{alignments.length} active alignments</h2>
            </div>
            <span className="text-xs font-semibold text-slate-400">Data source: alignments + alignment_memberships</span>
          </div>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead className="text-left text-xs uppercase tracking-[0.3em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Region</th>
                  <th className="px-3 py-2 text-right">Members</th>
                  <th className="px-3 py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/80 text-slate-200">
                {alignments.map((alignment) => (
                  <tr key={alignment.id}>
                    <td className="px-3 py-2 font-semibold text-white">{alignment.name}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-400">{alignment.code ?? "--"}</td>
                    <td className="px-3 py-2">{alignment.region ?? "--"}</td>
                    <td className="px-3 py-2 text-right">{alignment.memberCount}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={alignment.isActive ? "text-emerald-300" : "text-amber-300"}>{alignment.isActive ? "Active" : "Paused"}</span>
                    </td>
                  </tr>
                ))}
                {!alignments.length && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                      No alignments found. Seed data via Supabase SQL console.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-800/70 bg-slate-950/70 p-6">
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Memberships</p>
            <h3 className="mt-1 text-xl font-semibold text-white">Add or update membership</h3>
            <form action={addMembershipAction} className="mt-4 space-y-3 text-sm">
              <label className="block">
                <span className="text-slate-400">User ID</span>
                <input name="userId" className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-white" placeholder="uuid-from-auth.users" />
              </label>
              <label className="block">
                <span className="text-slate-400">Alignment ID</span>
                <input name="alignmentId" className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-white" placeholder="uuid-from-alignments" />
              </label>
              <label className="block">
                <span className="text-slate-400">Linked shop (optional)</span>
                <input name="membershipShopId" className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-white" placeholder="447 or shop-id" />
              </label>
              <label className="block">
                <span className="text-slate-400">Role</span>
                <input name="role" className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-white" placeholder="dm | rd | ops" />
              </label>
              <label className="inline-flex items-center gap-2 text-slate-300">
                <input type="checkbox" name="isPrimary" className="h-4 w-4 rounded border-slate-700 bg-slate-900" />
                Mark as primary alignment
              </label>
              <button type="submit" className="w-full rounded-xl border border-emerald-400/60 bg-emerald-500/20 px-4 py-2 font-semibold text-emerald-100 transition hover:border-emerald-300">
                Save membership
              </button>
            </form>

            <form action={removeMembershipAction} className="mt-8 space-y-3 text-sm">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Remove membership</p>
              <label className="block">
                <span className="text-slate-400">User ID</span>
                <input name="removeUserId" className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-white" />
              </label>
              <label className="block">
                <span className="text-slate-400">Alignment ID</span>
                <input name="removeAlignmentId" className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-white" />
              </label>
              <label className="block">
                <span className="text-slate-400">Shop filter (optional)</span>
                <input name="removeShopId" className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-white" placeholder="Only needed for multi-shop memberships" />
              </label>
              <button type="submit" className="w-full rounded-xl border border-red-400/50 bg-red-500/10 px-4 py-2 font-semibold text-red-100 transition hover:border-red-300">
                Remove membership
              </button>
            </form>
          </div>

          <div className="rounded-3xl border border-slate-800/70 bg-slate-950/70 p-6">
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Shop role assignments</p>
            <h3 className="mt-1 text-xl font-semibold text-white">Override shop access</h3>
            <form action={assignShopRoleAction} className="mt-4 space-y-3 text-sm">
              <label className="block">
                <span className="text-slate-400">User ID</span>
                <input name="roleUserId" className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-white" />
              </label>
              <label className="block">
                <span className="text-slate-400">Shop ID</span>
                <input name="roleShopId" className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-white" placeholder="447 or shop-id" />
              </label>
              <label className="block">
                <span className="text-slate-400">Role</span>
                <input name="roleName" className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-white" placeholder="gm | dm | rd | observer" />
              </label>
              <button type="submit" className="w-full rounded-xl border border-sky-400/60 bg-sky-500/10 px-4 py-2 font-semibold text-sky-100 transition hover:border-sky-300">
                Save shop role
              </button>
            </form>

            <form action={removeShopRoleAction} className="mt-8 space-y-3 text-sm">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Remove shop role</p>
              <label className="block">
                <span className="text-slate-400">User ID</span>
                <input name="roleRemoveUserId" className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-white" />
              </label>
              <label className="block">
                <span className="text-slate-400">Shop ID</span>
                <input name="roleRemoveShopId" className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-white" />
              </label>
              <button type="submit" className="w-full rounded-xl border border-amber-400/60 bg-amber-500/10 px-4 py-2 font-semibold text-amber-100 transition hover:border-amber-300">
                Remove shop role
              </button>
            </form>

            <p className="mt-6 text-xs text-slate-500">
              Every change above calls the service-role Supabase client and mirrors the payload into <code className="font-mono text-[11px] text-slate-300">alignment_audit_log</code> so Ops has a full trail of activity.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
