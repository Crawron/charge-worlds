import { autoUpdate, offset, size, useFloating } from "@floating-ui/react-dom"
import type { LinksFunction, LoaderArgs } from "@remix-run/node"
import {
  Links,
  LiveReload,
  Meta,
  NavLink,
  Outlet,
  Scripts,
  useLoaderData,
} from "@remix-run/react"
import clsx from "clsx"
import { Book, Clock, Users } from "lucide-react"
import type { ReactNode } from "react"
import type { TypedMetaFunction } from "remix-typedjson"
import { typedjson, useTypedLoaderData } from "remix-typedjson"
import { truthyJoin } from "~/helpers/truthy-join"
import { SupabaseBrowserEnv } from "~/supabase-browser"
import { clearButtonClass } from "~/ui/styles"
import favicon from "./assets/favicon.svg"
import { env } from "./env.server"
import type { SessionUser } from "./features/auth/session"
import { getSessionUser } from "./features/auth/session"
import { UserProvider } from "./features/auth/user-context"
import { DiceButton, DiceConfirmPanel } from "./features/dice/dice-button-d6"
import { LiveCursors } from "./features/multiplayer/live-cursors"
import {
  defaultRoomId,
  defaultRoomInit,
} from "./features/multiplayer/liveblocks-client"
import { RoomProvider } from "./features/multiplayer/liveblocks-react"
import { LiveblocksStorageProvider } from "./features/multiplayer/liveblocks-storage"
import { getLiveblocksStorage } from "./features/multiplayer/liveblocks-storage.server"
import {
  LogsPanel,
  LogsPanelButton,
  LogsPanelProvider,
} from "./features/multiplayer/logs"
import { WorldTitle } from "./features/world/world-title"
import tailwind from "./generated/tailwind.css"
import { prisma } from "./prisma.server"
import { Portal } from "./ui/portal"

export const unstable_shouldReload = () => false

export async function loader({ request }: LoaderArgs) {
  async function getWorldLogs() {
    const logs = await prisma.diceLog.findMany({
      where: {
        roomId: defaultRoomId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 20,
    })
    return logs.reverse()
  }

  const [user, storage, logs] = await Promise.all([
    getSessionUser(request),
    getLiveblocksStorage(),
    getWorldLogs(),
  ])

  return typedjson({
    user,
    storage,
    logs,
    supabaseUrl: env.SUPABASE_URL,
    supabaseAnonKey: env.SUPABASE_ANON_KEY,
  })
}
export { loader as rootLoader }

export const meta: TypedMetaFunction<typeof loader> = ({ data }) => {
  const title = truthyJoin(" | ", [
    data.storage.data.world?.name,
    "Charge Worlds",
  ])
  const description = "Virtual environment for the Charge RPG system"
  const siteUrl = "https://charge-worlds.netlify.app/"

  return {
    // eslint-disable-next-line unicorn/text-encoding-identifier-case
    "charset": "utf-8",
    "viewport": "width=device-width,initial-scale=1",

    title,
    description,
    "theme-color": "#1e293b",

    "og:type": "website",
    "og:url": siteUrl,
    "og:title": title,
    "og:description": description,

    "twitter:card": "summary_large_image",
    "twitter:url": siteUrl,
    "twitter:title": title,
    "twitter:description": description,
  }
}

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: "/build/fonts/rubik/variable.css" },
  { rel: "stylesheet", href: "/build/fonts/oswald/variable.css" },
  { rel: "stylesheet", href: tailwind },
  { rel: "icon", href: favicon },
]

