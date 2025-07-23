"use client"

import { useState } from "react"
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

export default function ProxyPage() {
  const [isProxyEnabled, setIsProxyEnabled] = useState(false)
  const [contextNotes, setContextNotes] = useState("")

  const sampleRequest = `GET /api/users HTTP/1.1
Host: example.com
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36
Accept: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "filter": "active",
  "limit": 50
}`

  const sampleResponse = `HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 1234
Date: Mon, 22 Jul 2025 10:30:00 GMT
Server: nginx/1.18.0

{
  "status": "success",
  "data": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "role": "admin"
    },
    {
      "id": 2,
      "name": "Jane Smith", 
      "email": "jane@example.com",
      "role": "user"
    }
  ],
  "total": 2
}`

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
            
            <div className="flex bg-secondary items-center gap-3 border rounded-lg p-2">
              <span className={`text-sm font-medium `}>
                Intercept
              </span>
              <Switch
                checked={isProxyEnabled}
                onCheckedChange={setIsProxyEnabled}
                className={`${
                  isProxyEnabled 
                    ? 'data-[state=checked]:bg-green-500' 
                    : 'data-[state=unchecked]:bg-red-500'
                }`}
              />
            </div>
          </header>
          
          <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
            {/* Main Content - Request/Response Split */}
            <div className="flex-1 flex gap-4 min-h-0">
              {/* Left Side - Request */}
              <div className="flex-1 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">HTTP Request</h3>
                  <div className="flex gap-2">
                    <Button size="sm">
                      Forward
                    </Button>
                    <Button size="sm" variant="outline" className="se">
                      Drop
                    </Button>
                    <Button size="sm" variant="ai">
                      Add to Context
                    </Button>
                  </div>
                </div>
                <div className="flex-1 rounded-lg border overflow-hidden">
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
                    {sampleRequest}
                  </SyntaxHighlighter>
                </div>
              </div>

              {/* Right Side - Response */}
              <div className="flex-1 flex flex-col gap-2">
                <h3 className="text-lg font-semibold">HTTP Response</h3>
                <div className="flex-1 rounded-lg border overflow-hidden">
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
                    {sampleResponse}
                  </SyntaxHighlighter>
                </div>
              </div>
            </div>

            {/* Bottom Section - Context Tab */}
            <div className="h-48 border-t pt-4">
              <Tabs defaultValue="context" className="h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-1 max-w-[200px]">
                  <TabsTrigger value="context">Context</TabsTrigger>
                </TabsList>
                <TabsContent value="context" className="flex-1 flex flex-col gap-2 mt-2">
                  <div className="flex-1">
                    <Textarea
                      placeholder="Add context notes for AI analysis..."
                      value={contextNotes}
                      onChange={(e) => setContextNotes(e.target.value)}
                      className="h-full resize-none"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" variant="ai">
                      Send to Xploiter
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}
