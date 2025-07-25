"use client"

import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { 
  Play, 
  Pause, 
  Square, 
  Send, 
  Bot, 
  User, 
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react'
import { CAIWebSocketService, StreamEvent } from '@/services/caiWebSocket'

interface ChatMessage {
  id: string
  type: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  status?: 'sending' | 'sent' | 'streaming' | 'completed' | 'error'
}

interface ChatInterfaceProps {
  className?: string
}

export function ChatInterface({ className }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
  const [currentAssistantMessage, setCurrentAssistantMessage] = useState('')
  
  const wsService = useRef<CAIWebSocketService | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    wsService.current = new CAIWebSocketService()
    
    const addSystemMessageLocal = (content: string, type: 'info' | 'error' = 'info') => {
      const newMessage: ChatMessage = {
        id: crypto.randomUUID(),
        type: 'system',
        content,
        timestamp: new Date(),
        status: type === 'error' ? 'error' : 'completed'
      }
      setMessages(prev => [...prev, newMessage])
    }

    const finalizeAssistantMessageLocal = () => {
      setCurrentAssistantMessage(prev => {
        if (prev.trim()) {
          const newMessage: ChatMessage = {
            id: crypto.randomUUID(),
            type: 'assistant',
            content: prev.trim(),
            timestamp: new Date(),
            status: 'completed'
          }
          setMessages(prevMessages => [...prevMessages, newMessage])
        }
        return ''
      })
    }

    const handleStreamEventLocal = (event: StreamEvent) => {
      if (isPaused) return

      switch (event.type) {
        case 'raw_response':
          if (event.data?.delta) {
            setCurrentAssistantMessage(prev => prev + (event.data!.delta as string))
          }
          break
        case 'run_item':
          if (event.name === 'tool_called') {
            addSystemMessageLocal(`Tool called: ${(event.item as { tool_name?: string })?.tool_name}`)
          } else if (event.name === 'tool_output') {
            addSystemMessageLocal(`Tool completed: ${(event.item as { tool_name?: string })?.tool_name}`)
          }
          break
        case 'agent_updated':
          if (event.agent_name) {
            addSystemMessageLocal(`Agent changed to: ${event.agent_name}`)
          }
          break
      }
    }
    
    wsService.current.onConnectionChange = (connected) => {
      setIsConnected(connected)
      setConnectionStatus(connected ? 'connected' : 'disconnected')
      if (connected) {
        addSystemMessageLocal('Connected to CAI WebSocket server')
      } else {
        addSystemMessageLocal('Disconnected from CAI WebSocket server')
      }
    }
    
    wsService.current.onStatusChange = (status) => {
      switch (status) {
        case 'processing':
          setIsProcessing(true)
          break
        case 'completed':
          setIsProcessing(false)
          setCurrentAssistantMessage(prev => {
            if (prev.trim()) {
              finalizeAssistantMessageLocal()
            }
            return prev
          })
          break
        case 'interrupted':
          setIsProcessing(false)
          addSystemMessageLocal('Request was interrupted')
          break
      }
    }
    
    wsService.current.onStreamEvent = handleStreamEventLocal
    
    wsService.current.onError = (error) => {
      addSystemMessageLocal(`Error: ${error}`, 'error')
      setIsProcessing(false)
    }

    const connectToServerLocal = async () => {
      if (!wsService.current) return
      
      setConnectionStatus('connecting')
      try {
        await wsService.current.connect()
      } catch {
        setConnectionStatus('disconnected')
        addSystemMessageLocal('Failed to connect to CAI WebSocket server', 'error')
      }
    }

    connectToServerLocal()

    return () => {
      if (wsService.current) {
        wsService.current.disconnect()
      }
    }
  }, [isPaused])

  useEffect(() => {
    scrollToBottom()
  }, [messages, currentAssistantMessage])


  const sendMessage = () => {
    if (!inputMessage.trim() || !isConnected || !wsService.current) return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      type: 'user',
      content: inputMessage.trim(),
      timestamp: new Date(),
      status: 'sent'
    }

    setMessages(prev => [...prev, userMessage])
    wsService.current.sendUserInput(inputMessage.trim())
    setInputMessage('')
    setIsProcessing(true)
  }

  const handlePause = () => {
    setIsPaused(!isPaused)
    if (!isPaused) {
      addSystemMessage('Stream paused')
    } else {
      addSystemMessage('Stream resumed')
    }
  }

  const handleCancel = () => {
    if (wsService.current && isProcessing) {
      wsService.current.interrupt()
      setIsProcessing(false)
      addSystemMessage('Request cancelled')
      if (currentAssistantMessage) {
        finalizeAssistantMessage()
      }
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'sending':
        return <Clock className="h-3 w-3" />
      case 'sent':
      case 'completed':
        return <CheckCircle className="h-3 w-3" />
      case 'error':
        return <AlertCircle className="h-3 w-3" />
      default:
        return null
    }
  }

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'bg-green-500'
      case 'connecting':
        return 'bg-yellow-500'
      default:
        return 'bg-red-500'
    }
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${getConnectionStatusColor()}`} />
          <span className="text-sm font-medium">
            CAI Chat - {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePause}
            disabled={!isProcessing}
          >
            {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {isPaused ? 'Resume' : 'Pause'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={!isProcessing}
          >
            <Square className="h-4 w-4" />
            Cancel
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messages.map((message) => (
            <div key={message.id} className="flex gap-3">
              <div className="flex-shrink-0">
                {message.type === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                    <User className="h-4 w-4 text-white" />
                  </div>
                )}
                {message.type === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                )}
                {message.type === 'system' && (
                  <div className="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center">
                    <AlertCircle className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {message.type === 'user' ? 'You' : 
                     message.type === 'assistant' ? 'Assistant' : 'System'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                  {getStatusIcon(message.status)}
                </div>
                <div className={`text-sm ${message.type === 'system' ? 'text-muted-foreground italic' : ''}`}>
                  {message.content}
                </div>
              </div>
            </div>
          ))}

          {/* Current streaming message */}
          {currentAssistantMessage && (
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-white" />
                </div>
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Assistant</span>
                  <Badge variant="secondary" className="text-xs">Streaming</Badge>
                </div>
                <div className="text-sm">
                  {currentAssistantMessage}
                  <span className="animate-pulse">▋</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Textarea
            placeholder="Type your message here..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            className="flex-1 min-h-[44px] max-h-32 resize-none"
            disabled={!isConnected || isProcessing}
          />
          <Button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || !isConnected || isProcessing}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {!isConnected && (
          <p className="text-xs text-muted-foreground mt-2">
            Not connected to CAI WebSocket server. Please check the server is running on localhost:8765.
          </p>
        )}
      </div>
    </div>
  )
}