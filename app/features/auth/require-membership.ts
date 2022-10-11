import type { User, World } from "@prisma/client"
import { prisma } from "~/prisma.server"

export async function requireMembership(user: User, world: World) {
  const role = await prisma.membership.findUnique({
    where: {
      worldId_userDiscordId: {
        worldId: world.id,
        userDiscordId: user.discordId,
      },
    },
  })
  if (role) return role

  // if this world has roles, it's already configured, so deny access
  const roleCountResult = await prisma.membership.count({ take: 1 })
  if (roleCountResult === 1) {
    throw new Response(undefined, { status: 403 })
  }

  // if this world has no roles, it's unconfigured,
  // so this user becomes the admin
  return prisma.membership.create({
    data: {
      world: { connect: { id: world.id } },
      user: { connect: { discordId: user.discordId } },
      role: "GM",
    },
  })
}
