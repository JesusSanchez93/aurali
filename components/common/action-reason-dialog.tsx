'use client';

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface ActionReasonDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (note: string) => void;
    title: string;
    description: string;
    reasonLabel?: string;
    reasonPlaceholder?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'default' | 'destructive';
}

export function ActionReasonDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    reasonLabel = 'Motivo (opcional)',
    reasonPlaceholder = 'Describe brevemente el motivo de esta acción...',
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    variant = 'default',
}: ActionReasonDialogProps) {
    const [note, setNote] = useState('');

    const handleClose = () => {
        setNote('');
        onClose();
    };

    const handleConfirm = () => {
        onConfirm(note.trim());
        setNote('');
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-[440px]">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>

                <div className="space-y-1.5">
                    <Label htmlFor="status-note" className="text-sm text-muted-foreground">
                        {reasonLabel}
                    </Label>
                    <Textarea
                        id="status-note"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder={reasonPlaceholder}
                        rows={3}
                        className="resize-none text-sm"
                    />
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="ghost" onClick={handleClose}>
                        {cancelLabel}
                    </Button>
                    <Button variant={variant} onClick={handleConfirm}>
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
