import { testPrisma } from '../test-database.config'
import { TestUser } from './users'

export async function seedMedia(users: TestUser[]) {
  console.log('🌱 Seeding media...')
  
  if (users.length < 3) {
    console.log('⚠️  Not enough users for media seeding')
    return
  }
  
  const alice = users[0]
  const bob = users[1]
  const charlie = users[2]
  
  // Alice's media (mix of images and videos)
  const aliceMedia = [
    {
      url: 'test-data/alice/image1.jpg',
      s3Key: 'uploads/alice/001-vacation.jpg',
      thumbnailS3Key: 'uploads/alice/001-vacation-thumb.jpg',
      originalFilename: 'vacation-photo.jpg',
      altText: 'Beach vacation photo',
      caption: 'Beautiful sunset at the beach',
      tags: ['vacation', 'beach', 'sunset'],
      visibility: 'PUBLIC' as const,
      mediaType: 'IMAGE' as const,
      processingStatus: 'COMPLETED' as const,
      width: 1920,
      height: 1080,
      size: 512,
      mimeType: 'image/jpeg',
      authorId: alice.id
    },
    {
      url: 'test-data/alice/image2.jpg',
      s3Key: 'uploads/alice/002-family.jpg',
      thumbnailS3Key: 'uploads/alice/002-family-thumb.jpg',
      originalFilename: 'family-dinner.jpg',
      altText: 'Family dinner',
      caption: 'Great evening with family',
      tags: ['family', 'dinner'],
      visibility: 'FRIENDS_ONLY' as const,
      mediaType: 'IMAGE' as const,
      processingStatus: 'COMPLETED' as const,
      width: 1280,
      height: 720,
      size: 320,
      mimeType: 'image/jpeg',
      authorId: alice.id
    },
    {
      url: 'test-data/alice/video1.mp4',
      s3Key: 'uploads/alice/003-birthday.mp4',
      thumbnailS3Key: 'uploads/alice/003-birthday-thumb.jpg',
      videoS3Key: 'uploads/alice/003-birthday-processed.mp4',
      originalFilename: 'birthday-party.mp4',
      altText: 'Birthday celebration',
      caption: 'My birthday party!',
      tags: ['birthday', 'celebration', 'party'],
      visibility: 'PUBLIC' as const,
      mediaType: 'VIDEO' as const,
      processingStatus: 'COMPLETED' as const,
      width: 1920,
      height: 1080,
      size: 5120,
      duration: 45,
      codec: 'h264',
      bitrate: 5000,
      framerate: 30,
      mimeType: 'video/mp4',
      authorId: alice.id
    },
    {
      url: 'test-data/alice/image3.jpg',
      s3Key: 'uploads/alice/004-private.jpg',
      thumbnailS3Key: 'uploads/alice/004-private-thumb.jpg',
      originalFilename: 'private-note.jpg',
      altText: 'Private note',
      caption: 'Personal reminder',
      tags: ['private', 'personal'],
      visibility: 'PRIVATE' as const,
      mediaType: 'IMAGE' as const,
      processingStatus: 'COMPLETED' as const,
      width: 800,
      height: 600,
      size: 150,
      mimeType: 'image/jpeg',
      authorId: alice.id
    }
  ]
  
  // Bob's media
  const bobMedia = [
    {
      url: 'test-data/bob/image1.jpg',
      s3Key: 'uploads/bob/001-work.jpg',
      thumbnailS3Key: 'uploads/bob/001-work-thumb.jpg',
      originalFilename: 'office-view.jpg',
      altText: 'Office view',
      caption: 'New office setup',
      tags: ['work', 'office'],
      visibility: 'PUBLIC' as const,
      mediaType: 'IMAGE' as const,
      processingStatus: 'COMPLETED' as const,
      width: 1920,
      height: 1080,
      size: 480,
      mimeType: 'image/jpeg',
      authorId: bob.id
    },
    {
      url: 'test-data/bob/video1.mp4',
      s3Key: 'uploads/bob/002-tutorial.mp4',
      thumbnailS3Key: 'uploads/bob/002-tutorial-thumb.jpg',
      videoS3Key: 'uploads/bob/002-tutorial-processed.mp4',
      originalFilename: 'coding-tutorial.mp4',
      altText: 'Coding tutorial',
      caption: 'How to build a React app',
      tags: ['coding', 'tutorial', 'react'],
      visibility: 'PUBLIC' as const,
      mediaType: 'VIDEO' as const,
      processingStatus: 'COMPLETED' as const,
      width: 1920,
      height: 1080,
      size: 8192,
      duration: 120,
      codec: 'h264',
      bitrate: 4500,
      framerate: 30,
      mimeType: 'video/mp4',
      authorId: bob.id
    },
    {
      url: 'test-data/bob/image2.jpg',
      s3Key: 'uploads/bob/003-pending.jpg',
      originalFilename: 'processing.jpg',
      altText: 'Image being processed',
      caption: 'Still processing...',
      tags: ['pending'],
      visibility: 'PUBLIC' as const,
      mediaType: 'IMAGE' as const,
      processingStatus: 'PENDING' as const,
      size: 2048,
      mimeType: 'image/jpeg',
      authorId: bob.id
    }
  ]
  
  // Charlie's media (content creator with more media)
  const charlieMedia = [
    {
      url: 'test-data/charlie/video1.mp4',
      s3Key: 'uploads/charlie/001-vlog.mp4',
      thumbnailS3Key: 'uploads/charlie/001-vlog-thumb.jpg',
      videoS3Key: 'uploads/charlie/001-vlog-processed.mp4',
      originalFilename: 'daily-vlog.mp4',
      altText: 'Daily vlog',
      caption: 'Day in my life',
      tags: ['vlog', 'daily', 'lifestyle'],
      visibility: 'PUBLIC' as const,
      mediaType: 'VIDEO' as const,
      processingStatus: 'COMPLETED' as const,
      width: 3840,
      height: 2160,
      size: 15360,
      duration: 180,
      codec: 'h264',
      bitrate: 8000,
      framerate: 60,
      mimeType: 'video/mp4',
      authorId: charlie.id
    },
    {
      url: 'test-data/charlie/image1.jpg',
      s3Key: 'uploads/charlie/002-photography.jpg',
      thumbnailS3Key: 'uploads/charlie/002-photography-thumb.jpg',
      originalFilename: 'landscape.jpg',
      altText: 'Mountain landscape',
      caption: 'Amazing mountain view',
      tags: ['photography', 'landscape', 'mountains', 'nature'],
      visibility: 'PUBLIC' as const,
      mediaType: 'IMAGE' as const,
      processingStatus: 'COMPLETED' as const,
      width: 4000,
      height: 3000,
      size: 2048,
      mimeType: 'image/jpeg',
      authorId: charlie.id
    },
    {
      url: 'test-data/charlie/image2.jpg',
      s3Key: 'uploads/charlie/003-portrait.jpg',
      thumbnailS3Key: 'uploads/charlie/003-portrait-thumb.jpg',
      originalFilename: 'portrait-session.jpg',
      altText: 'Portrait photo',
      caption: 'Professional portrait session',
      tags: ['photography', 'portrait', 'professional'],
      visibility: 'PUBLIC' as const,
      mediaType: 'IMAGE' as const,
      processingStatus: 'COMPLETED' as const,
      width: 2400,
      height: 3600,
      size: 1536,
      mimeType: 'image/jpeg',
      authorId: charlie.id
    },
    {
      url: 'test-data/charlie/video2.mp4',
      s3Key: 'uploads/charlie/004-failed.mp4',
      originalFilename: 'corrupted-video.mp4',
      altText: 'Failed processing',
      caption: 'This video failed to process',
      tags: ['failed'],
      visibility: 'PUBLIC' as const,
      mediaType: 'VIDEO' as const,
      processingStatus: 'FAILED' as const,
      size: 10240,
      mimeType: 'video/mp4',
      authorId: charlie.id
    }
  ]
  
  // Create all media records
  const allMedia = [...aliceMedia, ...bobMedia, ...charlieMedia]
  
  for (const mediaData of allMedia) {
    await testPrisma.media.create({
      data: mediaData
    })
  }
  
  console.log(`✅ Created ${allMedia.length} media items (${aliceMedia.length} for Alice, ${bobMedia.length} for Bob, ${charlieMedia.length} for Charlie)`)
}

