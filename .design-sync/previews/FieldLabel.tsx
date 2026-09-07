import { Field, FieldDescription, FieldLabel, Input } from "web"

// FieldLabel only reads correctly inside a Field.
export const InField = () => (
  <Field className="w-110">
    <FieldLabel htmlFor="org">Organisation name</FieldLabel>
    <Input id="org" defaultValue="Maison Verte" />
    <FieldDescription>Used in PIF drafts and export headers.</FieldDescription>
  </Field>
)
