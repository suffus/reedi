cd backend

# 1. Migrate main/development database
DATABASE_URL="postgresql://postgres:te1twe5tX1966@localhost:5432/reeditest" npx prisma migrate dev --name add_facets_and_line_management

# 2. Migrate test database
DATABASE_URL="postgresql://postgres:te1twe5tX1966@localhost:5432/reeditestdb" npx prisma migrate dev --name add_facets_and_line_management

# 3. Generate Prisma client
npx prisma generate

# 4. Seed facets (optional - only needed for main DB if you want to use the system)
DATABASE_URL="your-main-db-url" npx ts-node prisma/seeds/facets.ts
