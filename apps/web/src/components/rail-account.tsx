/**
 * Rail footer: account control (sign in, signed-in menu, auth state) and theme toggle.
 */
import { useAuth } from '@/auth/auth-provider'
import { ModeToggle } from '@/components/mode-toggle'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useWclRateLimit } from '@/hooks/use-wcl-rate-limit'
import { ChevronDown, LogIn, RefreshCw, User } from 'lucide-react'
import { type FC, type ReactNode, useState } from 'react'

const warcraftLogsHomeUrl = 'https://www.warcraftlogs.com'

function formatResetDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }

  return `${seconds}s`
}

function formatSpentPoints(pointsSpentThisHour: number): string {
  return String(Math.max(0, Math.floor(pointsSpentThisHour)))
}

export type RailAccountProps = {
  /** Icon-only variant for the collapsed (48px) rail. */
  collapsed?: boolean
}

type AccountMenuProps = {
  collapsed: boolean
}

type CollapsedTooltipProps = {
  label: string
  children: ReactNode
}

/** Right-hand tooltip for the icon-only footer buttons. */
const CollapsedTooltip: FC<CollapsedTooltipProps> = ({ label, children }) => (
  <Tooltip>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent side="right" withArrow>
      {label}
    </TooltipContent>
  </Tooltip>
)

/** Signed-in dropdown: user name, WCL ID, rate limit, Warcraft Logs link and sign out. */
const AccountMenu: FC<AccountMenuProps> = ({ collapsed }) => {
  const [isOpen, setIsOpen] = useState(false)
  const { isBusy, signOut, wclUserId, wclUserName } = useAuth()
  const {
    rateLimit,
    isLoading: isRateLimitLoading,
    isRefreshing: isRateLimitRefreshing,
    error: rateLimitError,
    refresh: refreshRateLimit,
  } = useWclRateLimit()
  const displayUserName = wclUserName ?? 'Warcraft Logs user'

  const handleOpenChange = (nextOpen: boolean): void => {
    setIsOpen(nextOpen)
    if (nextOpen) {
      void refreshRateLimit()
    }
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label={displayUserName}
                size="icon"
                type="button"
                variant="ghost"
              >
                <User aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="right" withArrow>
            {displayUserName}
          </TooltipContent>
        </Tooltip>
      ) : (
        <DropdownMenuTrigger asChild>
          <Button
            className="h-[30px] min-w-0 flex-1 justify-between gap-2"
            size="sm"
            type="button"
            variant="outline"
          >
            <span className="truncate">{displayUserName}</span>
            <ChevronDown aria-hidden="true" className="size-4" />
          </Button>
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent align="start" className="w-64" side="top">
        <DropdownMenuLabel>{displayUserName}</DropdownMenuLabel>
        {wclUserId ? (
          <DropdownMenuLabel className="pt-0">
            WCL ID: {wclUserId}
          </DropdownMenuLabel>
        ) : null}
        {rateLimit ? (
          <>
            <DropdownMenuLabel className="pt-0 text-xs font-normal text-muted-foreground">
              <span className="flex items-center justify-between gap-2">
                <span>
                  Spent: {formatSpentPoints(rateLimit.pointsSpentThisHour)}/
                  {rateLimit.limitPerHour}
                </span>
                <Button
                  aria-label="Refresh WCL rate limit"
                  disabled={isRateLimitLoading || isRateLimitRefreshing}
                  size="icon-xs"
                  type="button"
                  variant="ghost"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    void refreshRateLimit()
                  }}
                >
                  <RefreshCw
                    aria-hidden="true"
                    className={isRateLimitRefreshing ? 'animate-spin' : ''}
                  />
                </Button>
              </span>
            </DropdownMenuLabel>
            <DropdownMenuLabel className="pt-0 text-xs font-normal text-muted-foreground">
              Reset: {formatResetDuration(rateLimit.pointsResetIn)}
            </DropdownMenuLabel>
          </>
        ) : null}
        {!rateLimit && isRateLimitLoading ? (
          <DropdownMenuLabel className="pt-0 text-xs font-normal text-muted-foreground">
            Loading API usage...
          </DropdownMenuLabel>
        ) : null}
        {!rateLimit && !isRateLimitLoading && rateLimitError ? (
          <DropdownMenuLabel className="pt-0 text-xs font-normal text-muted-foreground">
            API usage unavailable
          </DropdownMenuLabel>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={warcraftLogsHomeUrl} rel="noreferrer" target="_blank">
            Warcraft Logs
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isBusy}
          variant="destructive"
          onClick={() => {
            void signOut()
          }}
        >
          {isBusy ? 'Signing out...' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Sign-in button, or loading/busy/disabled placeholders when there is no session. */
const AccountSignedOut: FC<AccountMenuProps> = ({ collapsed }) => {
  const { authEnabled, isBusy, isInitializing, startWclLogin } = useAuth()

  if (!authEnabled) {
    return collapsed ? null : (
      <span className="truncate px-1 text-sm text-muted-foreground">
        Auth disabled
      </span>
    )
  }

  if (isInitializing) {
    return (
      <Skeleton
        aria-hidden="true"
        className={collapsed ? 'size-8' : 'h-[30px] flex-1'}
        data-testid="auth-header-loading-skeleton"
      />
    )
  }

  if (isBusy) {
    return (
      <Skeleton
        aria-live="polite"
        className={`flex items-center justify-center ${collapsed ? 'size-8' : 'h-[30px] flex-1'}`}
        data-testid="auth-header-busy-skeleton"
      >
        {collapsed ? null : (
          <span className="text-[11px] font-medium text-muted-foreground">
            Logging in...
          </span>
        )}
      </Skeleton>
    )
  }

  return collapsed ? (
    <CollapsedTooltip label="Sign in with WCL">
      <Button
        aria-label="Sign in with WCL"
        size="icon"
        type="button"
        variant="ghost"
        onClick={startWclLogin}
      >
        <LogIn aria-hidden="true" />
      </Button>
    </CollapsedTooltip>
  ) : (
    <Button
      aria-label="Sign in with WCL"
      className="h-[30px] min-w-0 flex-1"
      size="sm"
      type="button"
      variant="outline"
      onClick={startWclLogin}
    >
      Sign in with WCL
    </Button>
  )
}

/** Rail footer pinned to the bottom with a top hairline. */
export const RailAccount: FC<RailAccountProps> = ({ collapsed = false }) => {
  const { authEnabled, isInitializing, wclUserId } = useAuth()
  const isSignedIn = authEnabled && !isInitializing && Boolean(wclUserId)

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={`flex shrink-0 items-center gap-2 border-t border-border p-2 ${
          collapsed ? 'flex-col' : ''
        }`}
        data-testid="rail-account"
      >
        {isSignedIn ? (
          <AccountMenu collapsed={collapsed} />
        ) : (
          <AccountSignedOut collapsed={collapsed} />
        )}
        <ModeToggle />
      </div>
    </TooltipProvider>
  )
}
