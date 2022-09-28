import type { ActionArgs } from "@remix-run/node"
import { redirect } from "@remix-run/node"
import { z } from "zod"
import { getSessionUser } from "~/features/auth/session"
import { defaultRoomId } from "~/features/multiplayer/liveblocks-client"
import { range } from "~/helpers/range"
import { supabase } from "~/supabase.server"

export function loader() {
  return redirect("/")
}

export async function action({ request }: ActionArgs) {
  const user = await getSessionUser(request)
  if (!user) {
    return new Response("Unauthorized", { status: 401 })
  }

  const bodySchema = z.object({
    count: z
      .string()
      .transform((value) => z.number().int().positive().parse(Number(value))),
    intent: z.string().max(100),
  })
  const body = bodySchema.parse(Object.fromEntries(await request.formData()))

  const results = range(1, body.count).map(() => ({
    sides: 6,
    result: Math.floor(Math.random() * 6) + 1,
  }))

  await supabase.from("dice-logs").insert({
    roomId: defaultRoomId,
    userId: user.id,
    dice: JSON.stringify(results),
    intent: body.intent,
  })

  return redirect(request.headers.get("Referer") ?? "/")
}