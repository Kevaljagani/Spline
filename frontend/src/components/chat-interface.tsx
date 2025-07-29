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
  Clock,
  X
} from 'lucide-react'
import { CAIWebSocketService, StreamEvent } from '@/services/caiWebSocket'
import { useCurlRequest } from '@/contexts/CurlRequestContext'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

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

function FormattedContent({ content }: { content: string }) {
  return (
    <div className="space-y-3 leading-relaxed">
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          code({ children, className }: any) {
            const isBlock = className?.includes('language-')
            const text = String(children).trim()
            const isCurl = text.startsWith('curl')
            
            if (isBlock || isCurl) {
              return (
                <pre className="bg-gray-100 text-red-500 p-4 rounded-lg my-4 overflow-x-auto">
                  <code className="text-sm font-mono">{children}</code>
                </pre>
              )
            } else {
              return (
                <code className="bg-gray-100 text-red-500 px-2 py-1 rounded text-sm font-mono">
                  {children}
                </code>
              )
            }
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export function ChatInterface({ className }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentAssistantMessage, setCurrentAssistantMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  
  const { attachedRequest, removeRequest } = useCurlRequest()
  
  const wsService = useRef<CAIWebSocketService | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Load messages from database on component mount
    const loadMessages = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/chat-messages')
        if (response.ok) {
          const storedMessages = await response.json()
          setMessages(storedMessages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          })))
        }
      } catch (error) {
        console.error('Failed to load messages:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadMessages()
    
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
          saveMessage(newMessage)
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
      if (connected) {
        addSystemMessageLocal('Connected to Agent WebSocket server')
      } else {
        addSystemMessageLocal('Disconnected from Agent WebSocket server')
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
      
      try {
        await wsService.current.connect()
      } catch {
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

    let messageContent = inputMessage.trim()
    
    // Prepend curl request if attached
    if (attachedRequest) {
      messageContent = `${attachedRequest.curlCommand}\n\n${messageContent}`
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      type: 'user',
      content: messageContent,
      timestamp: new Date(),
      status: 'sent'
    }

    setMessages(prev => [...prev, userMessage])
    saveMessage(userMessage)
    wsService.current.sendUserInput(messageContent)
    setInputMessage('')
    setIsProcessing(true)
    
    // Clear the attached request after sending
    if (attachedRequest) {
      removeRequest()
    }
  }

  const saveMessage = async (message: ChatMessage) => {
    try {
      await fetch('http://localhost:3001/api/chat-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
      })
    } catch (error) {
      console.error('Failed to save message:', error)
    }
  }

  const addSystemMessage = (content: string, type: 'info' | 'error' = 'info') => {
    const newMessage: ChatMessage = {
      id: crypto.randomUUID(),
      type: 'system',
      content,
      timestamp: new Date(),
      status: type === 'error' ? 'error' : 'completed'
    }
    setMessages(prev => [...prev, newMessage])
  }

  const finalizeAssistantMessage = () => {
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
        saveMessage(newMessage)
      }
      return ''
    })
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
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



  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-muted-foreground">Loading chat history...</div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>

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
                     message.type === 'assistant' ? 'Xploiter' : 'System'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                  {getStatusIcon(message.status)}
                </div>
                <div className={`text-sm ${message.type === 'system' ? 'text-muted-foreground italic' : ''}`}>
                  <FormattedContent content={message.content} />
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
                  <span className="text-sm font-medium">Xploiter</span>
                  <Badge variant="secondary" className="text-xs">Streaming</Badge>
                </div>
                <div className="text-sm">
                  <FormattedContent content={currentAssistantMessage} />
                  <span className="animate-pulse">▋</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="pt-4 border-t">
        {/* Attached Request Badge */}
        {attachedRequest && (
          <div className="mb-3 flex items-center gap-2">
            <Badge variant="secondary" className="flex items-center gap-2">
              <span className="text-xs font-mono">{attachedRequest.preview}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={removeRequest}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
            <span className="text-xs text-muted-foreground">Request attached</span>
          </div>
        )}
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
          <div className="flex gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className='w-12 h-12'
                    variant="outline"
                    size="icon"
                    onClick={handlePause}
                    disabled={!isProcessing}
                  >
                    {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isPaused ? 'Resume stream' : 'Pause stream'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className='w-12 h-12'
                    variant="outline"
                    size="icon"
                    onClick={handleCancel}
                    disabled={!isProcessing}
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Cancel request</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className='w-12 h-12'
                    onClick={sendMessage}
                    disabled={!inputMessage.trim() || !isConnected || isProcessing}
                    size="icon"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Send message</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        {!isConnected && (
          <p className="text-xs text-muted-foreground mt-2">
            Not connected to Agent server. Please check the server is running on localhost:8765.
          </p>
        )}
      </div>
    </div>
  )
}