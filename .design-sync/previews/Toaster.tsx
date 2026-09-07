import { Toaster } from "web"

// sonner's toast() helper lives in the `sonner` package, which previews cannot
// resolve (see NOTES.md), and a toast only exists after a runtime call — so
// there is no honest way to show a populated toast statically. This card mounts
// the real toast layer and says so.
export const Mounted = () => (
  <div className="w-110 rounded-lg border border-dashed border-border p-4">
    <p className="text-sm font-medium">Toast layer mounted</p>
    <p className="mt-1 text-sm text-muted-foreground">
      Render <code className="font-mono">&lt;Toaster /&gt;</code> once near the
      app root. Toasts are pushed at runtime with sonner's{" "}
      <code className="font-mono">toast()</code> helper, so none are visible in
      a static preview.
    </p>
    <Toaster />
  </div>
)
