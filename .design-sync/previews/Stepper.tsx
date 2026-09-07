import { Stepper, StepperSeparator, StepperStep } from "web"

export const Primary = () => (
  <Stepper className="w-120">
    <StepperStep state="complete" />
    <StepperSeparator />
    <StepperStep state="current" step={2} />
    <StepperSeparator />
    <StepperStep state="upcoming" step={3} />
  </Stepper>
)

export const FirstStep = () => (
  <Stepper className="w-120">
    <StepperStep state="current" step={1} />
    <StepperSeparator />
    <StepperStep state="upcoming" step={2} />
    <StepperSeparator />
    <StepperStep state="upcoming" step={3} />
  </Stepper>
)

export const AllComplete = () => (
  <Stepper className="w-120">
    <StepperStep state="complete" />
    <StepperSeparator />
    <StepperStep state="complete" />
    <StepperSeparator />
    <StepperStep state="complete" />
  </Stepper>
)

export const WithCaption = () => (
  <div className="flex w-120 flex-col gap-3">
    <Stepper>
      <StepperStep state="complete" />
      <StepperSeparator />
      <StepperStep state="current" step={2} />
      <StepperSeparator />
      <StepperStep state="upcoming" step={3} />
    </Stepper>
    <p className="text-sm text-muted-foreground">Step 2 of 3</p>
  </div>
)
