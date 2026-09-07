import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "web"

// AttachmentAction is a leaf of the Attachment composition — shown in place,
// which is the only render that is true to how it is used.
const IconDoc = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
    <path d="M14 3v5h5" />
  </svg>
)
const IconX = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
  </svg>
)

export const InAttachment = () => (
  <Attachment className="w-90">
    <AttachmentMedia>
      <IconDoc />
    </AttachmentMedia>
    <AttachmentContent>
      <AttachmentTitle>PIF-draft-no3.pdf</AttachmentTitle>
      <AttachmentDescription>248 KB</AttachmentDescription>
    </AttachmentContent>
    <AttachmentActions>
      <AttachmentAction aria-label="Remove attachment">
        <IconX />
      </AttachmentAction>
    </AttachmentActions>
  </Attachment>
)
