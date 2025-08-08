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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { 
  Upload, 
  GitBranch, 
  Folder, 
  File, 
  ArrowLeft, 
  Eye, 
  Trash2,
  RefreshCw 
} from "lucide-react"

interface FileItem {
  name: string
  type: 'file' | 'directory'
  path: string
}

interface PreviewData {
  content: string
}

export default function PayloadsPage() {
  const [mounted, setMounted] = useState(false)
  const [payloadFolders, setPayloadFolders] = useState<string[]>([])
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [currentPath, setCurrentPath] = useState<string>("")
  const [folderContents, setFolderContents] = useState<FileItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false)
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [previewContent, setPreviewContent] = useState<string>("")
  const [previewFileName, setPreviewFileName] = useState<string>("")
  const [folderName, setFolderName] = useState("")
  const [gitUrl, setGitUrl] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const loadPayloadFolders = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/payloads')
      if (response.ok) {
        const folders = await response.json()
        setPayloadFolders(folders)
      }
    } catch (error) {
      console.error('Error loading payload folders:', error)
    }
  }

  const loadFolderContents = async (folder: string, path: string = "") => {
    try {
      setIsLoading(true)
      const url = new URL(`http://localhost:3001/api/payloads/${folder}/browse`)
      if (path) {
        url.searchParams.set('path', path)
      }
      
      const response = await fetch(url.toString())
      if (response.ok) {
        const contents = await response.json()
        setFolderContents(contents)
      } else {
        toast({
          title: "Error",
          description: "Failed to load folder contents",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error loading folder contents:', error)
      toast({
        title: "Error", 
        description: "Failed to load folder contents",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleFolderClick = (folder: string) => {
    setSelectedFolder(folder)
    setCurrentPath("")
    loadFolderContents(folder)
  }

  const handleItemClick = (item: FileItem) => {
    if (item.type === 'directory') {
      setCurrentPath(item.path)
      loadFolderContents(selectedFolder!, item.path)
    } else if (item.name.endsWith('.txt')) {
      previewFile(item)
    }
  }

  const previewFile = async (item: FileItem) => {
    try {
      const url = new URL(`http://localhost:3001/api/payloads/${selectedFolder}/file`)
      url.searchParams.set('path', item.path)
      
      const response = await fetch(url.toString())
      if (response.ok) {
        const data: PreviewData = await response.json()
        setPreviewContent(data.content)
        setPreviewFileName(item.name)
        setPreviewDialogOpen(true)
      } else {
        toast({
          title: "Error",
          description: "Failed to load file content",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error previewing file:', error)
      toast({
        title: "Error",
        description: "Failed to preview file",
        variant: "destructive"
      })
    }
  }

  const handleBackClick = () => {
    if (currentPath === "") {
      setSelectedFolder(null)
      setFolderContents([])
    } else {
      const pathParts = currentPath.split('/').filter(Boolean)
      pathParts.pop()
      const newPath = pathParts.join('/')
      setCurrentPath(newPath)
      loadFolderContents(selectedFolder!, newPath)
    }
  }

  const handleFileUpload = async (event: React.FormEvent) => {
    event.preventDefault()
    const files = fileInputRef.current?.files
    
    if (!files || files.length === 0 || !folderName.trim()) {
      toast({
        title: "Error",
        description: "Please select files and enter a folder name",
        variant: "destructive"
      })
      return
    }

    const formData = new FormData()
    formData.append('folderName', folderName.trim())
    
    Array.from(files).forEach(file => {
      formData.append('files', file)
    })

    try {
      setIsLoading(true)
      const response = await fetch('http://localhost:3001/api/payloads/upload', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Files uploaded successfully"
        })
        setUploadDialogOpen(false)
        setFolderName("")
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
        loadPayloadFolders()
      } else {
        const error = await response.json()
        toast({
          title: "Error",
          description: error.error || "Failed to upload files",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error uploading files:', error)
      toast({
        title: "Error",
        description: "Failed to upload files",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleGitClone = async (event: React.FormEvent) => {
    event.preventDefault()
    
    if (!gitUrl.trim() || !folderName.trim()) {
      toast({
        title: "Error", 
        description: "Please enter both Git URL and folder name",
        variant: "destructive"
      })
      return
    }

    try {
      setIsLoading(true)
      const response = await fetch('http://localhost:3001/api/payloads/clone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          gitUrl: gitUrl.trim(),
          folderName: folderName.trim()
        })
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Repository cloned successfully"
        })
        setCloneDialogOpen(false)
        setGitUrl("")
        setFolderName("")
        loadPayloadFolders()
      } else {
        const error = await response.json()
        toast({
          title: "Error",
          description: error.error || "Failed to clone repository",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error cloning repository:', error)
      toast({
        title: "Error",
        description: "Failed to clone repository",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const deleteFolder = async (folderName: string) => {
    if (!confirm(`Are you sure you want to delete the folder "${folderName}"?`)) {
      return
    }

    try {
      const response = await fetch(`http://localhost:3001/api/payloads/${folderName}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Folder deleted successfully"
        })
        setSelectedFolder(null)
        setFolderContents([])
        loadPayloadFolders()
      } else {
        const error = await response.json()
        toast({
          title: "Error",
          description: error.error || "Failed to delete folder",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error deleting folder:', error)
      toast({
        title: "Error",
        description: "Failed to delete folder",
        variant: "destructive"
      })
    }
  }

  useEffect(() => {
    setMounted(true)
    loadPayloadFolders()
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <div className="flex h-screen bg-background">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="flex-1 overflow-hidden">
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/">
                    Torpedo Proxy Manager
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Payloads</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </header>

          <div className="flex flex-1 flex-col gap-4 p-4 overflow-hidden">
            {!selectedFolder ? (
              <>
                <div className="flex justify-between items-center">
                  {/* <h1 className="text-2xl font-bold">Payload Management</h1> */}
                  <div className="flex gap-2">
                    <Button onClick={() => loadPayloadFolders()} variant="outline">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                    <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                      <DialogTrigger asChild>
                        <Button>
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Folder
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <form onSubmit={handleFileUpload}>
                          <DialogHeader>
                            <DialogTitle>Upload Files</DialogTitle>
                            <DialogDescription>
                              Select files to upload and create a new payload folder
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <Input
                              placeholder="Folder name"
                              value={folderName}
                              onChange={(e) => setFolderName(e.target.value)}
                              required
                            />
                            <input
                              type="file"
                              ref={fileInputRef}
                              multiple
                              required
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                          </div>
                          <DialogFooter>
                            <Button type="submit" disabled={isLoading}>
                              {isLoading ? "Uploading..." : "Upload"}
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                    
                    <Dialog open={cloneDialogOpen} onOpenChange={setCloneDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline">
                          <GitBranch className="w-4 h-4 mr-2" />
                          Clone Git Repo
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <form onSubmit={handleGitClone}>
                          <DialogHeader>
                            <DialogTitle>Clone Git Repository</DialogTitle>
                            <DialogDescription>
                              Clone a git repository to create a new payload folder
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <Input
                              placeholder="Git repository URL"
                              value={gitUrl}
                              onChange={(e) => setGitUrl(e.target.value)}
                              required
                            />
                            <Input
                              placeholder="Folder name"
                              value={folderName}
                              onChange={(e) => setFolderName(e.target.value)}
                              required
                            />
                          </div>
                          <DialogFooter>
                            <Button type="submit" disabled={isLoading}>
                              {isLoading ? "Cloning..." : "Clone"}
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {payloadFolders.map((folder) => (
                    <Card 
                      key={folder} 
                      className="cursor-pointer hover:shadow-md transition-shadow group"
                      onClick={() => handleFolderClick(folder)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Folder className="w-5 h-5 text-purple-500" />
                            <CardTitle className="text-lg">{folder}</CardTitle>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteFolder(folder)
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                        <CardDescription>
                          Click to browse contents
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                  
                  {payloadFolders.length === 0 && (
                    <div className="col-span-full text-center py-8 text-muted-foreground">
                      No payload folders found. Upload files or clone a repository to get started.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBackClick}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <div className="flex items-center gap-2">
                    <Folder className="w-5 h-5 text-purple-500" />
                    <h2 className="text-xl font-semibold">{selectedFolder}</h2>
                    {currentPath && (
                      <>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-lg">{currentPath}</span>
                      </>
                    )}
                  </div>
                </div>

                <ScrollArea className="flex-1 border rounded-lg">
                  <div className="p-4">
                    {isLoading ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Loading...
                      </div>
                    ) : folderContents.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        This folder is empty
                      </div>
                    ) : (
                      <div className="grid gap-2">
                        {folderContents.map((item) => (
                          <div
                            key={item.path}
                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted cursor-pointer group"
                            onClick={() => handleItemClick(item)}
                          >
                            {item.type === 'directory' ? (
                              <Folder className="w-5 h-5 text-blue-500" />
                            ) : (
                              <File className="w-5 h-5 text-gray-500" />
                            )}
                            <span className="flex-1">{item.name}</span>
                            {item.type === 'file' && item.name.endsWith('.txt') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  previewFile(item)
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </>
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>

      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <File className="w-5 h-5" />
              {previewFileName}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] w-full">
            <pre className="text-sm font-mono bg-muted p-4 rounded-md whitespace-pre-wrap">
              {previewContent}
            </pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}