import type { DefaultSession } from "next-auth";
import type { JWT as DefaultJwt } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      displayName?: string;
      workspaceId?: string;
      workspaceRole?: string;
      workspaceSlug?: string;
    };
  }

  interface User {
    id: string;
    displayName?: string | null;
    workspaceId?: string | null;
    workspaceRole?: string | null;
    workspaceSlug?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJwt {
    userId?: string;
    displayName?: string | null;
    workspaceId?: string | null;
    workspaceRole?: string | null;
    workspaceSlug?: string | null;
  }
}
