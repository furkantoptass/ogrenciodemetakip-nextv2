import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Bütün sayfalar istek anında üretilir (force-dynamic); ISR/önbellek deposu gerekmez.
export default defineCloudflareConfig({});
