import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "web"

// InputGroupButton lives in an InputGroupAddon; on its own it has no group to
// size against.
export const InInputGroup = () => (
  <InputGroup className="w-110">
    <InputGroupInput placeholder="Ask about stock, a formula, or a new product…" />
    <InputGroupAddon align="inline-end">
      <InputGroupButton>Send</InputGroupButton>
    </InputGroupAddon>
  </InputGroup>
)
