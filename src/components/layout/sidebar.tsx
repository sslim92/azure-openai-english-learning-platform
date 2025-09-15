
// Adapted from https://v0.dev/t/3n3LMCB9x5Z
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarFooter,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import { BookOpen, BarChart3, FileUp, Shuffle, Mic, Home, LogIn, CircleUser } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { Button } from "../ui/button";

const menuItems = [
  { href: "/", label: "홈", icon: Home },
  { href: "/questions", label: "문제 은행", icon: BookOpen },
  { href: "/random-quiz", label: "랜덤 문제", icon: Shuffle },
  { href: "/listening-quiz", label: "AI 듣기 평가", icon: Mic },
  { href: "/progress", label: "나의 학습 현황", icon: BarChart3 },
  { href: "/admin/upload", label: "PDF 업로드", icon: FileUp },
];

export function AppSidebar({ isMobile = false }) {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();

  return (
    <Sidebar
      className="border-r"
      collapsible="offcanvas"
      {...(isMobile && {
        collapsible: "none",
      })}
    >
      <SidebarHeader>
        <Link href="/" className="flex items-center gap-2 font-semibold font-headline">
          <BookOpen className="h-6 w-6 text-primary" />
          <span className="duration-200 group-data-[collapsible=icon]:-translate-x-48">
            메기스터디
          </span>
        </Link>
         <SidebarTrigger className="ml-auto" />
      </SidebarHeader>
      <SidebarMenu className="flex-1">
        {menuItems.map(({ href, label, icon: Icon }) => (
          <SidebarMenuItem key={href}>
            <SidebarMenuButton
              asChild
              isActive={pathname === href || (pathname.startsWith(href) && href !== '/')}
              tooltip={label}
            >
              <Link href={href}>
                <Icon />
                <span>{label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
      <SidebarFooter>
        {loading ? (
           <SidebarMenuSkeleton showIcon />
        ) : user ? (
          <SidebarMenuItem>
             <SidebarMenuButton tooltip={{children: user.email, side:'right'}} asChild>
                <Link href="#">
                    <CircleUser />
                    <span className="truncate">{user.email}</span>
                </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ) : (
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === '/login'}
              tooltip="로그인"
            >
              <Link href="/login">
                <LogIn />
                <span>로그인</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
