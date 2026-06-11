"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { needToFilters } from "@/lib/need-filters";
import { clearNeed, createNeed, deleteNeed, queueNeed } from "@/lib/needs";

// Per the Next.js data-security guidance: verify auth inside every Server
// Action — the proxy gate alone doesn't cover direct action invocation.
async function requireAuth(): Promise<void> {
  const store = await cookies();
  if (!verifySessionToken(store.get(SESSION_COOKIE)?.value)) {
    redirect("/login");
  }
}

export async function createNeedAction(formData: FormData): Promise<void> {
  await requireAuth();
  const needText = String(formData.get("need_text") ?? "").trim();
  if (!needText) redirect("/needs?error=empty");

  let filters;
  try {
    filters = await needToFilters(needText);
  } catch (e) {
    console.error("needToFilters failed:", e);
    redirect("/needs?error=ai");
  }
  await createNeed(needText, filters);
  revalidatePath("/needs");
  redirect("/needs");
}

export async function scanNeedAction(formData: FormData): Promise<void> {
  await requireAuth();
  const id = String(formData.get("id") ?? "");
  if (id) await queueNeed(id);
  revalidatePath("/needs");
}

export async function clearNeedAction(formData: FormData): Promise<void> {
  await requireAuth();
  const id = String(formData.get("id") ?? "");
  if (id) await clearNeed(id);
  revalidatePath("/needs");
  revalidatePath("/");
}

export async function deleteNeedAction(formData: FormData): Promise<void> {
  await requireAuth();
  const id = String(formData.get("id") ?? "");
  if (id) await deleteNeed(id);
  revalidatePath("/needs");
}
