import { Marker, MarkerContent, MarkerIcon } from "web"

const IconClock = () => (
  <svg
    className="size-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" strokeLinecap="round" />
  </svg>
)

export const Primary = () => (
  <div className="w-110">
    <Marker>
      <MarkerContent>Committed 4 Sep 2026, 09:12</MarkerContent>
    </Marker>
  </div>
)

export const WithIcon = () => (
  <div className="w-110">
    <Marker>
      <MarkerIcon>
        <IconClock />
      </MarkerIcon>
      <MarkerContent>Macerating — 6 days left</MarkerContent>
    </Marker>
  </div>
)

export const SeparatorVariant = () => (
  <div className="w-110">
    <Marker variant="separator">
      <MarkerContent>Today</MarkerContent>
    </Marker>
  </div>
)

export const BorderVariant = () => (
  <div className="w-110">
    <Marker variant="border">
      <MarkerContent>Version history</MarkerContent>
    </Marker>
  </div>
)
