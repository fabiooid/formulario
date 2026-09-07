import {
  Label,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "web"

export const Closed = () => (
  <div className="flex w-90 flex-col gap-1.5">
    <Label>Language</Label>
    <Select defaultValue="en">
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Choose a language" />
      </SelectTrigger>
    </Select>
  </div>
)

export const Placeholder = () => (
  <div className="w-90">
    <Select>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Choose a market" />
      </SelectTrigger>
    </Select>
  </div>
)

export const Open = () => (
  <div className="flex h-90 w-90 items-start pt-1">
    <Select defaultOpen defaultValue="eu">
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Choose a market" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Free plan</SelectLabel>
          <SelectItem value="eu">EU</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Paid plan</SelectLabel>
          <SelectItem value="uk">UK</SelectItem>
          <SelectItem value="asean">ASEAN</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  </div>
)
