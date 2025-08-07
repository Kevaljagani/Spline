"use client"

import React, { createContext, useContext, useState, ReactNode } from 'react'

interface PayloadFile {
  id: string
  name: string
  path: string
  folderName: string
  fullPath: string
}

interface AttachedPayload {
  id: string
  file: PayloadFile
  preview: string
}

interface PayloadAttachmentContextType {
  attachedPayloads: AttachedPayload[]
  attachPayload: (file: PayloadFile) => void
  removePayload: (id: string) => void
  clearAllPayloads: () => void
  isPayloadAttached: (filePath: string) => boolean
}

const PayloadAttachmentContext = createContext<PayloadAttachmentContextType | undefined>(undefined)

interface PayloadAttachmentProviderProps {
  children: ReactNode
}

export function PayloadAttachmentProvider({ children }: PayloadAttachmentProviderProps) {
  const [attachedPayloads, setAttachedPayloads] = useState<AttachedPayload[]>([])

  const attachPayload = (file: PayloadFile) => {
    const existingIndex = attachedPayloads.findIndex(p => p.file.fullPath === file.fullPath)
    
    if (existingIndex >= 0) {
      return
    }

    const newAttachment: AttachedPayload = {
      id: crypto.randomUUID(),
      file,
      preview: `${file.folderName}/${file.path}`
    }

    setAttachedPayloads(prev => [...prev, newAttachment])
  }

  const removePayload = (id: string) => {
    setAttachedPayloads(prev => prev.filter(p => p.id !== id))
  }

  const clearAllPayloads = () => {
    setAttachedPayloads([])
  }

  const isPayloadAttached = (filePath: string) => {
    return attachedPayloads.some(p => p.file.fullPath === filePath)
  }

  return (
    <PayloadAttachmentContext.Provider
      value={{
        attachedPayloads,
        attachPayload,
        removePayload,
        clearAllPayloads,
        isPayloadAttached,
      }}
    >
      {children}
    </PayloadAttachmentContext.Provider>
  )
}

export function usePayloadAttachment() {
  const context = useContext(PayloadAttachmentContext)
  if (context === undefined) {
    throw new Error('usePayloadAttachment must be used within a PayloadAttachmentProvider')
  }
  return context
}

export type { PayloadFile, AttachedPayload }