import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
  Input,
  Switch,
} from "web"

export const Primary = () => (
  <Field className="w-110">
    <FieldLabel htmlFor="org">Organisation name</FieldLabel>
    <Input id="org" defaultValue="Maison Verte" />
    <FieldDescription>Used in PIF drafts and export headers.</FieldDescription>
  </Field>
)

export const WithError = () => (
  <Field className="w-110">
    <FieldLabel htmlFor="pct">Percentage</FieldLabel>
    <Input id="pct" defaultValue="118.4" aria-invalid />
    <FieldError>Formula total must not exceed 100%.</FieldError>
  </Field>
)

export const Horizontal = () => (
  <Field className="w-110" orientation="horizontal">
    <FieldContent>
      <FieldTitle>Lab Assistant</FieldTitle>
      <FieldDescription>
        Metered proposals and regulatory lookups.
      </FieldDescription>
    </FieldContent>
    <Switch defaultChecked />
  </Field>
)

export const Grouped = () => (
  <FieldSet className="w-110">
    <FieldLegend>Organisation</FieldLegend>
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="name">Name</FieldLabel>
        <Input id="name" defaultValue="Maison Verte" />
      </Field>
      <FieldSeparator />
      <Field>
        <FieldLabel htmlFor="market">Primary market</FieldLabel>
        <Input id="market" defaultValue="EU" />
        <FieldDescription>
          The free plan checks EU rules only.
        </FieldDescription>
      </Field>
    </FieldGroup>
  </FieldSet>
)