export default function App() {
  const data = useTypedLoaderData<typeof loader>()
  return (
    <html
      lang="en"
      className="font-body overflow-y-auto break-words bg-gray-800 text-gray-100"
      style={{ wordBreak: "break-word", scrollbarGutter: "stable" }}
    >
      <head>
        <Meta />
        <Links />
        <SupabaseBrowserEnv
          url={data.supabaseUrl}
          anonKey={data.supabaseAnonKey}
        />
      </head>
      <body>
        <div className="mx-auto flex min-h-screen flex-col gap-4 p-4">
          <LiveblocksStorageProvider storage={data.storage}>
            <AuthGuard>
              {({ user }) => (
                <RoomProvider id={defaultRoomId} {...defaultRoomInit}>
                  <div className="mx-auto grid w-full max-w-screen-md gap-4">
                    <div className="my-2">
                      <MainNav />
                    </div>
                    <UserProvider user={user}>
                      <Outlet />
                    </UserProvider>
                  </div>

                  <div className="sticky bottom-4 mx-auto mt-auto w-full max-w-screen-2xl">
                    <FooterActions />
                  </div>

                  <LiveCursors name={user.name} />
                  <WorldTitle />
                </RoomProvider>
              )}
            </AuthGuard>
          </LiveblocksStorageProvider>
        </div>
        <Scripts />
        <LiveReload />
      </body>
    </html>
  )
}

function MainNav() {
  return (
    <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 sm:justify-start">
      <HeaderLink to="/">
        <Book size={20} /> World
      </HeaderLink>
      <HeaderLink to="/characters" partial>
        <Users size={20} /> Characters
      </HeaderLink>
      <HeaderLink to="/clocks">
        <Clock size={20} /> Clocks
      </HeaderLink>
    </nav>
  )
}

function HeaderLink({
  to,
  children,
  partial,
}: {
  to: string
  children: React.ReactNode
  partial?: boolean
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => clearButtonClass(isActive)}
      end={partial ? false : undefined}
    >
      {children}
    </NavLink>
  )
}

function AuthGuard({
  children,
}: {
  children: (props: { user: SessionUser }) => ReactNode
}) {
  const data = useLoaderData<typeof loader>()

  if (!data.user) {
    return (
      <main className="grid gap-4 p-8">
        <p>
          To access this world, please{" "}
          <a href="/auth/discord/login" className="underline">
            Login with Discord
          </a>
        </p>
        <p className="opacity-75">{`(i'll make this less jank later)`}</p>
      </main>
    )
  }

  if (!data.user.isAllowed) {
    return (
      <main className="grid gap-4 p-8">
        <p>
          {`Sorry, you're not authorized to enter this world.`}
          <a href="/auth/logout" className="underline">
            Log out
          </a>
        </p>
        <p className="opacity-75">{`(i'll make this less jank later)`}</p>
      </main>
    )
  }

  return <>{children({ user: data.user })}</>
}

function FooterActions() {
  const data = useLoaderData<typeof loader>()

  const floating = useFloating({
    placement: "top-end",
    strategy: "fixed", // fixed positioning causes less shifting while scrolling
    middleware: [
      offset(8),
      size({
        padding: 16,
        apply: ({ elements, availableWidth, availableHeight }) => {
          elements.floating.style.width = `${availableWidth}px`
          elements.floating.style.height = `${availableHeight}px`
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
  })

  return (
    <LogsPanelProvider>
      <Portal>
        <div
          ref={floating.floating}
          className={clsx(
            "pointer-events-none flex h-fit flex-col items-end justify-end gap-4",
            floating.x === null && "opacity-0",
          )}
          style={{
            position: floating.strategy,
            left: floating.x ?? 0,
            top: floating.y ?? 0,
          }}
        >
          <div className="w-full max-w-xs flex-1 self-end [&>*]:pointer-events-auto">
            <LogsPanel logs={data.logs} />
          </div>
          <div className="contents [&>*]:pointer-events-auto">
            <DiceConfirmPanel />
          </div>
        </div>
      </Portal>

      <div
        className="flex flex-wrap items-center justify-end gap-2"
        ref={floating.reference}
      >
        <LogsPanelButton />
        <DiceButton />
      </div>
    </LogsPanelProvider>
  )
}
