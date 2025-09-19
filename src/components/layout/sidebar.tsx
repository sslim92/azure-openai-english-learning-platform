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
import { BookOpen, BarChart3, Shuffle, Home, LogIn, CircleUser, Upload } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";

const menuItems = [
  { href: "/", label: "홈", icon: Home },
  { href: "/questions", label: "문제 은행", icon: BookOpen },
  { href: "/random-quiz", label: "랜덤 문제", icon: Shuffle },
  { href: "/progress", label: "나의 학습 현황", icon: BarChart3 },
  { href: "/admin/upload", label: "자료 업로드", icon: Upload },
];

export function AppSidebar({ isMobile = false }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const router = useRouter();

  return (
    <Sidebar
      className="border-r"
      collapsible="offcanvas"
      {...(isMobile && {
        collapsible: "none",
      })}
    >
      {!isMobile && (
        <SidebarHeader>
          <Link href="/" className="flex items-center gap-2 font-semibold font-headline">
            <BookOpen className="h-6 w-6 text-primary" />
            <span className="duration-200 group-data-[collapsible=icon]:-translate-x-48">
              EduSearch
            </span>
          </Link>
          <SidebarTrigger className="ml-auto" />
        </SidebarHeader>
      )}
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
             <SidebarMenuButton tooltip={{children: user.displayName || user.email || '', side:'right'}} asChild>
                <Link href="#">
                    <CircleUser />
                    <span className="truncate">{user.displayName || user.email}</span>
                </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ) : (
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => router.push('/login')}
              tooltip="로그인"
            >
              <LogIn />
              <span>로그인</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
