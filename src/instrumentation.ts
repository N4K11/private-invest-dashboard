import { validateEnvironmentOnStartup } from "@/lib/env";

export async function register() {
  validateEnvironmentOnStartup();
}
