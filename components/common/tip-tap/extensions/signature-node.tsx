'use client';

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { useRef } from 'react';
import { Upload, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── React NodeView ───────────────────────────────────────────────────────────
function SignatureComponent({ node, updateAttributes, editor }: {
    node: { attrs: SignatureAttrs };
    updateAttributes: (attrs: Partial<SignatureAttrs>) => void;
    editor: { isEditable: boolean };
}) {
    const { name, role, signed, image } = node.attrs;
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isEditable = editor.isEditable;

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const base64 = ev.target?.result as string;
            updateAttributes({ image: base64, signed: true, date: new Date().toISOString() });
        };
        reader.readAsDataURL(file);
    }

    return (
        <NodeViewWrapper style={{ flex: 1, minWidth: 0 }}>
            <div className="rounded-lg border border-dashed p-4 space-y-3 bg-muted/20 select-none">
                {/* Name */}
                {isEditable && !signed ? (
                    <input
                        className="w-full bg-transparent text-sm font-medium border-b border-input outline-none placeholder:text-muted-foreground"
                        placeholder="Nombre"
                        value={name}
                        onChange={(e) => updateAttributes({ name: e.target.value })}
                    />
                ) : (
                    <p className="text-sm font-semibold">{name || 'Nombre'}</p>
                )}

                {/* Role */}
                {isEditable && !signed ? (
                    <input
                        className="w-full bg-transparent text-xs border-b border-input outline-none text-muted-foreground placeholder:text-muted-foreground"
                        placeholder="Cargo / Rol"
                        value={role}
                        onChange={(e) => updateAttributes({ role: e.target.value })}
                    />
                ) : (
                    <p className="text-xs text-muted-foreground">{role || 'Cargo / Rol'}</p>
                )}

                {/* Signature area */}
                <div className="mt-2 min-h-[80px] rounded border border-dashed flex items-center justify-center bg-background">
                    {image ? (
                        <div className="flex flex-col items-center gap-1 p-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={image} alt="Firma" className="max-h-16 max-w-full object-contain" />
                            {signed && (
                                <div className="flex items-center gap-1 text-[10px] text-emerald-600">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Firmado
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-1.5">
                            <p className="text-xs text-muted-foreground">Sin firma</p>
                            {isEditable && (
                                <>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="text-xs h-7 gap-1.5"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <Upload className="h-3 w-3" />
                                        Subir firma
                                    </Button>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleFileChange}
                                    />
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Signature line */}
                <div className="border-t border-foreground/40 pt-1">
                    <p className="text-xs text-muted-foreground">Firma</p>
                </div>
            </div>
        </NodeViewWrapper>
    );
}

// ─── Attrs type ───────────────────────────────────────────────────────────────
interface SignatureAttrs {
    name: string;
    role: string;
    signed: boolean;
    image: string | null;
    date: string | null;
}

// ─── TipTap Node Extension ────────────────────────────────────────────────────
export const SignatureExtension = Node.create({
    name: 'signature',
    group: 'block',
    atom: true,

    addAttributes() {
        return {
            name: { default: '' },
            role: { default: '' },
            signed: { default: false },
            image: { default: null },
            date: { default: null },
        };
    },

    parseHTML() {
        return [{ tag: 'div[data-type="signature"]' }];
    },

    renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
        return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'signature' })];
    },

    addNodeView() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return ReactNodeViewRenderer(SignatureComponent as any);
    },
});
