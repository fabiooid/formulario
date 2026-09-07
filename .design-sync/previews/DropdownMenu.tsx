import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "web"

// Two base-ui constraints this composition depends on:
//  - the menu needs a Trigger to anchor its positioner against;
//  - DropdownMenuLabel is a Menu *group* part, so it must live inside a
//    DropdownMenuGroup or base-ui throws "MenuGroupContext is missing".
export const Open = () => (
  <div className="flex h-90 w-110 items-start justify-center pt-2">
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger render={<Button variant="outline">Account</Button>} />
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuLabel>demo@local.test</DropdownMenuLabel>
          <DropdownMenuItem>
            Settings
            <DropdownMenuShortcut>⌘,</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>Organisation</DropdownMenuItem>
          <DropdownMenuItem>Send feedback</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem variant="destructive">Sign out</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
)
