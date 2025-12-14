// Minimal server-side PPTX generator route using pptxgenjs.
// This route accepts a JSON payload and returns a .pptx file.

// NOTE: this file targets a Node runtime inside Next.js App Router route.
// The pptxgenjs library exposes a write("nodebuffer") API which returns a Buffer.

// @ts-ignore - pptxgenjs has mixed types in some setups
import PptxGenJS from "pptxgenjs";

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const {
      qualifiedEmployees = [],
      qualifiedShops = [],
      birthdays = [],
      anniversaries = [],
      donations = [],
      dmAwards = [],
    } = payload as Record<string, unknown>;

    // @ts-ignore
    const pptx = new PptxGenJS();
    pptx.author = "PocketManager5";

    // Title
    const slide1 = pptx.addSlide();
    slide1.addText("District Awards", { x: 1.2, y: 1.4, fontSize: 26, bold: true });

    // Employees
    const slide2 = pptx.addSlide();
    slide2.addText("Employee Winners", { x: 0.5, y: 0.3, fontSize: 18, bold: true });
    if (Array.isArray(qualifiedEmployees) && (qualifiedEmployees as any[]).length) {
      const tableData = [["Name", "Shop #", "NPS %", "Surveys"]].concat(
        (qualifiedEmployees as any[]).slice(0, 40).map((e) => [String(e.employeeName ?? ""), String(e.shopNumber ?? ""), String(e.npsScore ?? ""), String(e.npsSurveyCount ?? "")])
      );
      // @ts-ignore - type mismatch between project types and pptx types
      slide2.addTable(tableData, { x: 0.3, y: 1.0, w: 9.4, fontSize: 10 });
    } else {
      slide2.addText("No employee winners.", { x: 0.5, y: 1.1, fontSize: 12 });
    }

    // Shops
    const slide3 = pptx.addSlide();
    slide3.addText("Shop Winners", { x: 0.5, y: 0.3, fontSize: 18, bold: true });
    if (Array.isArray(qualifiedShops) && (qualifiedShops as any[]).length) {
      const tableData = [["Shop", "Shop #", "Rank", "NPS %", "Surveys"]].concat(
        (qualifiedShops as any[]).slice(0, 40).map((s) => [String(s.shopName ?? ""), String(s.shopNumber ?? ""), String(s.powerRankerRank ?? ""), String(s.npsScore ?? ""), String(s.npsSurveyCount ?? "")])
      );
      // @ts-ignore
      slide3.addTable(tableData, { x: 0.3, y: 1.0, w: 9.4, fontSize: 10 });
    } else {
      slide3.addText("No shop winners.", { x: 0.5, y: 1.1, fontSize: 12 });
    }

    // Birthdays
    const slide4 = pptx.addSlide();
    slide4.addText("Birthdays", { x: 0.5, y: 0.3, fontSize: 18, bold: true });
    if (Array.isArray(birthdays) && (birthdays as any[]).length) {
      const tableData = [["Name", "Shop #", "Date"]].concat((birthdays as any[]).map((b) => [String(b.name ?? ""), String(b.shopNumber ?? ""), String(b.date ?? "")]));
      // @ts-ignore
      slide4.addTable(tableData, { x: 0.3, y: 1.0, w: 9.4, fontSize: 10 });
    } else {
      slide4.addText("No birthdays.", { x: 0.5, y: 1.1, fontSize: 12 });
    }

    // Anniversaries
    const slide5 = pptx.addSlide();
    slide5.addText("Anniversaries", { x: 0.5, y: 0.3, fontSize: 18, bold: true });
    if (Array.isArray(anniversaries) && (anniversaries as any[]).length) {
      const tableData = [["Name", "Shop #", "Date", "Years"]].concat((anniversaries as any[]).map((a) => [String(a.name ?? ""), String(a.shopNumber ?? ""), String(a.date ?? ""), String(a.years ?? "")]));
      // @ts-ignore
      slide5.addTable(tableData, { x: 0.3, y: 1.0, w: 9.4, fontSize: 10 });
    } else {
      slide5.addText("No anniversaries.", { x: 0.5, y: 1.1, fontSize: 12 });
    }

    // Donations
    const slide6 = pptx.addSlide();
    slide6.addText("Donations", { x: 0.5, y: 0.3, fontSize: 18, bold: true });
    if (Array.isArray(donations) && (donations as any[]).length) {
      const tableData = [["Name/Shop", "Shop #", "Amount/Note"]].concat((donations as any[]).map((d) => [String(d.nameOrShop ?? ""), String(d.shopNumber ?? ""), String(d.amountOrNote ?? "")]));
      // @ts-ignore
      slide6.addTable(tableData, { x: 0.3, y: 1.0, w: 9.4, fontSize: 10 });
    } else {
      slide6.addText("No donations.", { x: 0.5, y: 1.1, fontSize: 12 });
    }

    // DM Awards
    const slide7 = pptx.addSlide();
    slide7.addText("DM Awards (Manual)", { x: 0.5, y: 0.3, fontSize: 18, bold: true });
    if (Array.isArray(dmAwards) && (dmAwards as any[]).length) {
      const tableData = [["Title", "Recipient", "Shop #", "District", "Region"]].concat((dmAwards as any[]).map((d) => [String(d.title ?? ""), String(d.recipientName ?? ""), String(d.shopNumber ?? ""), String(d.district ?? ""), String(d.region ?? "")]));
      // @ts-ignore
      slide7.addTable(tableData, { x: 0.3, y: 1.0, w: 9.4, fontSize: 10 });
    } else {
      slide7.addText("No DM awards.", { x: 0.5, y: 1.1, fontSize: 12 });
    }

    // Write as node buffer
    // @ts-ignore
    const buffer = await pptx.write("nodebuffer");

    return new Response(buffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="awards.pptx"`,
      },
    });
  } catch (err) {
    console.error("Error generating PPTX:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