export async function seedExtendedMedia(users: TestUser[]) {
  if (users.length < 10) {
    console.log('⚠️  Not enough users for extended media seeding')
    return
  }
  
  console.log('🌱 Seeding extended media...')
  
  // Add more media for users 5-9
  const additionalMedia = []
  
  for (let i = 5; i < 10; i++) {
    const user = users[i]
    
    // Each extended user gets 2-3 media items
    additionalMedia.push({
      url: `test-data/${user.username}/image1.jpg`,
      s3Key: `uploads/${user.id}/image1.jpg`,
      thumbnailS3Key: `uploads/${user.id}/image1-thumb.jpg`,
      originalFilename: `photo-${i}.jpg`,
      altText: `Photo by ${user.name}`,
      caption: `Test photo ${i}`,
      tags: ['test', 'photo'],
      visibility: 'PUBLIC' as const,
      mediaType: 'IMAGE' as const,
      processingStatus: 'COMPLETED' as const,
      width: 1920,
      height: 1080,
      size: 500,
      mimeType: 'image/jpeg',
      authorId: user.id
    })
  }
  
  for (const mediaData of additionalMedia) {
    await testPrisma.media.create({
      data: mediaData
    })
  }
  
  console.log(`✅ Created ${additionalMedia.length} additional media items`)
}

