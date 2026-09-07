import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageGroup,
  MessageHeader,
  Avatar,
  AvatarFallback,
} from "web"

export const Primary = () => (
  <MessageGroup className="w-140">
    <Message>
      <MessageAvatar>
        <Avatar size="sm">
          <AvatarFallback>LA</AvatarFallback>
        </Avatar>
      </MessageAvatar>
      <MessageContent>
        Phenoxyethanol is restricted to 1.0% max in the EU (Annex V, entry 29).
        Your row sits at 1.5%.
      </MessageContent>
    </Message>
  </MessageGroup>
)

export const WithHeaderAndFooter = () => (
  <MessageGroup className="w-140">
    <Message>
      <MessageAvatar>
        <Avatar size="sm">
          <AvatarFallback>LA</AvatarFallback>
        </Avatar>
      </MessageAvatar>
      <MessageContent>
        <MessageHeader>Lab Assistant</MessageHeader>
        Cutting it to 1.0% leaves 0.5% to redistribute. Aqua is the safest home
        for it.
        <MessageFooter>4.2s</MessageFooter>
      </MessageContent>
    </Message>
  </MessageGroup>
)

export const Exchange = () => (
  <MessageGroup className="w-140">
    <Message align="end">
      <MessageContent>Check the vegan claim.</MessageContent>
    </Message>
    <Message>
      <MessageAvatar>
        <Avatar size="sm">
          <AvatarFallback>LA</AvatarFallback>
        </Avatar>
      </MessageAvatar>
      <MessageContent>
        All nine committed rows are plant-derived or synthetic. The vegan claim
        holds.
      </MessageContent>
    </Message>
  </MessageGroup>
)
