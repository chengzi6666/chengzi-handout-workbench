import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession } from "./session";

export async function requireUser() {
  const session = await readSession();
  if (!session) redirect("/login");
  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user) redirect("/login");
  return user;
}

