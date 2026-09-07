import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "web"

const IconDoc = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
    <path d="M14 3v5h5" />
  </svg>
)

export const Primary = () => (
  <Attachment className="w-90">
    <AttachmentMedia>
      <IconDoc />
    </AttachmentMedia>
    <AttachmentContent>
      <AttachmentTitle>PIF-draft-no3.pdf</AttachmentTitle>
      <AttachmentDescription>248 KB</AttachmentDescription>
    </AttachmentContent>
  </Attachment>
)

export const States = () => (
  <div className="flex w-90 flex-col gap-2">
    <Attachment state="uploading">
      <AttachmentMedia>
        <IconDoc />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>supplier-spec.pdf</AttachmentTitle>
        <AttachmentDescription>Uploading…</AttachmentDescription>
      </AttachmentContent>
    </Attachment>
    <Attachment state="error">
      <AttachmentMedia>
        <IconDoc />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>cosing-export.csv</AttachmentTitle>
        <AttachmentDescription>Upload failed</AttachmentDescription>
      </AttachmentContent>
    </Attachment>
    <Attachment state="done">
      <AttachmentMedia>
        <IconDoc />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>PIF-draft-no3.pdf</AttachmentTitle>
        <AttachmentDescription>248 KB</AttachmentDescription>
      </AttachmentContent>
    </Attachment>
  </div>
)

export const Sizes = () => (
  <div className="flex w-90 flex-col gap-2">
    <Attachment size="xs">
      <AttachmentMedia>
        <IconDoc />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>batch-02.csv</AttachmentTitle>
      </AttachmentContent>
    </Attachment>
    <Attachment size="sm">
      <AttachmentMedia>
        <IconDoc />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>batch-02.csv</AttachmentTitle>
      </AttachmentContent>
    </Attachment>
    <Attachment>
      <AttachmentMedia>
        <IconDoc />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>batch-02.csv</AttachmentTitle>
      </AttachmentContent>
    </Attachment>
  </div>
)

export const Group = () => (
  <AttachmentGroup className="w-90">
    <Attachment size="sm">
      <AttachmentMedia>
        <IconDoc />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>PIF-draft-no3.pdf</AttachmentTitle>
      </AttachmentContent>
    </Attachment>
    <Attachment size="sm">
      <AttachmentMedia>
        <IconDoc />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>supplier-spec.pdf</AttachmentTitle>
      </AttachmentContent>
    </Attachment>
  </AttachmentGroup>
)
