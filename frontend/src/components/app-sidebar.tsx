"use client"

import * as React from "react"
import {
  Rocket,
  Loader,
  GalleryVerticalEnd,
  Map,
  PieChart,
  Bot,
  RotateCcw
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
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { state } = useSidebar()
  
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="#">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Rocket className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-lg leading-tight">
                  <span className="truncate font-medium">Torpedo</span>
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
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
