import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession } from "./session";

export async function requireUser() {
  const session = await readSession();
  if (!session) redirect("/login");
  if (process.env.LOCAL_DEMO_MODE === "true") return { id: session.userId, employeeNumber: session.employeeNumber, name: session.name };
  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user) redirect("/login");
  return user;
}
