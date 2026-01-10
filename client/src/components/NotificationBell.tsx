import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Bell,
  BellRing,
  Megaphone,
  Shield,
  Gift,
  Cog,
  Users,
  Check,
  CheckCheck,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar, enUS } from "date-fns/locale";

interface Notification {
  id: string;
  userId: string;
  type: "announcement" | "transaction" | "security" | "promotion" | "system" | "p2p";
  priority: "low" | "normal" | "high" | "urgent";
  title: string;
  titleAr?: string | null;
  message: string;
  messageAr?: string | null;
  link?: string | null;
  metadata?: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

const notificationIcons: Record<string, typeof Bell> = {
  announcement: Megaphone,
  transaction: Bell,
  security: Shield,
  promotion: Gift,
  system: Cog,
  p2p: Users,
};

const priorityColors: Record<string, string> = {
  low: "text-muted-foreground",
  normal: "text-foreground",
  high: "text-orange-500",
  urgent: "text-destructive",
};

export function NotificationBell() {
  const { token } = useAuth();
  const { language, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();

  const { data: unreadCountData, refetch: refetchUnreadCount } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    enabled: !!token,
    refetchInterval: 30000,
  });

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    enabled: !!token && open,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      await apiRequest("POST", `/api/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/notifications/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  useEffect(() => {
    if (open) {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    }
  }, [open]);

  const unreadCount = unreadCountData?.count || 0;
  const hasUnread = unreadCount > 0;

  const getNotificationTitle = (notification: Notification) => {
    if (language === "ar" && notification.titleAr) {
      return notification.titleAr;
    }
    return notification.title;
  };

  const getNotificationMessage = (notification: Notification) => {
    if (language === "ar" && notification.messageAr) {
      return notification.messageAr;
    }
    return notification.message;
  };

  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), {
        addSuffix: true,
        locale: language === "ar" ? ar : enUS,
      });
    } catch {
      return "";
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
      setOpen(false);
    }
  };

  const getIcon = (type: string) => {
    const Icon = notificationIcons[type] || Bell;
    return Icon;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="button-notification-bell"
        >
          {hasUnread ? (
            <BellRing className="h-5 w-5" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
          {hasUnread && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -end-1 h-5 min-w-5 p-0 flex items-center justify-center text-xs no-default-hover-elevate no-default-active-elevate"
              data-testid="badge-unread-count"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0"
        align="end"
        data-testid="popover-notifications"
      >
        <div className="flex items-center justify-between gap-2 p-3 border-b">
          <h4 className="font-semibold text-sm">{t("notifications.title")}</h4>
          {hasUnread && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
              className="text-xs"
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="h-3 w-3 me-1" />
              {t("notifications.markAllRead")}
            </Button>
          )}
        </div>
        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {t("common.loading")}
            </div>
          ) : notifications.length === 0 ? (
            <div
              className="p-8 text-center text-sm text-muted-foreground"
              data-testid="text-no-notifications"
            >
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>{t("notifications.empty")}</p>
            </div>
          ) : (
            <div>
              {notifications.map((notification, index) => {
                const Icon = getIcon(notification.type);
                return (
                  <div key={notification.id}>
                    <button
                      onClick={() => handleNotificationClick(notification)}
                      className={`w-full text-start p-3 hover-elevate transition-colors ${
                        notification.isRead ? "opacity-70" : "bg-muted/30"
                      }`}
                      data-testid={`notification-item-${notification.id}`}
                    >
                      <div className="flex gap-3">
                        <div
                          className={`flex-shrink-0 mt-0.5 ${priorityColors[notification.priority]}`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className={`text-sm font-medium truncate ${
                                notification.isRead ? "" : "font-semibold"
                              }`}
                              data-testid={`notification-title-${notification.id}`}
                            >
                              {getNotificationTitle(notification)}
                            </p>
                            {!notification.isRead && (
                              <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary mt-1.5" />
                            )}
                          </div>
                          <p
                            className="text-xs text-muted-foreground line-clamp-2 mt-0.5"
                            data-testid={`notification-message-${notification.id}`}
                          >
                            {getNotificationMessage(notification)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatTime(notification.createdAt)}
                          </p>
                        </div>
                      </div>
                    </button>
                    {index < notifications.length - 1 && <Separator />}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
