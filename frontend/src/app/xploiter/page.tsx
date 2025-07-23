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

export default function XploiterPage() {
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
                  <BreadcrumbPage>Xploiter</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
            <div className="grid auto-rows-min gap-4 md:grid-cols-3">
              <div className="bg-muted/50 aspect-video rounded-xl flex items-center justify-center">
                <h3 className="text-lg font-medium text-muted-foreground">Vulnerability Scans</h3>
              </div>
              <div className="bg-muted/50 aspect-video rounded-xl flex items-center justify-center">
                <h3 className="text-lg font-medium text-muted-foreground">Attack Vectors</h3>
              </div>
              <div className="bg-muted/50 aspect-video rounded-xl flex items-center justify-center">
                <h3 className="text-lg font-medium text-muted-foreground">Security Reports</h3>
              </div>
            </div>
            <div className="bg-muted/50 min-h-[60vh] flex-1 rounded-xl flex items-center justify-center">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-muted-foreground mb-2">Xploiter Dashboard</h2>
                <p className="text-muted-foreground">Perform security testing and exploitation here.</p>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}
