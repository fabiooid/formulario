import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "web"

export const Open = () => (
  <Dialog defaultOpen>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Create organisation</DialogTitle>
        <DialogDescription>
          Products, ingredients, and stock belong to an organisation. You can
          add more later and switch between them.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <DialogClose render={<Button variant="outline">Cancel</Button>} />
        <Button>Create</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)
