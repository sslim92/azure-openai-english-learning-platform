"use client"

import Link from "next/link"
import {
  CircleUser,
  PanelLeft,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useSidebar, SidebarTrigger } from "../ui/sidebar"
import { AppSidebar } from "./sidebar"
import { useAuth } from "@/context/auth-context"
import { Skeleton } from "../ui/skeleton"
import { useRouter } from "next/navigation"

export function Header() {
  const { setOpenMobile } = useSidebar();
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      <Sheet onOpenChange={setOpenMobile}>
        <SheetTrigger asChild>
          <Button size="icon" variant="outline" className="sm:hidden">
            <PanelLeft className="h-5 w-5" />
            <span className="sr-only">메뉴 토글</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="sm:max-w-xs p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle>EduSearch Pro</SheetTitle>
          </SheetHeader>
          <AppSidebar isMobile={true} />
        </SheetContent>
      </Sheet>
      
      <SidebarTrigger className="hidden sm:flex" />

      <div className="relative ml-auto flex-1 md:grow-0">
         {loading ? (
            <Skeleton className="h-10 w-24" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <CircleUser className="h-5 w-5 mr-2" />
                  <span className="truncate max-w-28">{user.displayName || user.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>내 계정</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>로그아웃</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button onClick={() => router.push('/login')}>
                로그인
            </Button>
          )}
      </div>
    </header>
  )
}
