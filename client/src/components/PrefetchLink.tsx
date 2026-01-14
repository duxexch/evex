import { Link } from "wouter";
import { useCallback, useState, type ReactNode } from "react";
import { queryClient } from "@/lib/queryClient";

const pageModules: Record<string, () => Promise<unknown>> = {
  "/": () => import("@/pages/dashboard"),
  "/wallet": () => import("@/pages/wallet"),
  "/challenges": () => import("@/pages/challenges"),
  "/play": () => import("@/pages/play"),
  "/p2p": () => import("@/pages/p2p"),
  "/friends": () => import("@/pages/friends"),
  "/chat": () => import("@/pages/chat"),
  "/multiplayer": () => import("@/pages/multiplayer"),
  "/free": () => import("@/pages/free"),
  "/transactions": () => import("@/pages/transactions"),
  "/complaints": () => import("@/pages/complaints"),
  "/support": () => import("@/pages/support"),
  "/settings": () => import("@/pages/settings"),
  "/games": () => import("@/pages/games"),
};

// API endpoints to prefetch for each page
const pageApiPrefetch: Record<string, string[]> = {
  "/support": ["/api/support/contacts"],
  "/transactions": ["/api/transactions"],
  "/complaints": ["/api/complaints"],
  "/wallet": ["/api/wallet/stats"],
  "/friends": ["/api/friends"],
};

const prefetchedPaths = new Set<string>();
const prefetchedApis = new Set<string>();

interface PrefetchLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function PrefetchLink({ href, children, className, onClick }: PrefetchLinkProps) {
  const [isPrefetched, setIsPrefetched] = useState(false);

  const handleMouseEnter = useCallback(() => {
    // Prefetch module
    if (!isPrefetched && !prefetchedPaths.has(href)) {
      const loader = pageModules[href];
      if (loader) {
        loader().then(() => {
          prefetchedPaths.add(href);
          setIsPrefetched(true);
        });
      }
    }
    
    // Also prefetch API data
    prefetchApiData(href);
  }, [href, isPrefetched]);

  return (
    <Link href={href}>
      <span 
        className={className} 
        onMouseEnter={handleMouseEnter}
        onTouchStart={handleMouseEnter}
        onClick={onClick}
      >
        {children}
      </span>
    </Link>
  );
}

// Default fetch function for prefetching
async function fetchApi(endpoint: string) {
  const res = await fetch(endpoint, { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to fetch ${endpoint}`);
  return res.json();
}

// Prefetch API data for a page
function prefetchApiData(path: string) {
  const apis = pageApiPrefetch[path];
  if (!apis) return;
  
  apis.forEach(api => {
    if (prefetchedApis.has(api)) return;
    prefetchedApis.add(api);
    
    // Use queryClient to prefetch with explicit queryFn
    queryClient.prefetchQuery({
      queryKey: [api],
      queryFn: () => fetchApi(api),
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  });
}

export function prefetchPage(path: string) {
  // Prefetch module
  if (!prefetchedPaths.has(path)) {
    const loader = pageModules[path];
    if (loader) {
      loader().then(() => {
        prefetchedPaths.add(path);
      });
    }
  }
  
  // Also prefetch API data
  prefetchApiData(path);
}
