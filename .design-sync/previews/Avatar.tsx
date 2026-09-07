import { Avatar, AvatarBadge, AvatarFallback, AvatarGroup, AvatarGroupCount } from "web"

export const Primary = () => (
  <Avatar>
    <AvatarFallback>MV</AvatarFallback>
  </Avatar>
)

export const Sizes = () => (
  <div className="flex items-center gap-3">
    <Avatar size="sm">
      <AvatarFallback>DL</AvatarFallback>
    </Avatar>
    <Avatar>
      <AvatarFallback>MV</AvatarFallback>
    </Avatar>
    <Avatar size="lg">
      <AvatarFallback>AT</AvatarFallback>
    </Avatar>
  </div>
)

export const WithBadge = () => (
  <Avatar>
    <AvatarFallback>MV</AvatarFallback>
    <AvatarBadge />
  </Avatar>
)

export const Group = () => (
  <AvatarGroup>
    <Avatar>
      <AvatarFallback>MV</AvatarFallback>
    </Avatar>
    <Avatar>
      <AvatarFallback>DL</AvatarFallback>
    </Avatar>
    <Avatar>
      <AvatarFallback>AT</AvatarFallback>
    </Avatar>
    <AvatarGroupCount>+2</AvatarGroupCount>
  </AvatarGroup>
)
