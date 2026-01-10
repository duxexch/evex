import { useState, useRef, useEffect } from "react";
import { useChat } from "@/hooks/use-chat";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Send, Check, CheckCheck, Loader2, AlertCircle, Search, Timer } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";

function formatMessageTime(dateValue: string | Date) {
  const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
  if (isToday(date)) {
    return format(date, "HH:mm");
  }
  if (isYesterday(date)) {
    return "Yesterday " + format(date, "HH:mm");
  }
  return format(date, "MMM d, HH:mm");
}

function getInitials(user: { firstName?: string | null; lastName?: string | null; username?: string }) {
  if (user.firstName && user.lastName) {
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  }
  return user.username?.substring(0, 2).toUpperCase() || "??";
}

export default function ChatPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const {
    conversations,
    activeConversation,
    messages,
    typingUsers,
    isConnected,
    isChatEnabled,
    sendMessage,
    setTyping,
    selectConversation,
    refreshConversations,
  } = useChat();

  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [disappearingMode, setDisappearingMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const activeUser = conversations.find((c) => c.otherUserId === activeConversation)?.otherUser;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  const handleSendMessage = () => {
    if (!messageInput.trim() || !activeConversation) return;
    sendMessage(activeConversation, messageInput.trim(), "text", undefined, {
      isDisappearing: disappearingMode,
      disappearAfterRead: disappearingMode,
    });
    setMessageInput("");
    setTyping(activeConversation, false);
  };

  const handleInputChange = (value: string) => {
    setMessageInput(value);

    if (activeConversation) {
      setTyping(activeConversation, true);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        setTyping(activeConversation, false);
      }, 2000);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true;
    const name = `${conv.otherUser.firstName || ""} ${conv.otherUser.lastName || ""} ${conv.otherUser.username}`.toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  if (!isChatEnabled) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t("chat.disabled")}</h3>
            <p className="text-muted-foreground">{t("chat.disabledDesc")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="w-80 border-e flex flex-col bg-muted/30">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            {t("chat.title")}
            {!isConnected && (
              <Badge variant="secondary" className="text-xs">
                {t("chat.reconnecting")}
              </Badge>
            )}
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("chat.searchConversations")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ps-9"
              data-testid="input-chat-search"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <MessageCircle className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">{t("chat.noConversations")}</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredConversations.map((conv) => (
                <button
                  key={conv.otherUserId}
                  onClick={() => selectConversation(conv.otherUserId)}
                  className={cn(
                    "w-full p-3 rounded-lg text-start hover-elevate active-elevate-2 transition-colors",
                    activeConversation === conv.otherUserId
                      ? "bg-sidebar-accent"
                      : "bg-transparent"
                  )}
                  data-testid={`chat-conversation-${conv.otherUserId}`}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={conv.otherUser.avatarUrl || undefined} />
                      <AvatarFallback>{getInitials(conv.otherUser)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">
                          {conv.otherUser.firstName || conv.otherUser.username}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatMessageTime(conv.lastMessage.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-muted-foreground truncate">
                          {conv.lastMessage.content}
                        </p>
                        {conv.unreadCount > 0 && (
                          <Badge variant="default" className="h-5 min-w-5 text-xs justify-center">
                            {conv.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col">
        {!activeConversation ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MessageCircle className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <h3 className="text-lg font-medium">{t("chat.selectConversation")}</h3>
              <p className="text-sm">{t("chat.selectConversationDesc")}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="p-4 border-b flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={activeUser?.avatarUrl || undefined} />
                <AvatarFallback>{activeUser ? getInitials(activeUser) : "??"}</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold">
                  {activeUser?.firstName || activeUser?.username}
                </h3>
                <p className="text-xs text-muted-foreground">
                  @{activeUser?.username}
                  {typingUsers.has(activeConversation) && (
                    <span className="ms-2 text-primary">{t("chat.typing")}</span>
                  )}
                </p>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((msg) => {
                  const isMine = msg.senderId === user?.id;
                  const isDisappearingMsg = msg.isDisappearing || msg.disappearAfterRead;
                  return (
                    <div
                      key={msg.id}
                      className={cn("flex", isMine ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[70%] rounded-lg p-3",
                          isMine
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                        <div
                          className={cn(
                            "flex items-center gap-1 mt-1 text-xs",
                            isMine ? "text-primary-foreground/70" : "text-muted-foreground"
                          )}
                        >
                          {isDisappearingMsg && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Timer className="h-3 w-3" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{t("chat.disappearingMessage")}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          <span>{formatMessageTime(msg.createdAt)}</span>
                          {isMine && (
                            <>
                              {msg.isRead ? (
                                <CheckCheck className="h-3 w-3" />
                              ) : (
                                <Check className="h-3 w-3" />
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="p-4 border-t">
              {disappearingMode && (
                <div className="mb-2 flex items-center gap-2 text-xs text-primary">
                  <Timer className="h-3 w-3" />
                  <span>{t("chat.disappearingModeActive")}</span>
                </div>
              )}
              <div className="flex gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={disappearingMode ? "default" : "ghost"}
                      size="icon"
                      onClick={() => setDisappearingMode(!disappearingMode)}
                      className={cn(
                        "shrink-0",
                        disappearingMode && "text-primary-foreground"
                      )}
                      data-testid="button-toggle-disappearing"
                    >
                      <Timer className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{disappearingMode ? t("chat.disappearingModeOff") : t("chat.disappearingModeOn")}</p>
                    <p className="text-xs text-muted-foreground">{t("chat.disappearingModeDesc")}</p>
                  </TooltipContent>
                </Tooltip>
                <Input
                  value={messageInput}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder={t("chat.typeMessage")}
                  className="flex-1"
                  data-testid="input-chat-message"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim()}
                  data-testid="button-send-message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
