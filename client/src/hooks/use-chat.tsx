import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth";
import type { ChatMessage } from "@shared/schema";

interface ChatUser {
  id: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  accountId: string | null;
}

interface Conversation {
  otherUserId: string;
  otherUser: ChatUser;
  lastMessage: ChatMessage;
  unreadCount: number;
}

interface ChatState {
  conversations: Conversation[];
  activeConversation: string | null;
  messages: ChatMessage[];
  typingUsers: Set<string>;
  isConnected: boolean;
  isChatEnabled: boolean;
}

interface UseChatReturn extends ChatState {
  sendMessage: (receiverId: string, content: string, messageType?: string, attachmentUrl?: string) => void;
  setTyping: (receiverId: string, isTyping: boolean) => void;
  selectConversation: (userId: string) => void;
  loadMoreMessages: (userId: string, offset: number) => void;
  markAsRead: (messageId: string) => void;
  markConversationAsRead: (userId: string) => void;
  refreshConversations: () => Promise<void>;
}

export function useChat(): UseChatReturn {
  const { token } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [state, setState] = useState<ChatState>({
    conversations: [],
    activeConversation: null,
    messages: [],
    typingUsers: new Set(),
    isConnected: false,
    isChatEnabled: true,
  });

  const fetchConversations = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch("/api/chat/conversations", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const conversations = await response.json();
        setState((prev) => ({ ...prev, conversations }));
      }
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    }
  }, [token]);

  const fetchChatSettings = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch("/api/chat/settings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const settings = await response.json();
        setState((prev) => ({
          ...prev,
          isChatEnabled: settings.isEnabled !== "false",
        }));
      }
    } catch (error) {
      console.error("Failed to fetch chat settings:", error);
    }
  }, [token]);

  const connectWebSocket = useCallback(() => {
    if (!token || wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "auth", token }));
      setState((prev) => ({ ...prev, isConnected: true }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "new_chat_message":
            setState((prev) => {
              const newMessage = data.data;
              const otherUserId =
                newMessage.senderId === state.activeConversation
                  ? newMessage.senderId
                  : newMessage.receiverId;

              if (
                prev.activeConversation === newMessage.senderId ||
                prev.activeConversation === newMessage.receiverId
              ) {
                return {
                  ...prev,
                  messages: [...prev.messages, newMessage],
                };
              }

              const updatedConversations = prev.conversations.map((conv) => {
                if (conv.otherUserId === otherUserId) {
                  return {
                    ...conv,
                    lastMessage: newMessage,
                    unreadCount: conv.unreadCount + 1,
                  };
                }
                return conv;
              });

              return { ...prev, conversations: updatedConversations };
            });
            break;

          case "chat_message_sent":
            setState((prev) => ({
              ...prev,
              messages: [...prev.messages, data.data],
            }));
            break;

          case "typing_indicator":
            setState((prev) => {
              const newTypingUsers = new Set(prev.typingUsers);
              if (data.data.isTyping) {
                newTypingUsers.add(data.data.senderId);
              } else {
                newTypingUsers.delete(data.data.senderId);
              }
              return { ...prev, typingUsers: newTypingUsers };
            });
            break;

          case "chat_history":
            setState((prev) => ({
              ...prev,
              messages: data.data.messages,
            }));
            break;

          case "message_read_receipt":
            setState((prev) => ({
              ...prev,
              messages: prev.messages.map((msg) =>
                msg.id === data.data.messageId
                  ? { ...msg, isRead: true, readAt: data.data.readAt }
                  : msg
              ),
            }));
            break;

          case "messages_marked_read":
            setState((prev) => ({
              ...prev,
              messages: prev.messages.map((msg) =>
                msg.receiverId === data.data.byUserId
                  ? { ...msg, isRead: true, readAt: new Date().toISOString() }
                  : msg
              ),
            }));
            break;

          case "chat_error":
            console.error("Chat error:", data.error);
            break;
        }
      } catch (error) {
        console.error("WebSocket message parse error:", error);
      }
    };

    ws.onclose = () => {
      setState((prev) => ({ ...prev, isConnected: false }));
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    wsRef.current = ws;
  }, [token, state.activeConversation]);

  useEffect(() => {
    fetchChatSettings();
    fetchConversations();
    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
    };
  }, [token, fetchChatSettings, fetchConversations, connectWebSocket]);

  const sendMessage = useCallback(
    (
      receiverId: string,
      content: string,
      messageType = "text",
      attachmentUrl?: string
    ) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "chat_message",
            receiverId,
            content,
            messageType,
            attachmentUrl,
          })
        );
      }
    },
    []
  );

  const setTyping = useCallback((receiverId: string, isTyping: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "typing",
          receiverId,
          isTyping,
        })
      );
    }
  }, []);

  const selectConversation = useCallback(
    async (userId: string) => {
      setState((prev) => ({ ...prev, activeConversation: userId, messages: [] }));

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "get_chat_history",
            otherUserId: userId,
            limit: 50,
            offset: 0,
          })
        );
      }

      if (token) {
        try {
          await fetch(`/api/chat/${userId}/read`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}` },
          });
          setState((prev) => ({
            ...prev,
            conversations: prev.conversations.map((conv) =>
              conv.otherUserId === userId ? { ...conv, unreadCount: 0 } : conv
            ),
          }));
        } catch (error) {
          console.error("Failed to mark as read:", error);
        }
      }
    },
    [token]
  );

  const loadMoreMessages = useCallback((userId: string, offset: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "get_chat_history",
          otherUserId: userId,
          limit: 50,
          offset,
        })
      );
    }
  }, []);

  const markAsRead = useCallback(
    async (messageId: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "message_read",
            messageId,
          })
        );
      }
    },
    []
  );

  const markConversationAsRead = useCallback(
    async (userId: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "mark_chat_read",
            otherUserId: userId,
          })
        );
      }
    },
    []
  );

  return {
    ...state,
    sendMessage,
    setTyping,
    selectConversation,
    loadMoreMessages,
    markAsRead,
    markConversationAsRead,
    refreshConversations: fetchConversations,
  };
}
