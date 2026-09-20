"use client";
import Link from "next/link";
import Image from "next/image";
import { UsageGuide } from "./usage-guide";
import {
  BookOpen,
  ChevronRight,
  CircleHelp,
  Home,
  Leaf,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
export type View =
  | "home"
  | "meals"
  | "group"
  | "settings"
  | "privacy"
  | "connections";
const navigation = [
  { key: "home", title: "오늘의 점심", icon: Home },
  { key: "meals", title: "나의 식사 기록", icon: BookOpen },
  { key: "group", title: "함께 먹기", icon: Users },
  { key: "settings", title: "추천 설정", icon: Settings2 },
] as const;
export function AppShell({
  view,
  onNavigate,
  children,
  dataMode = "demo",
}: {
  view: View;
  onNavigate: (v: View) => void;
  children: React.ReactNode;
  dataMode?: "demo" | "live";
}) {
  return (
    <SidebarProvider
      style={{ "--sidebar-width": "236px" } as React.CSSProperties}
    >
      <ShellContents view={view} onNavigate={onNavigate} dataMode={dataMode}>
        {children}
      </ShellContents>
    </SidebarProvider>
  );
}
function ShellContents({
  view,
  onNavigate,
  children,
  dataMode,
}: {
  view: View;
  onNavigate: (v: View) => void;
  children: React.ReactNode;
  dataMode: "demo" | "live";
}) {
  const { setOpenMobile } = useSidebar();
  const navigate = (v: View) => {
    onNavigate(v);
    setOpenMobile(false);
  };
  return (
    <>
      <a className="skip-link" href="#main">
        본문으로 이동
      </a>
      <Sidebar className="app-sidebar">
        <SidebarHeader>
          <Link
            href="/"
            className="brand"
            aria-label="cAlorie 홈"
            onClick={() => navigate("home")}
          >
            <span className="brand-logo">
              <Image
                src="/images/calorie-logo.png"
                alt="cAlorie"
                width={549}
                height={308}
                sizes="280px"
              />
            </span>
            <small>MY DAILY LUNCH</small>
          </Link>
        </SidebarHeader>
        <SidebarContent className="app-sidebar-content">
          <p className="nav-label">나를 위한 한 끼</p>
          <SidebarMenu>
            {navigation.map(({ key, title, icon: Icon }) => (
              <SidebarMenuItem key={key}>
                <SidebarMenuButton
                  isActive={view === key}
                  onClick={() => navigate(key)}
                >
                  <Icon />
                  <span>{title}</span>
                  {key === view && <ChevronRight className="ml-auto" />}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
          <div className="sidebar-note">
            <Leaf size={23} />
            <strong>
              작은 선택이 모여,
              <br />
              나의 일상이 되니까.
            </strong>
            <p>
              기록한 식사에서 시작하는
              <br />
              부담 없는 점심 선택
            </p>
            <span>SDG 3 · 건강과 웰빙</span>
          </div>
        </SidebarContent>
        <SidebarFooter className="app-sidebar-footer">
          <button onClick={() => navigate("privacy")}>
            <ShieldCheck size={18} />
            개인정보 관리
          </button>
          <button onClick={() => navigate("connections")}>
            <CircleHelp size={18} />
            데이터 연결 상태
          </button>
          <div className="visitor">
            <span>나</span>
            <div>
              <strong>가볍게 시작하기</strong>
              <small>비회원 · 내 브라우저 세션</small>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>
      <div className="workspace">
        <header className="topbar">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="mobile-trigger" aria-label="메뉴 열기" />
            <span className="topbar-tagline">나의 점심, 나의 기준</span>
            <Link
              href="/"
              className="mobile-brand"
              onClick={() => navigate("home")}
            >
              cAlorie
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <UsageGuide />
            <span className="demo-tag">
              <Sparkles size={14} />
              {dataMode === "demo" ? "데모 데이터" : "실제 조회 모드"}
            </span>
            <span className="avatar">나</span>
          </div>
        </header>
        <main id="main" className="page-content">
          {children}
        </main>
      </div>
    </>
  );
}
