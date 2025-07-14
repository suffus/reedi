const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migratePostImages() {
  try {
    console.log('Starting migration of existing post-image relationships...');
    
    // Find all images that have a postId (from the old schema)
    const imagesWithPostId = await prisma.image.findMany({
      where: {
        postId: {
          not: null
        }
      },
      select: {
        id: true,
        postId: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    console.log(`Found ${imagesWithPostId.length} images with postId`);

    if (imagesWithPostId.length === 0) {
      console.log('No existing post-image relationships found. Migration complete.');
      return;
    }

    // Group images by postId to maintain order
    const postImageGroups = {};
    imagesWithPostId.forEach((image, index) => {
      if (!postImageGroups[image.postId]) {
        postImageGroups[image.postId] = [];
      }
      postImageGroups[image.postId].push({
        ...image,
        order: postImageGroups[image.postId].length // Maintain order by creation time
      });
    });

    // Create PostImage records for each group
    let createdCount = 0;
    for (const [postId, images] of Object.entries(postImageGroups)) {
      // Check if post still exists
      const post = await prisma.post.findUnique({
        where: { id: postId }
      });

      if (!post) {
        console.log(`Post ${postId} not found, skipping ${images.length} images`);
        continue;
      }

      // Create PostImage records for this post
      const postImageRecords = images.map(image => ({
        postId: image.postId,
        imageId: image.id,
        order: image.order
      }));

      try {
        await prisma.postImage.createMany({
          data: postImageRecords,
          skipDuplicates: true // In case some records already exist
        });
        
        createdCount += postImageRecords.length;
        console.log(`Created ${postImageRecords.length} PostImage records for post ${postId}`);
      } catch (error) {
        console.error(`Error creating PostImage records for post ${postId}:`, error.message);
      }
    }

    console.log(`Migration complete! Created ${createdCount} PostImage records.`);

    // Optional: Remove the old postId field from images (uncomment if you want to clean up)
    // console.log('Removing old postId field from images...');
    // await prisma.$executeRaw`ALTER TABLE images DROP COLUMN IF EXISTS "postId"`;
    // console.log('Old postId field removed from images table.');

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migratePostImages()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  }); 