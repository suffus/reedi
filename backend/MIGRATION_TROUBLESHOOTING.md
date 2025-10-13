# Prisma Migration Troubleshooting

## Problem: "All data will be lost" Migration Drift Error

When Prisma detects that your database schema doesn't match your migration history, it will want to reset the database. This happens when:

- Tables/columns exist in the database but aren't in the migration history
- You used `prisma db push` instead of migrations
- Database was modified manually or from a different schema source

## Solution: Mark Migrations as Applied

Instead of resetting (which loses data), tell Prisma that migrations have already been applied:

```bash
# Check migration status
npx prisma migrate status

# Mark a specific migration as applied (without running it)
npx prisma migrate resolve --applied <migration_name>

# Example:
npx prisma migrate resolve --applied 20251012203344_add_facets_and_line_management

# Verify status
npx prisma migrate status
```

## When to Use Each Command

### Development
```bash
# Create and apply migration
npx prisma migrate dev --name <name>

# Create migration without applying (for review)
npx prisma migrate dev --create-only --name <name>
```

### Production
```bash
# Apply pending migrations (never resets, safe for production)
npx prisma migrate deploy

# Mark migration as applied without running
npx prisma migrate resolve --applied <migration_name>
```

### Danger Zone (Avoid in Production)
```bash
# Push schema without migrations (loses migration history)
npx prisma db push

# Reset database (DELETES ALL DATA)
npx prisma migrate reset
```

## Common Scenarios

### Scenario 1: Migration Already Applied Manually
**Problem**: Tables exist, migration shows as pending  
**Solution**: Mark as applied
```bash
npx prisma migrate resolve --applied <migration_name>
```

### Scenario 2: Migration Failed Halfway
**Problem**: Migration partially applied  
**Solution**: Mark as rolled back, fix schema, try again
```bash
npx prisma migrate resolve --rolled-back <migration_name>
npx prisma migrate dev
```

### Scenario 3: New Database Needs All Migrations
**Problem**: Fresh database, multiple pending migrations  
**Solution**: Use deploy
```bash
npx prisma migrate deploy
```

### Scenario 4: Production Database Drift
**Problem**: Production schema differs from migrations  
**Solution**:
1. Create baseline migration
2. Test on staging first
3. Mark as applied on production
```bash
# On staging
npx prisma migrate dev --create-only --name baseline_production

# Review SQL

# On production
npx prisma migrate resolve --applied baseline_production
npx prisma migrate deploy
```

## Our Recent Fix (October 2025)

We had drift because facets and line management tables existed but weren't in migration history:

```bash
# Test database
DATABASE_URL="postgresql://postgres:te1twe5tX1966@localhost:5432/reeditest" \
  npx prisma migrate resolve --applied 20251012003716_sync_schema_with_database

DATABASE_URL="postgresql://postgres:te1twe5tX1966@localhost:5432/reeditest" \
  npx prisma migrate resolve --applied 20251012203344_add_facets_and_line_management

# Verify
DATABASE_URL="postgresql://postgres:te1twe5tX1966@localhost:5432/reeditest" \
  npx prisma migrate status
```

**Result**: ✅ Database schema is up to date!

## Best Practices

1. **Always use migrations in production** - Never use `db push`
2. **Test migrations on staging first** - Before applying to production
3. **Use `migrate deploy` for production** - Never `migrate dev`
4. **Keep migration history in git** - Track all migrations in version control
5. **One migration per logical change** - Makes rollback easier
6. **Review generated SQL** - Before applying to production
7. **Backup before major migrations** - Always have a rollback plan

## Useful Commands

```bash
# Check current status
npx prisma migrate status

# View pending migrations
npx prisma migrate status | grep "not yet been applied"

# Generate Prisma Client after schema changes
npx prisma generate

# Introspect existing database (don't overwrite schema!)
npx prisma db pull

# View migration history in database
psql -d <database> -c "SELECT * FROM _prisma_migrations;"
```

## Emergency: Need to Reset Development

If you're in development and it's okay to lose data:

```bash
# Reset database and apply all migrations
npx prisma migrate reset

# Reseed if needed
npm run test:seed:reset
```

**⚠️ NEVER run this in production!**

