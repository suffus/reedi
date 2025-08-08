# Backend Scripts

This directory contains utility scripts for managing the application.

## Locked Posts Scripts

### Find User
Find a user by email or username to get their ID.

```bash
node find-user.js <email_or_username>
```

Example:
```bash
node find-user.js user@example.com
```

### Grant Locked Posts Permission
Grant a user permission to create locked posts.

```bash
node grant-locked-posts-permission.js <userId>
```

Example:
```bash
node grant-locked-posts-permission.js cmdyyo75f00e011mgeek77lse
```

## Image Processing Scripts

### Reprocess Images
Send unprocessed images to the media processor.

```bash
node reprocess-images.js [limit]
```

Example:
```bash
node reprocess-images.js 10
```

### Check Image Status
Check the processing status of images in the database.

```bash
node check-image-status.js
```

### Check Jobs
Inspect media processing job records.

```bash
node check-jobs.js
``` 