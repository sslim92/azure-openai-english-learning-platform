
"use client";
import Link from "next/link";
import Image from "next/image";
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
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { BookOpen, BarChart3, Shuffle, Home, LogIn, Upload, User } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";

const menuItems = [
  { href: "/", label: "나의 메기", icon: Home, auth: true },
  { href: "/questions", label: "문제 은행", icon: BookOpen, auth: false },
  { href: "/random-quiz", label: "랜덤 문제", icon: Shuffle, auth: false },
  { href: "/progress", label: "나의 학습 현황", icon: BarChart3, auth: true },
  { href: "/admin/upload", label: "자료 업로드", icon: Upload, auth: true }, // Assuming this is an admin/auth only feature
];

export function AppSidebar({ isMobile = false }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const router = useRouter();

  const CatfishWidget = () => (
    user && 'stage' in user && user.stage ? (
        <div className="px-2 mt-auto">
            <SidebarSeparator className="my-2" />
            <div className="p-2 flex flex-col items-center text-center gap-2 group-data-[collapsible=icon]:hidden">
                <div className="relative w-24 h-24">
                     <Image 
                        src={`/images/catfish/${user.stage}.png`}
                        alt={user.stage}
                        width={96}
                        height={96}
                        className="object-contain"
                     />
                </div>
                <div className="w-full">
                    <p className="text-sm font-semibold text-sidebar-foreground truncate">{user.displayName || user.email}</p>
                    <p className="text-xs text-sidebar-foreground/80">
                        Lv. {user.level} {user.stage}
                    </p>
                </div>
            </div>
             <SidebarMenuItem className="group-data-[collapsible=icon]:block hidden">
                <SidebarMenuButton 
                    tooltip={{children: `Lv. ${user.level} ${user.stage}`, side: 'right'}} 
                    className="w-full justify-center"
                >
                    <div className="relative w-6 h-6">
                        <Image 
                            src={`/images/catfish/${user.stage}.png`}
                            alt={user.stage}
                            width={24}
                            height={24}
                        />
                    </div>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </div>
    ) : null
  );

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
          <Link href={user ? "/" : "/landing"} className="flex items-center gap-2 font-semibold font-headline">
            <BookOpen className="h-6 w-6 text-primary" />
            <span className="duration-200 group-data-[collapsible=icon]:-translate-x-48">
              EduSearch
            </span>
          </Link>
          <SidebarTrigger className="ml-auto" />
        </SidebarHeader>
      )}
      <SidebarMenu className="flex-1">
        {menuItems.map(({ href, label, icon: Icon, auth: requiresAuth }) => {
          if (requiresAuth && !user) return null;
          return (
            <SidebarMenuItem key={href}>
              <SidebarMenuButton
                asChild
                isActive={pathname === href || (href !== '/' && pathname.startsWith(href))}
                tooltip={label}
              >
                <Link href={href}>
                  <Icon />
                  <span>{label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
      <SidebarFooter>
        {loading ? (
           <div className="p-2 space-y-2">
             <SidebarMenuSkeleton showIcon />
           </div>
        ) : user ? (
          <CatfishWidget />
        ) : (
          <>
            <SidebarMenuItem>
                <SidebarMenuButton
                onClick={() => router.push('/login')}
                tooltip="로그인"
                >
                <LogIn />
                <span>로그인</span>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton
                onClick={() => router.push('/login')}
                tooltip="회원가입"
                >
                <User />
                <span>회원가입</span>
                </SidebarMenuButton>
            </SidebarMenuItem>
          </>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
