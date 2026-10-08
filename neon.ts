import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  // Object Storage for product image uploads
  buckets: {
    uploads: {
      access: "public_read", // Allow public read access for product images
    },
  },
  
  // Optional: Add AI Gateway if needed for future features
  // aiGateway: true,
  
  // Optional: Add Functions if you want to move backend to Neon Functions
  // functions: {},
});
