import { NextResponse } from "next/server";
import { jsonError, requireRole } from "../../../lib/auth";
import { ensureDatabase } from "../../../lib/db";

export const runtime = "nodejs";

export async function GET(request) {
  const access = await requireRole(request, ["admin"]);
  if (access.response) return access.response;
  try {
    const db = await ensureDatabase();
    const result = await db.query("SELECT id, type, note, amount, date::text AS date FROM fund_entries ORDER BY date DESC, id DESC");
    return NextResponse.json({ funds: result.rows.map((row) => ({ ...row, id: Number(row.id), amount: Number(row.amount) })) });
  } catch (error) {
    console.error("Gagal memuat catatan dana.", error);
    return jsonError("Catatan dana tidak dapat dimuat saat ini.", 503);
  }
}

export async function POST(request) {
  const access = await requireRole(request, ["admin"]);
  if (access.response) return access.response;
  try {
    const body = await request.json();
    const type = ["Masuk", "Keluar"].includes(body.type) ? body.type : null;
    const note = typeof body.note === "string" ? body.note.trim() : "";
    const amount = Number(body.amount);
    const date = typeof body.date === "string" ? body.date : "";
    if (!type || !note || note.length > 200 || !Number.isSafeInteger(amount) || amount < 1 || amount > 2_000_000_000) {
      return jsonError("Jenis, keterangan, atau nominal catatan tidak valid.", 400);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
      return jsonError("Tanggal catatan tidak valid.", 400);
    }
    const db = await ensureDatabase();
    const result = await db.query(
      "INSERT INTO fund_entries (type, note, amount, date, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id, type, note, amount, date::text AS date",
      [type, note, amount, date, access.user.id]
    );
    const row = result.rows[0];
    return NextResponse.json({ fund: { ...row, id: Number(row.id), amount: Number(row.amount) } }, { status: 201 });
  } catch (error) {
    console.error("Gagal menyimpan catatan dana.", error);
    return jsonError("Catatan dana tidak dapat disimpan saat ini.", 503);
  }
}

export async function DELETE(request) {
  const access = await requireRole(request, ["admin"]);
  if (access.response) return access.response;
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!/^\d+$/.test(id) || Number(id) < 1) return jsonError("ID catatan tidak valid.", 400);
  try {
    const db = await ensureDatabase();
    const result = await db.query("DELETE FROM fund_entries WHERE id=$1 RETURNING id", [id]);
    if (!result.rowCount) return jsonError("Catatan dana tidak ditemukan.", 404);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Gagal menghapus catatan dana.", error);
    return jsonError("Catatan dana tidak dapat dihapus saat ini.", 503);
  }
}
