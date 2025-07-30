"use client"

import { useState, useEffect } from "react"
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
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { ChevronDown, Search, Play, Edit3 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { useCurlRequest } from "@/contexts/CurlRequestContext"

interface StoredRequest {
  id: number
  method: string
  url: string
  headers: Record<string, string>
  body: string | null
  host: string
  timestamp: string
  status?: number
  response?: {
    headers: Record<string, string>
    body: string
    status: number
  }
}

export default function ReplayPage() {
  const [storedRequests, setStoredRequests] = useState<StoredRequest[]>([])
  const [filteredRequests, setFilteredRequests] = useState<StoredRequest[]>([])
  const [selectedRequest, setSelectedRequest] = useState<StoredRequest | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedDomain, setSelectedDomain] = useState<string>("All Domains")
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editableRequest, setEditableRequest] = useState<StoredRequest | null>(null)
  const { toast } = useToast()
  const { addRequest } = useCurlRequest()

  // Fetch stored requests on component mount
  useEffect(() => {
    fetchStoredRequests()
  }, [])

  const fetchStoredRequests = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/stored-requests')
      if (response.ok) {
        const requests = await response.json()
        setStoredRequests(requests)
        setFilteredRequests(requests)
      }
    } catch (error) {
      console.error('Error fetching stored requests:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Filter requests based on search term and domain
  useEffect(() => {
    let filtered = storedRequests
    
    if (searchTerm) {
      filtered = filtered.filter(req => 
        req.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.method.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.host.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    
    if (selectedDomain !== "All Domains") {
      filtered = filtered.filter(req => req.host === selectedDomain)
    }
    
    setFilteredRequests(filtered)
  }, [searchTerm, selectedDomain, storedRequests])

  // Get unique domains from stored requests
  const uniqueDomains = Array.from(new Set(storedRequests.map(req => req.host)))

  const formatRequestDisplay = (request: StoredRequest) => {
    const headerLines = Object.entries(request.headers)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n')
    
    let requestText = `${request.method} ${request.url} HTTP/1.1\n${headerLines}`
    
    if (request.body) {
      requestText += `\n\n${request.body}`
    }
    
    return requestText
  }

  const formatResponseDisplay = (response: StoredRequest['response']) => {
    if (!response) return 'No response data available'
    
    const headerLines = Object.entries(response.headers || {})
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n')
    
    let responseText = `HTTP/1.1 ${response.status || 'Unknown'}\n${headerLines}`
    
    if (response.body) {
      responseText += `\n\n${response.body}`
    }
    
    return responseText
  }

  const handleReplayRequest = async (request: StoredRequest) => {
    try {
      const requestToReplay = isEditing && editableRequest ? editableRequest : request
      
      const response = await fetch('http://localhost:3001/api/replay-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method: requestToReplay.method,
          url: requestToReplay.url,
          headers: requestToReplay.headers,
          body: requestToReplay.body
        })
      })
      
      if (response.ok) {
        const result = await response.json()
        console.log('Request replayed successfully', result)
        
        // Create updated request with new response data
        const updatedRequest = { 
          ...request, 
          response: {
            status: result.status || result.statusCode || 200,
            headers: result.headers || {},
            body: result.body || result.data || ''
          }
        }
        
        // Update the requests array
        const updatedRequests = storedRequests.map(req => 
          req.id === request.id ? updatedRequest : req
        )
        setStoredRequests(updatedRequests)
        
        // Update filtered requests based on current filters
        let filtered = updatedRequests
        if (searchTerm) {
          filtered = filtered.filter(req => 
            req.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
            req.method.toLowerCase().includes(searchTerm.toLowerCase()) ||
            req.host.toLowerCase().includes(searchTerm.toLowerCase())
          )
        }
        if (selectedDomain !== "All Domains") {
          filtered = filtered.filter(req => req.host === selectedDomain)
        }
        setFilteredRequests(filtered)
        
        // Update selected request to show new response
        setSelectedRequest(updatedRequest)
        
        // Exit edit mode
        setIsEditing(false)
        setEditableRequest(null)
      } else {
        const errorText = await response.text()
        console.error('Failed to replay request:', errorText)
        alert('Failed to replay request: ' + errorText)
      }
    } catch (error) {
      console.error('Error replaying request:', error)
      alert('Error replaying request: ' + (error instanceof Error ? error.message : String(error)))
    }
  }
  
  const handleStartEditing = () => {
    if (selectedRequest) {
      setIsEditing(true)
      setEditableRequest({ ...selectedRequest })
    }
  }
  
  const handleCancelEditing = () => {
    setIsEditing(false)
    setEditableRequest(null)
  }
  
  const handleUpdateEditableRequest = (field: string, value: any) => {
    if (editableRequest) {
      setEditableRequest({ ...editableRequest, [field]: value })
    }
  }

  const handleAddToContext = () => {
    if (!selectedRequest) return
    
    const requestToAdd = isEditing && editableRequest ? editableRequest : selectedRequest
    
    addRequest({
      method: requestToAdd.method,
      url: requestToAdd.url,
      headers: requestToAdd.headers,
      body: requestToAdd.body
    })
    
    toast({
      variant: "default",
      title: "Request Added to Context",
      description: "The curl request has been attached and will be included in your next xploiter message",
    })
  }

  return (
    <div className="flex h-screen bg-background">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="flex-1 overflow-hidden">
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
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
                  <BreadcrumbPage>Replay</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </header>
          
          <div className="flex h-[calc(100vh-4rem)] gap-4 p-4">
            {/* Left Panel - 30% */}
            <div className="w-[30%] min-w-[30%] flex flex-col gap-4">
              {/* Search Bar */}
              <div className="relative flex-shrink-0">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search requests..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {/* Domain Filter */}
              <div className="flex-shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      {selectedDomain}
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-full">
                    <DropdownMenuItem onClick={() => setSelectedDomain("All Domains")}>
                      All Domains
                    </DropdownMenuItem>
                    {uniqueDomains.map(domain => (
                      <DropdownMenuItem key={domain} onClick={() => setSelectedDomain(domain)}>
                        {domain}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              {/* Request List */}
              <div className="flex-1 min-h-0 overflow-auto border rounded-lg">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <span className="text-sm text-gray-500">Loading requests...</span>
                  </div>
                ) : filteredRequests.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <span className="text-sm text-gray-500">No requests found</span>
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredRequests.map((request) => (
                      <div
                        key={request.id}
                        className={`p-3 cursor-pointer hover:bg-gray-50 relative ${
                          selectedRequest?.id === request.id ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => setSelectedRequest(request)}
                      >
                        {selectedRequest?.id === request.id && (
                          <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r"></div>
                        )}
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-medium px-2 py-1 rounded ${
                            request.method === 'GET' ? 'bg-green-100 text-green-800' :
                            request.method === 'POST' ? 'bg-blue-100 text-blue-800' :
                            request.method === 'PUT' ? 'bg-yellow-100 text-yellow-800' :
                            request.method === 'DELETE' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {request.method}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(request.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="text-sm font-medium truncate" title={request.url}>
                          {new URL(request.url).pathname}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {request.host}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* Right Panel - 70% */}
            <div className="w-[70%] min-w-[70%] flex flex-col gap-4">
              {/* Header with Replay Button */}
              <div className="flex items-center justify-between flex-shrink-0">
                <h3 className="text-lg font-semibold truncate">
                  {selectedRequest ? `${selectedRequest.method} ${selectedRequest.url}` : 'No request selected'}
                </h3>
                {selectedRequest && (
                  <div className="flex items-center gap-2 flex-shrink-0 mr-4">
                    {isEditing ? (
                      <>
                        <Button 
                          variant="outline"
                          onClick={handleCancelEditing}
                          className="flex items-center gap-2"
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={() => handleReplayRequest(selectedRequest)}
                          className="flex items-center gap-2"
                        >
                          <Play className="h-4 w-4" />
                          Replay Edited
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ai" 
                          onClick={handleAddToContext}
                          className="flex items-center gap-2"
                        >
                          Add to Context
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button 
                          variant="outline"
                          onClick={handleStartEditing}
                          className="flex items-center gap-2"
                        >
                          <Edit3 className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button 
                          onClick={() => handleReplayRequest(selectedRequest)}
                          className="flex items-center gap-2"
                        >
                          <Play className="h-4 w-4" />
                          Replay
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ai" 
                          onClick={handleAddToContext}
                          className="flex items-center gap-2"
                        >
                          Add to Context
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
              
              {/* Request and Response Display */}
              <div className="flex-1 min-h-0 flex flex-col gap-4">
                {/* Request - Top Half */}
                <div className="flex-1 min-h-0 flex flex-col">
                  <h4 className="text-md font-medium mb-2 flex-shrink-0">Request {isEditing && '(Editing)'}</h4>
                  <div className="flex-1 min-h-0 rounded-lg border overflow-hidden">
                    {selectedRequest ? (
                      isEditing && editableRequest ? (
                        <div className="h-full flex flex-col gap-2 p-4 overflow-auto">
                          <div className="flex gap-2">
                            <select 
                              value={editableRequest.method}
                              onChange={(e) => handleUpdateEditableRequest('method', e.target.value)}
                              className="mx-2 py-2 px-3 border rounded bg-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              style={{ backgroundImage: "url('data:image/svg+xml;charset=US-ASCII,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 4 5\"><path fill=\"%23666\" d=\"M2 0L0 2h4zm0 5L0 3h4z\"/></svg>')", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '12px' }}
                            >
                              <option value="GET">GET</option>
                              <option value="POST">POST</option>
                              <option value="PUT">PUT</option>
                              <option value="DELETE">DELETE</option>
                              <option value="PATCH">PATCH</option>
                              <option value="HEAD">HEAD</option>
                              <option value="OPTIONS">OPTIONS</option>
                            </select>
                            <input 
                              value={editableRequest.url}
                              onChange={(e) => handleUpdateEditableRequest('url', e.target.value)}
                              className="flex-1 px-3 py-2 border rounded"
                              placeholder="URL"
                            />
                          </div>
                          <div className="flex-1 flex flex-col gap-2">
                            <label className="text-sm font-medium">Headers (JSON format):</label>
                            <textarea 
                              value={JSON.stringify(editableRequest.headers, null, 2)}
                              onChange={(e) => {
                                try {
                                  const headers = JSON.parse(e.target.value)
                                  handleUpdateEditableRequest('headers', headers)
                                } catch (err) {
                                  // Invalid JSON, keep the text for user to fix
                                }
                              }}
                              className="flex-1 px-3 py-2 border rounded font-mono text-sm"
                              placeholder='{"Content-Type": "application/json"}'
                            />
                            <label className="text-sm font-medium">Body:</label>
                            <textarea 
                              value={editableRequest.body || ''}
                              onChange={(e) => handleUpdateEditableRequest('body', e.target.value || null)}
                              className="flex-1 px-3 py-2 border rounded font-mono text-sm"
                              placeholder="Request body (optional)"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="h-full overflow-auto">
                          <SyntaxHighlighter
                            language="http"
                            style={oneLight}
                            customStyle={{
                              margin: 0,
                              fontSize: '14px',
                            }}
                            wrapLongLines={true}
                          >
                            {formatRequestDisplay(selectedRequest)}
                          </SyntaxHighlighter>
                        </div>
                      )
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-500">
                        <span className="text-sm">No request selected</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Response - Bottom Half */}
                <div className="flex-1 min-h-0 flex flex-col">
                  <h4 className="text-md font-medium mb-2 flex-shrink-0">Response</h4>
                  <div className="flex-1 min-h-0 rounded-lg border overflow-hidden">
                    {selectedRequest ? (
                      <div className="h-full overflow-auto">
                        <SyntaxHighlighter
                          language="http"
                          style={oneLight}
                          customStyle={{
                            margin: 0,
                            fontSize: '14px',
                          }}
                          wrapLongLines={true}
                        >
                          {formatResponseDisplay(selectedRequest.response)}
                        </SyntaxHighlighter>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-500">
                        <span className="text-sm">No response to display</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
    </div>
  )
}
