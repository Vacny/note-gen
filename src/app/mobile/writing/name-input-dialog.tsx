'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCallback, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface NameInputDialogProps {
  open: boolean
  title: string
  placeholder?: string
  confirmText: string
  cancelText: string
  value: string
  loading?: boolean
  onChange: (value: string) => void
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
}

export function NameInputDialog({
  open,
  title,
  placeholder,
  confirmText,
  cancelText,
  value,
  loading = false,
  onChange,
  onConfirm,
  onOpenChange,
}: NameInputDialogProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  const handleOpenAutoFocus = useCallback((event: Event) => {
    event.preventDefault()
  }, [])

  const handleAnimationEnd = useCallback((event: React.AnimationEvent<HTMLDivElement>) => {
    if (!open || event.currentTarget.dataset.state !== 'open') return

    inputRef.current?.focus()
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[92vw] max-w-sm p-4"
        onOpenAutoFocus={handleOpenAutoFocus}
        onAnimationEnd={handleAnimationEnd}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Input
          ref={inputRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              onConfirm()
            }
          }}
        />
        <DialogFooter className="flex-row justify-end gap-2 sm:space-x-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            {cancelText}
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            disabled={loading || !value.trim()}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
