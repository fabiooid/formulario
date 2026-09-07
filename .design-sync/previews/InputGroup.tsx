import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "web"

const IconSearch = () => (
  <svg
    className="size-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" strokeLinecap="round" />
  </svg>
)

export const WithLeadingIcon = () => (
  <InputGroup className="w-110">
    <InputGroupAddon>
      <IconSearch />
    </InputGroupAddon>
    <InputGroupInput placeholder="Search ingredients…" />
  </InputGroup>
)

export const WithUnit = () => (
  <InputGroup className="w-110">
    <InputGroupInput defaultValue="62.00" />
    <InputGroupAddon align="inline-end">
      <InputGroupText>€ /kg</InputGroupText>
    </InputGroupAddon>
  </InputGroup>
)

export const WithButton = () => (
  <InputGroup className="w-110">
    <InputGroupInput placeholder="Ask about stock or a formula…" />
    <InputGroupAddon align="inline-end">
      <InputGroupButton>Send</InputGroupButton>
    </InputGroupAddon>
  </InputGroup>
)

export const WithTextarea = () => (
  <InputGroup className="w-110">
    <InputGroupTextarea
      rows={3}
      placeholder="Ask about stock, a formula, or a new product…"
    />
  </InputGroup>
)
