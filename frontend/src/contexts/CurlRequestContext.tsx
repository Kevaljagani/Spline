"use client"

import React, { createContext, useContext, useState, ReactNode } from 'react'

export interface CurlRequest {
  id: string
  method: string
  url: string
  headers: Record<string, string>
  body: string | null
  curlCommand: string
  preview: string
}

interface CurlRequestContextType {
  attachedRequests: CurlRequest[]
  addRequest: (request: Omit<CurlRequest, 'id' | 'curlCommand' | 'preview'>) => void
  removeRequest: (id: string) => void
  clearAllRequests: () => void
}

const CurlRequestContext = createContext<CurlRequestContextType | undefined>(undefined)

export const useCurlRequest = () => {
  const context = useContext(CurlRequestContext)
  if (context === undefined) {
    throw new Error('useCurlRequest must be used within a CurlRequestProvider')
  }
  return context
}

interface CurlRequestProviderProps {
  children: ReactNode
}

const generateCurlCommand = (method: string, url: string, headers: Record<string, string>, body: string | null): string => {
  let curlCommand = `curl -X ${method}`
  
  // Add headers
  Object.entries(headers).forEach(([key, value]) => {
    curlCommand += ` -H "${key}: ${value}"`
  })
  
  // Add body if present
  if (body && method !== 'GET') {
    curlCommand += ` -d '${body}'`
  }
  
  // Add URL
  curlCommand += ` "${url}"`
  
  return curlCommand
}

const generatePreview = (method: string, url: string): string => {
  try {
    const urlObj = new URL(url)
    return `${method} ${urlObj.hostname}${urlObj.pathname}`
  } catch {
    return `${method} ${url.substring(0, 50)}${url.length > 50 ? '...' : ''}`
  }
}

export const CurlRequestProvider: React.FC<CurlRequestProviderProps> = ({ children }) => {
  const [attachedRequests, setAttachedRequests] = useState<CurlRequest[]>([])

  const addRequest = (request: Omit<CurlRequest, 'id' | 'curlCommand' | 'preview'>) => {
    const curlCommand = generateCurlCommand(request.method, request.url, request.headers, request.body)
    const preview = generatePreview(request.method, request.url)
    
    const newRequest: CurlRequest = {
      ...request,
      id: crypto.randomUUID(),
      curlCommand,
      preview
    }
    
    setAttachedRequests(prev => [...prev, newRequest])
  }

  const removeRequest = (id: string) => {
    setAttachedRequests(prev => prev.filter(req => req.id !== id))
  }

  const clearAllRequests = () => {
    setAttachedRequests([])
  }

  const value: CurlRequestContextType = {
    attachedRequests,
    addRequest,
    removeRequest,
    clearAllRequests
  }

  return (
    <CurlRequestContext.Provider value={value}>
      {children}
    </CurlRequestContext.Provider>
  )
}