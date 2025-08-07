"use client"

import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { 
  Square, 
  Send, 
  Bot, 
  User, 
  AlertCircle,
  CheckCircle,
  Clock,
  X,
  ChevronDown,
  File
} from 'lucide-react'
import { CAIWebSocketService, StreamEvent } from '@/services/caiWebSocket'
import { useCurlRequest } from '@/contexts/CurlRequestContext'
import { usePayloadAttachment, PayloadFile } from '@/contexts/PayloadAttachmentContext'
import { PayloadSelector } from '@/components/payload-selector'
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
                // <pre className="bg-gray-100 text-red-500 p-4 rounded-lg my-4 overflow-x-auto">
                  <code className="text-sm font-mono">{children}</code>
                // </pre>
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
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentAssistantMessage, setCurrentAssistantMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [currentAgent, setCurrentAgent] = useState('Default Agent')
  const [showPayloadSelector, setShowPayloadSelector] = useState(false)
  const [payloadSelectorPosition, setPayloadSelectorPosition] = useState({ top: 0, left: 0 })
  
  const { attachedRequests, removeRequest, clearAllRequests } = useCurlRequest()
  const { attachedPayloads, attachPayload, removePayload, clearAllPayloads } = usePayloadAttachment()
  
  const wsService = useRef<CAIWebSocketService | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
            setCurrentAgent(event.agent_name)
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
          addSystemMessageLocal('Interrupted')
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
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, currentAssistantMessage])


  const sendMessage = () => {
    if (!inputMessage.trim() || !isConnected || !wsService.current) return

    let messageContent = inputMessage.trim()
    let payloadPaths: string[] = []
    
    // Collect payload paths for backend
    if (attachedPayloads.length > 0) {
      payloadPaths = attachedPayloads.map(payload => payload.file.fullPath)
    }
    
    // Prepend curl requests if attached
    if (attachedRequests.length > 0) {
      const curlCommands = attachedRequests.map(req => req.curlCommand).join('\n\n')
      messageContent = `${curlCommands}\n\n${messageContent}`
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
    
    // Send message with payload paths to WebSocket
    if (payloadPaths.length > 0) {
      wsService.current.sendUserInput(messageContent, payloadPaths)
    } else {
      wsService.current.sendUserInput(messageContent)
    }
    
    setInputMessage('')
    setIsProcessing(true)
    
    // Clear all attached items after sending
    if (attachedRequests.length > 0) {
      clearAllRequests()
    }
    if (attachedPayloads.length > 0) {
      clearAllPayloads()
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

  const handleCancel = () => {
    if (wsService.current) {
      wsService.current.interrupt()
    }
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    const cursorPosition = e.target.selectionStart
    
    setInputMessage(value)
    
    // Check if @ was just typed
    if (value[cursorPosition - 1] === '@' && (cursorPosition === 1 || value[cursorPosition - 2] === ' ')) {
      // Calculate position for payload selector (positioned above textarea)
      const textarea = e.target
      const rect = textarea.getBoundingClientRect()
      
      // Calculate position to show above the textarea
      const selectorHeight = 300 // max height of selector
      const topPosition = rect.top + window.scrollY - selectorHeight - 10 // 10px gap above textarea
      
      setPayloadSelectorPosition({
        top: topPosition,
        left: rect.left + window.scrollX
      })
      setShowPayloadSelector(true)
    } else if (showPayloadSelector) {
      // Check if we should close the selector
      const textBeforeCursor = value.substring(0, cursorPosition)
      const lastAtIndex = textBeforeCursor.lastIndexOf('@')
      
      if (lastAtIndex === -1 || textBeforeCursor.substring(lastAtIndex).includes(' ')) {
        setShowPayloadSelector(false)
      }
    }
  }

  const handlePayloadSelect = (file: PayloadFile) => {
    attachPayload(file)
    
    // Remove the @ trigger from the input
    const cursorPosition = textareaRef.current?.selectionStart || 0
    const textBeforeCursor = inputMessage.substring(0, cursorPosition)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')
    
    if (lastAtIndex !== -1) {
      const newText = inputMessage.substring(0, lastAtIndex) + inputMessage.substring(cursorPosition)
      setInputMessage(newText)
      
      // Focus back to textarea and position cursor
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
          textareaRef.current.setSelectionRange(lastAtIndex, lastAtIndex)
        }
      }, 0)
    }
    
    setShowPayloadSelector(false)
  }

  const handlePayloadSelectorClose = () => {
    setShowPayloadSelector(false)
    if (textareaRef.current) {
      textareaRef.current.focus()
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
      <div className="flex-shrink-0 pt-4 border-t bg-background">
        {/* Attached Payloads Badges */}
        <div className='flex'>
        {attachedPayloads.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-muted-foreground">
                {attachedPayloads.length} payload{attachedPayloads.length > 1 ? 's' : ''} attached
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 hover:bg-transparent text-muted-foreground"
                onClick={clearAllPayloads}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {attachedPayloads.map((payload) => (
                <Badge key={payload.id} variant="outline" className="flex items-center gap-2 bg-purple-50 border-purple-200 text-purple-700">
                  <File className="h-3 w-3" />
                  <span className="text-xs">{payload.preview}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-transparent"
                    onClick={() => removePayload(payload.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Attached Requests Badges */}
        {attachedRequests.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-muted-foreground">
                {attachedRequests.length} request{attachedRequests.length > 1 ? 's' : ''} attached
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 hover:bg-transparent text-muted-foreground"
                onClick={clearAllRequests}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {attachedRequests.map((request) => (
                <Badge key={request.id} variant="outline" className="flex items-center gap-2 bg-orange-50 border-orange-200 text-orange-700">
                  <span className="text-xs font-mono">{request.preview}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-transparent"
                    onClick={() => removeRequest(request.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          </div>
        )}
        </div>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              placeholder="Type your message here... (Use @ to attach payload files)"
              value={inputMessage}
              onChange={handleTextareaChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !showPayloadSelector) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              className="min-h-[44px] max-h-32 resize-none pb-8"
              disabled={!isConnected || isProcessing}
            />
            {/* Agent selector inside textarea */}
            <div className="absolute bottom-2 left-3 flex items-center gap-1 text-xs text-muted-foreground">
              <Bot className="h-3 w-3" />
              <span>{currentAgent}</span>
              <ChevronDown className="h-3 w-3" />
            </div>
          </div>
          <div className="flex gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className='w-12 h-12'
                    variant="outline"
                    size="icon"
                    onClick={handleCancel}
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

      {/* Payload Selector */}
      {showPayloadSelector && (
        <PayloadSelector
          onSelect={handlePayloadSelect}
          onClose={handlePayloadSelectorClose}
          // position={payloadSelectorPosition}
        />
      )}
    </div>
  )
}