import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/auth/session";
import { userCanManageAlignments } from "@/lib/auth/alignment";
import { listAlignmentsWithMembers } from "@/lib/alignmentAdmin";

export async function GET() {
  const session = await requireServerSession();
  if (!userCanManageAlignments(session.alignment)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const alignments = await listAlignmentsWithMembers();
    return NextResponse.json({ alignments });
  } catch (error) {
    console.error("[AlignmentAdmin] Unable to load overview", error);
    return NextResponse.json({ error: "Unable to load alignments" }, { status: 500 });
  }
}
