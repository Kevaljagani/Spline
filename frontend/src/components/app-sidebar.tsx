"use client"

import * as React from "react"
import {
  SplinePointer,
  Loader,
  GalleryVerticalEnd,
  Map,
  PieChart,
  Bot,
  RotateCcw,
  Trash2,
  Code,
  Shield
} from "lucide-react"

import { NavProjects } from "@/components/nav-projects"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"

// This is sample data.
const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  teams: [
    {
      name: "Torpedo",
      logo: GalleryVerticalEnd,
    }
  ],
  projects: [
    {
      name: "Proxy",
      url: "/proxy",
      icon: Loader,
    },
    {
      name: "Replay",
      url: "/replay",
      icon: RotateCcw,
    },
    {
      name: "Xploiter",
      url: "/xploiter",
      icon: Bot,
    },
    {
      name: "Payloads",
      url: "/payloads",
      icon: Code,
    },
    {
      name: "Patterns",
      url: "/patterns",
      icon: Shield,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { state } = useSidebar()
  
  const handleFlushDb = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/flush-db', {
        method: 'DELETE'
      })
      if (response.ok) {
        alert('Database cleared successfully')
      }
    } catch (error) {
      console.error('Failed to flush database:', error)
      alert('Failed to clear database')
    }
  }
  
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a className="bg-stone-100" href="#">
                <div className="bg-stone-200 text-stone-800 flex aspect-square size-8 items-center justify-center rounded-lg">
                  <SplinePointer className="size-6 text-purple-500" />
                </div>
                <div className="grid flex-1 text-left text-xl leading-tight">
                  <span className="truncate font-black tracking-wide bg-gradient-to-r from-stone-700 to-stone-900 bg-clip-text text-transparent">Spline</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavProjects projects={data.projects} />
      </SidebarContent>
      <SidebarFooter>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            {state === "expanded" && (
              <span className="text-sm text-muted-foreground">Proxy Connected</span>
            )}
          </div>
          <div className="border-t border-sidebar-border mx-2"></div>
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            {state === "expanded" && (
              <span className="text-sm text-muted-foreground">API Connected</span>
            )}
          </div>
          {state === "expanded" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={handleFlushDb}
              className="mx-2 mt-2 mb-2 hover:bg-red-500 hover:text-white"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Flush DB
            </Button>
          ) : (<></>
          )}
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
