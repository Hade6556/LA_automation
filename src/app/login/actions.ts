"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, checkPassword, sessionToken } from "@/lib/auth";

export async function login(formData: FormData) {
  const pw = String(formData.get("password") ?? "");
  if (!checkPassword(pw)) {
    redirect("/login?error=1");
  }
  const store = await cookies();
  store.set(SESSION_COOKIE, sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  redirect("/");
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
