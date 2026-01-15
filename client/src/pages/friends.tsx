import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  UserPlus,
  UserMinus,
  UserX,
  Search,
  MessageCircle,
  Swords,
  Ban,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { BackButton } from "@/components/BackButton";
import type { User } from "@shared/schema";

type UserWithFollowStatus = Omit<User, "password"> & { isFollowing?: boolean };

function UserCard({
  user,
  actionType,
  onAction,
  isLoading,
  t,
}: {
  user: UserWithFollowStatus;
  actionType: "friend" | "following" | "follower" | "blocked" | "search";
  onAction: (userId: string, action: string) => void;
  isLoading: boolean;
  t: (key: string) => string;
}) {
  const initials = (user.username || "U").slice(0, 2).toUpperCase();
  const level = user.vipLevel || 1;

  return (
    <div
      className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-card"
      data-testid={`card-user-${user.id}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Avatar data-testid={`avatar-user-${user.id}`}>
          <AvatarImage src={user.profilePicture || undefined} alt={user.username} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="font-medium truncate"
              data-testid={`text-username-${user.id}`}
            >
              {user.username}
            </span>
            <Badge variant="secondary" data-testid={`badge-level-${user.id}`}>
              {t("friends.level")} {level}
            </Badge>
            {actionType === "friend" && (
              <Badge variant="default" data-testid={`badge-mutual-${user.id}`}>
                <CheckCircle className="w-3 h-3 me-1" />
                {t("friends.mutualFriend")}
              </Badge>
            )}
          </div>
          <p
            className="text-sm text-muted-foreground truncate"
            data-testid={`text-accountid-${user.id}`}
          >
            @{user.accountId}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {actionType === "friend" && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAction(user.id, "chat")}
              disabled={isLoading}
              data-testid={`button-chat-${user.id}`}
            >
              <MessageCircle className="w-4 h-4 me-1" />
              {t("friends.chat")}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => onAction(user.id, "challenge")}
              disabled={isLoading}
              data-testid={`button-challenge-${user.id}`}
            >
              <Swords className="w-4 h-4 me-1" />
              {t("friends.challenge")}
            </Button>
          </>
        )}

        {actionType === "following" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAction(user.id, "unfollow")}
            disabled={isLoading}
            data-testid={`button-unfollow-${user.id}`}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <UserMinus className="w-4 h-4 me-1" />
                {t("friends.unfollow")}
              </>
            )}
          </Button>
        )}

        {actionType === "follower" && (
          <Button
            variant="default"
            size="sm"
            onClick={() => onAction(user.id, "follow")}
            disabled={isLoading}
            data-testid={`button-followback-${user.id}`}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <UserPlus className="w-4 h-4 me-1" />
                {t("friends.followBack")}
              </>
            )}
          </Button>
        )}

        {actionType === "blocked" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAction(user.id, "unblock")}
            disabled={isLoading}
            data-testid={`button-unblock-${user.id}`}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <CheckCircle className="w-4 h-4 me-1" />
                {t("friends.unblock")}
              </>
            )}
          </Button>
        )}

        {actionType === "search" && (
          <Button
            variant={user.isFollowing ? "outline" : "default"}
            size="sm"
            onClick={() =>
              onAction(user.id, user.isFollowing ? "unfollow" : "follow")
            }
            disabled={isLoading}
            data-testid={`button-follow-${user.id}`}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : user.isFollowing ? (
              <>
                <UserMinus className="w-4 h-4 me-1" />
                {t("friends.unfollow")}
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 me-1" />
                {t("friends.follow")}
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="w-12 h-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-sm">{description}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-4 p-4 rounded-lg border"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="w-32 h-4" />
              <Skeleton className="w-20 h-3" />
            </div>
          </div>
          <Skeleton className="w-24 h-8" />
        </div>
      ))}
    </div>
  );
}

export default function FriendsPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const { data: friends = [], isLoading: friendsLoading } = useQuery<
    UserWithFollowStatus[]
  >({
    queryKey: ["/api/users/friends"],
  });

  const { data: following = [], isLoading: followingLoading } = useQuery<
    UserWithFollowStatus[]
  >({
    queryKey: ["/api/users/following"],
  });

  const { data: followers = [], isLoading: followersLoading } = useQuery<
    UserWithFollowStatus[]
  >({
    queryKey: ["/api/users/followers"],
  });

  const { data: blocked = [], isLoading: blockedLoading } = useQuery<
    UserWithFollowStatus[]
  >({
    queryKey: ["/api/users/blocked"],
  });

  const { data: searchResults = [], isLoading: searchLoading } = useQuery<
    UserWithFollowStatus[]
  >({
    queryKey: ["/api/users/search", searchQuery],
    enabled: searchQuery.length >= 2,
  });

  const followMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("POST", `/api/users/follow/${userId}`);
    },
    onSuccess: () => {
      toast({ title: t("friends.followSuccess") });
      queryClient.invalidateQueries({ queryKey: ["/api/users/friends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/following"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/followers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/search"] });
    },
    onError: () => {
      toast({ title: t("common.error"), variant: "destructive" });
    },
    onSettled: () => {
      setActionLoadingId(null);
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("DELETE", `/api/users/unfollow/${userId}`);
    },
    onSuccess: () => {
      toast({ title: t("friends.unfollowSuccess") });
      queryClient.invalidateQueries({ queryKey: ["/api/users/friends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/following"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/followers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/search"] });
    },
    onError: () => {
      toast({ title: t("common.error"), variant: "destructive" });
    },
    onSettled: () => {
      setActionLoadingId(null);
    },
  });

  const unblockMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("DELETE", `/api/users/unblock/${userId}`);
    },
    onSuccess: () => {
      toast({ title: t("friends.unblockSuccess") });
      queryClient.invalidateQueries({ queryKey: ["/api/users/blocked"] });
    },
    onError: () => {
      toast({ title: t("common.error"), variant: "destructive" });
    },
    onSettled: () => {
      setActionLoadingId(null);
    },
  });

  const handleAction = (userId: string, action: string) => {
    setActionLoadingId(userId);
    switch (action) {
      case "follow":
        followMutation.mutate(userId);
        break;
      case "unfollow":
        unfollowMutation.mutate(userId);
        break;
      case "unblock":
        unblockMutation.mutate(userId);
        break;
      case "chat":
        toast({ title: "Chat feature coming soon" });
        setActionLoadingId(null);
        break;
      case "challenge":
        toast({ title: "Challenge feature coming soon" });
        setActionLoadingId(null);
        break;
      default:
        setActionLoadingId(null);
    }
  };

  const followingIds = new Set(following.map((u) => u.id));

  return (
    <div className="container max-w-4xl mx-auto p-4 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <BackButton fallbackPath="/dashboard" />
        <div className="space-y-1">
          <h1 className="text-2xl font-bold" data-testid="text-friends-title">
            {t("friends.title")}
          </h1>
          <p className="text-muted-foreground" data-testid="text-friends-subtitle">
            {t("friends.subtitle")}
          </p>
        </div>
      </div>

      <Tabs defaultValue="friends" className="w-full">
        <TabsList className="grid w-full grid-cols-5" data-testid="tabs-friends">
          <TabsTrigger value="friends" data-testid="tab-friends">
            <Users className="w-4 h-4 me-2 hidden sm:inline" />
            {t("friends.friends")}
          </TabsTrigger>
          <TabsTrigger value="following" data-testid="tab-following">
            <UserPlus className="w-4 h-4 me-2 hidden sm:inline" />
            {t("friends.following")}
          </TabsTrigger>
          <TabsTrigger value="followers" data-testid="tab-followers">
            <Users className="w-4 h-4 me-2 hidden sm:inline" />
            {t("friends.followers")}
          </TabsTrigger>
          <TabsTrigger value="blocked" data-testid="tab-blocked">
            <Ban className="w-4 h-4 me-2 hidden sm:inline" />
            {t("friends.blocked")}
          </TabsTrigger>
          <TabsTrigger value="find" data-testid="tab-find">
            <Search className="w-4 h-4 me-2 hidden sm:inline" />
            {t("friends.findFriends")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="mt-4" data-testid="content-friends">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                {t("friends.friends")}
                {friends.length > 0 && (
                  <Badge variant="secondary">
                    {friends.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {friendsLoading ? (
                <LoadingSkeleton />
              ) : friends.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title={t("friends.noFriends")}
                  description={t("friends.noFriendsDesc")}
                />
              ) : (
                <div className="space-y-3">
                  {friends.map((user) => (
                    <UserCard
                      key={user.id}
                      user={user}
                      actionType="friend"
                      onAction={handleAction}
                      isLoading={actionLoadingId === user.id}
                      t={t}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="following" className="mt-4" data-testid="content-following">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                {t("friends.following")}
                {following.length > 0 && (
                  <Badge variant="secondary">
                    {following.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {followingLoading ? (
                <LoadingSkeleton />
              ) : following.length === 0 ? (
                <EmptyState
                  icon={UserPlus}
                  title={t("friends.noFollowing")}
                  description={t("friends.noFollowingDesc")}
                />
              ) : (
                <div className="space-y-3">
                  {following.map((user) => (
                    <UserCard
                      key={user.id}
                      user={user}
                      actionType="following"
                      onAction={handleAction}
                      isLoading={actionLoadingId === user.id}
                      t={t}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="followers" className="mt-4" data-testid="content-followers">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                {t("friends.followers")}
                {followers.length > 0 && (
                  <Badge variant="secondary">
                    {followers.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {followersLoading ? (
                <LoadingSkeleton />
              ) : followers.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title={t("friends.noFollowers")}
                  description={t("friends.noFollowersDesc")}
                />
              ) : (
                <div className="space-y-3">
                  {followers
                    .filter((user) => !followingIds.has(user.id))
                    .map((user) => (
                      <UserCard
                        key={user.id}
                        user={user}
                        actionType="follower"
                        onAction={handleAction}
                        isLoading={actionLoadingId === user.id}
                        t={t}
                      />
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blocked" className="mt-4" data-testid="content-blocked">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ban className="w-5 h-5" />
                {t("friends.blocked")}
                {blocked.length > 0 && (
                  <Badge variant="secondary">
                    {blocked.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {blockedLoading ? (
                <LoadingSkeleton />
              ) : blocked.length === 0 ? (
                <EmptyState
                  icon={UserX}
                  title={t("friends.noBlocked")}
                  description={t("friends.noBlockedDesc")}
                />
              ) : (
                <div className="space-y-3">
                  {blocked.map((user) => (
                    <UserCard
                      key={user.id}
                      user={user}
                      actionType="blocked"
                      onAction={handleAction}
                      isLoading={actionLoadingId === user.id}
                      t={t}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="find" className="mt-4" data-testid="content-find">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                {t("friends.findFriends")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t("friends.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="ps-10"
                  data-testid="input-search-users"
                />
              </div>

              {searchQuery.length >= 2 && (
                <div>
                  <h3 className="font-medium mb-3">{t("friends.searchResults")}</h3>
                  {searchLoading ? (
                    <LoadingSkeleton />
                  ) : searchResults.length === 0 ? (
                    <EmptyState
                      icon={Search}
                      title={t("friends.noResults")}
                      description={t("friends.noResultsDesc")}
                    />
                  ) : (
                    <div className="space-y-3">
                      {searchResults.map((user) => (
                        <UserCard
                          key={user.id}
                          user={user}
                          actionType="search"
                          onAction={handleAction}
                          isLoading={actionLoadingId === user.id}
                          t={t}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
