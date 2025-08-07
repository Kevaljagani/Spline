"use client"

import React, { useState, useEffect } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { File, Folder, Search } from 'lucide-react'
import { PayloadFile } from '@/contexts/PayloadAttachmentContext'

interface PayloadSelectorProps {
  onSelect: (file: PayloadFile) => void
  onClose: () => void
  // position: { top: number; left: number }
}

interface PayloadFolder {
  name: string
  files: PayloadFile[]
}

export function PayloadSelector({ onSelect, onClose }: PayloadSelectorProps) {
  const [payloadFolders, setPayloadFolders] = useState<PayloadFolder[]>([])
  const [filteredFiles, setFilteredFiles] = useState<PayloadFile[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadPayloadFiles()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const allFiles = payloadFolders.flatMap(folder => folder.files)
    const filtered = allFiles.filter(file => 
      file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      file.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
      file.folderName.toLowerCase().includes(searchTerm.toLowerCase())
    )
    setFilteredFiles(filtered)
    setSelectedIndex(0)
  }, [payloadFolders, searchTerm])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, filteredFiles.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredFiles[selectedIndex]) {
          onSelect(filteredFiles[selectedIndex])
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [filteredFiles, selectedIndex, onSelect, onClose])

  const loadPayloadFiles = async () => {
    try {
      setIsLoading(true)
      // Get all payload folders
      const foldersResponse = await fetch('http://localhost:3001/api/payloads')
      if (!foldersResponse.ok) return
      
      const folders = await foldersResponse.json()
      
      const payloadData: PayloadFolder[] = []
      
      // For each folder, get all files recursively
      for (const folderName of folders) {
        const files = await loadFolderFiles(folderName)
        payloadData.push({
          name: folderName,
          files
        })
      }
      
      setPayloadFolders(payloadData)
    } catch (error) {
      console.error('Error loading payload files:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadFolderFiles = async (folderName: string, path: string = ''): Promise<PayloadFile[]> => {
    try {
      const url = new URL(`http://localhost:3001/api/payloads/${folderName}/browse`)
      if (path) {
        url.searchParams.set('path', path)
      }
      
      const response = await fetch(url.toString())
      if (!response.ok) return []
      
      const contents = await response.json()
      const files: PayloadFile[] = []
      
      for (const item of contents) {
        if (item.type === 'file') {
          files.push({
            id: crypto.randomUUID(),
            name: item.name,
            path: item.path,
            folderName,
            fullPath: `${folderName}/${item.path}`
          })
        } else if (item.type === 'directory') {
          // Recursively load files from subdirectories
          const subFiles = await loadFolderFiles(folderName, item.path)
          files.push(...subFiles)
        }
      }
      
      return files
    } catch (error) {
      console.error('Error loading folder files:', error)
      return []
    }
  }

  if (isLoading) {
    return (
      <div 
        className="absolute z-50 w-80 bg-popover border rounded-md shadow-lg p-4"
      >
        <div className="text-center text-muted-foreground">Loading payload files...</div>
      </div>
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      
      {/* Selector */}
      <div 
        className="fixed z-50 w-80 bg-popover border rounded-md shadow-lg backdrop-blur-sm"
        style={{ 
          maxHeight: '300px',
          display: 'flex',
          flexDirection: 'column',
          bottom: '100px',
          // top: '70%',
        }}
      >
      <div className="p-3 border-b flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search payload files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
            autoFocus
          />
        </div>
      </div>
      
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-1">
          {filteredFiles.length === 0 ? (
            <div className="p-3 text-center text-muted-foreground text-sm">
              {searchTerm ? 'No files match your search' : 'No payload files found'}
            </div>
          ) : (
            filteredFiles.map((file, index) => (
              <div
                key={file.id}
                className={`flex items-center gap-2 p-2 rounded cursor-pointer text-sm ${
                  index === selectedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                }`}
                onClick={() => onSelect(file)}
              >
                <File className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="truncate">{file.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    <Folder className="inline h-3 w-3 mr-1" />
                    {file.folderName}/{file.path}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
      
      <div className="p-2 border-t text-xs text-muted-foreground flex-shrink-0">
        Use ↑↓ to navigate, Enter to select, Esc to close
      </div>
      </div>
    </>
  )
}