import { useState, useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Send, MessageCircle, Zap } from "lucide-react";

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  message: string;
  isQuickMessage?: boolean;
  quickMessageKey?: string;
  isSpectator?: boolean;
  createdAt: string;
}

interface QuickMessage {
  key: string;
  en: string;
  ar: string;
}

interface GameChatProps {
  messages: Message[];
  onSendMessage: (message: string, isQuickMessage?: boolean, quickMessageKey?: string) => void;
  quickMessages: QuickMessage[];
  language: string;
  disabled?: boolean;
}

export function GameChat({
  messages,
  onSendMessage,
  quickMessages,
  language,
  disabled = false,
}: GameChatProps) {
  const [messageInput, setMessageInput] = useState("");
  const [activeTab, setActiveTab] = useState<"chat" | "quick">("quick");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!messageInput.trim() || disabled) return;
    onSendMessage(messageInput.trim());
    setMessageInput("");
  };

  const handleQuickMessage = (qm: QuickMessage) => {
    if (disabled) return;
    onSendMessage(language === "ar" ? qm.ar : qm.en, true, qm.key);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-primary" />
        <span className="font-medium">
          {language === "ar" ? "الدردشة" : "Chat"}
        </span>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "chat" | "quick")} className="flex-1 flex flex-col">
        <TabsList className="w-full grid grid-cols-2 mx-3 mt-2" style={{ width: "calc(100% - 24px)" }}>
          <TabsTrigger value="quick" className="gap-1">
            <Zap className="h-4 w-4" />
            {language === "ar" ? "سريع" : "Quick"}
          </TabsTrigger>
          <TabsTrigger value="chat" className="gap-1">
            <MessageCircle className="h-4 w-4" />
            {language === "ar" ? "دردشة" : "Chat"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="quick" className="flex-1 p-3 mt-0">
          <div className="grid grid-cols-2 gap-2">
            {quickMessages.map((qm) => (
              <Button
                key={qm.key}
                variant="outline"
                size="sm"
                className="h-auto py-2 px-3 text-xs"
                onClick={() => handleQuickMessage(qm)}
                disabled={disabled}
                data-testid={`quick-message-${qm.key}`}
              >
                {language === "ar" ? qm.ar : qm.en}
              </Button>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="chat" className="flex-1 flex flex-col mt-0 overflow-hidden">
          <ScrollArea className="flex-1 p-3" ref={scrollRef}>
            <div className="space-y-3">
              {messages.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  {language === "ar" ? "لا توجد رسائل بعد" : "No messages yet"}
                </p>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex gap-2",
                      msg.isSpectator && "opacity-70"
                    )}
                  >
                    <Avatar className="h-6 w-6 shrink-0">
                      <AvatarImage src={msg.senderAvatar} />
                      <AvatarFallback className="text-xs">
                        {msg.senderName?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium truncate">
                          {msg.senderName}
                        </span>
                        {msg.isSpectator && (
                          <span className="text-[10px] text-muted-foreground">
                            ({language === "ar" ? "مشاهد" : "spectator"})
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {formatTime(msg.createdAt)}
                        </span>
                      </div>
                      <p className={cn(
                        "text-sm break-words",
                        msg.isQuickMessage && "text-primary font-medium"
                      )}>
                        {msg.message}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          <div className="p-3 border-t">
            <div className="flex gap-2">
              <Input
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={language === "ar" ? "اكتب رسالة..." : "Type a message..."}
                className="flex-1"
                disabled={disabled}
                data-testid="input-game-chat"
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!messageInput.trim() || disabled}
                data-testid="button-send-game-chat"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
