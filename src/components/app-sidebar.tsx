import React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { LucideIcon, ListChecks } from "lucide-react";

interface MenuItem {
  id: string;
  label: string;
  icon?: LucideIcon;
}

interface AppSidebarProps {
  menuItems: MenuItem[];
  activeSection: string;
  onSelect: (id: string) => void;
}

export function AppSidebar({ menuItems, activeSection, onSelect }: AppSidebarProps) {
  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar md:min-w-64 md:w-64 md:h-[calc(100vh-3.5rem)] md:mt-[3.5rem] md:fixed md:left-0 md:top-0">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const Icon = item.icon ?? ListChecks;
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={activeSection === item.id}
                      className="w-full justify-start gap-3"
                      onClick={() => onSelect(item.id)}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="truncate text-sm font-normal">
                        {item.label}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
} 