

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AlertTriangle } from "lucide-react"

interface NavigationWarningModalProps {
  isOpen: boolean
  onClose: () => void
  onContinue: () => void
  processingType?: string
}

export function NavigationWarningModal({
  isOpen,
  onClose,
  onContinue,
  processingType = "playlist",
}: NavigationWarningModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Critical Process Running
          </DialogTitle>
          <DialogDescription>
            A {processingType} is currently being processed. Navigating away will interrupt this process and may cause
            data loss.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <p className="text-sm text-muted-foreground">
            Please cancel the current process before navigating or continue at your own risk.
          </p>
        </div>
        <DialogFooter className="flex flex-row justify-end gap-2 sm:justify-end">
          <Button variant="outline" onClick={onClose}>
            Stay Here
          </Button>
          <Button variant="destructive" onClick={onContinue}>
            Continue Anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
