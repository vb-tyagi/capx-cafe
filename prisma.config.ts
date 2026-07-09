// Prisma 7 config. Connection URL for `prisma migrate` moved here out of schema.prisma;
// runtime uses a driver adapter (e.g. @prisma/adapter-pg) passed to the PrismaClient constructor.
// Wired fully when the local DB is stood up (`docker compose up`); URL comes from DATABASE_URL.
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
});
