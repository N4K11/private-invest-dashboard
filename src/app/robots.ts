import type { MetadataRoute } from "next";

import { DASHBOARD_BASE_PATH } from "@/lib/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [`/${DASHBOARD_BASE_PATH}`, `/api/private/`],
      },
    ],
  };
}
