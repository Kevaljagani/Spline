"use client"

import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'

interface InterceptedRequest {
  id: number
  method: string
  url: string
  headers: Record<string, string>
  body: string | null
  host: string
  timestamp: string
}

interface WebSocketContextType {
  isConnected: boolean
  requests: InterceptedRequest[]
  setRequests: React.Dispatch<React.SetStateAction<InterceptedRequest[]>>
  sendMessage: (message: any) => void
  isInterceptEnabled: boolean
  setIsInterceptEnabled: React.Dispatch<React.SetStateAction<boolean>>
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined)

export const useWebSocket = () => {
  const context = useContext(WebSocketContext)
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider')
  }
  return context
}

interface WebSocketProviderProps {
  children: ReactNode
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false)
  const [requests, setRequests] = useState<InterceptedRequest[]>([])
  const [isInterceptEnabled, setIsInterceptEnabled] = useState(true)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const connectWebSocket = () => {
      const ws = new WebSocket('ws://localhost:3001')
      
      ws.onopen = () => {
        setIsConnected(true)
        // Send current intercept state to backend
        fetch('http://localhost:3001/api/set-intercept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: isInterceptEnabled })
        })
      }
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log('WebSocket message received:', data)
          
          if (data.type === 'new_request') {
            const newRequest: InterceptedRequest = {
              id: data.id,
              method: data.method,
              url: data.url,
              headers: data.headers,
              body: data.body,
              host: data.host,
              timestamp: new Date().toISOString()
            }
            
            console.log('Adding request to queue:', newRequest)
            
            // Add to queue for manual review (only sent when intercept is enabled)
            setRequests(prev => [...prev, newRequest])
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }
      
      ws.onclose = () => {
        setIsConnected(false)
        // Reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000)
      }
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }
      
      wsRef.current = ws
    }
    
    connectWebSocket()
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  // Handle intercept toggle changes
  useEffect(() => {
    if (isConnected) {
      fetch('http://localhost:3001/api/set-intercept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: isInterceptEnabled })
      })
    }
  }, [isInterceptEnabled, isConnected])

  const sendMessage = (message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    }
  }

  const value: WebSocketContextType = {
    isConnected,
    requests,
    setRequests,
    sendMessage,
    isInterceptEnabled,
    setIsInterceptEnabled
  }

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  )
}