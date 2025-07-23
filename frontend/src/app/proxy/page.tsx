"use client"

import { useState, useEffect, useRef } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface InterceptedRequest {
  id: number
  method: string
  url: string
  headers: Record<string, string>
  body: string | null
  host: string
  timestamp: string
}



export default function ProxyPage() {
  const [isProxyEnabled, setIsProxyEnabled] = useState(false)
  const [contextNotes, setContextNotes] = useState("")
  const [requests, setRequests] = useState<InterceptedRequest[]>([])
  const [selectedRequestIndex, setSelectedRequestIndex] = useState(0)
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const connectWebSocket = () => {
      const ws = new WebSocket('ws://localhost:3001')
      
      ws.onopen = () => {
        setIsConnected(true)
      }
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
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

  const handleProxyDecision = (action: 'forward' | 'drop') => {
    if (requests.length === 0) return
    
    const currentRequest = requests[selectedRequestIndex]
    if (!currentRequest) return
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'proxy_decision',
        requestId: currentRequest.id,
        action: action
      }))
    }
    
    // Always remove the request after decision
    setRequests(prev => prev.filter((_, index) => index !== selectedRequestIndex))
    // Adjust selected index if needed
    if (selectedRequestIndex >= requests.length - 1) {
      setSelectedRequestIndex(Math.max(0, requests.length - 2))
    }
  }

  const formatRequestDisplay = (request: InterceptedRequest) => {
    const headerLines = Object.entries(request.headers)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n')
    
    let requestText = `${request.method} ${request.url} HTTP/1.1\n${headerLines}`
    
    if (request.body) {
      requestText += `\n\n${request.body}`
    }
    
    return requestText
  }

  const currentRequest = requests[selectedRequestIndex]

  return (
    <div className="flex h-screen bg-background">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="flex-1 overflow-hidden">
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 justify-between">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 h-4"
              />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="/">
                      Torpedo Proxy Manager
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Proxy</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex bg-secondary items-center gap-3 border rounded-lg p-2">
                <span className={`text-sm font-medium`}>
                  Intercept
                </span>
                <Switch
                  checked={isConnected}
                  onCheckedChange={setIsProxyEnabled}
                  disabled={!isConnected}
                  className={`${
                    isConnected
                      ? 'data-[state=checked]:bg-green-500' 
                      : 'data-[state=unchecked]:bg-red-500'
                  }`}
                />
              </div>
            </div>
          </header>
          
          <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
            {/* Request Queue Header */}
            <div className="flex items-center gap-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg min-h-[60px]">
              <span className="text-sm font-medium">
                {requests.length > 0 ? 'Queue:' : 'Waiting for requests...'}
              </span>
              <div className="flex gap-2">
                {requests.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedRequestIndex(index)}
                    className={`w-8 h-8 rounded text-xs ${
                      index === selectedRequestIndex
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 hover:bg-gray-300'
                    }`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col gap-2 min-h-0">
              {/* Request Section */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Request</h3>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    onClick={() => handleProxyDecision('forward')}
                    disabled={!currentRequest}
                  >
                    Forward
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleProxyDecision('drop')}
                    disabled={!currentRequest}
                  >
                    Drop
                  </Button>
                  <Button size="sm" variant="ai" disabled={!currentRequest}>
                    Add to Context
                  </Button>
                </div>
              </div>
              <div className="flex-1 rounded-lg border overflow-hidden">
                {currentRequest ? (
                  <SyntaxHighlighter
                    language="http"
                    style={oneLight}
                    customStyle={{
                      margin: 0,
                      height: '100%',
                      fontSize: '14px',
                    }}
                    wrapLongLines={true}
                  >
                    {formatRequestDisplay(currentRequest)}
                  </SyntaxHighlighter>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                    Configure your browser to use localhost:8080 as HTTP proxy
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Section - Context */}
            <div className="h-24">
              <div className="h-full relative">
                <Textarea
                  placeholder="Add context notes for AI analysis..."
                  value={contextNotes}
                  onChange={(e) => setContextNotes(e.target.value)}
                  className="h-full resize-none pr-32"
                />
                <Button 
                  size="sm" 
                  variant="ai"
                  className="absolute bottom-2 right-2"
                >
                  Send to Xploiter
                </Button>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}
