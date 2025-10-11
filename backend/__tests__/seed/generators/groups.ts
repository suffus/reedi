import { testPrisma } from '../test-database.config'
import { TestUser } from './users'

export async function seedGroups(users: TestUser[]) {
  console.log('🌱 Seeding groups...')
  
  if (users.length < 5) {
    console.log('⚠️  Not enough users for group seeding')
    return
  }
  
  const alice = users[0]
  const bob = users[1]
  const charlie = users[2]
  const david = users[3]
  const eve = users[4]
  
  // Get some media for group avatars/covers
  const aliceMedia = await testPrisma.media.findFirst({
    where: { authorId: alice.id, mediaType: 'IMAGE', processingStatus: 'COMPLETED' }
  })
  
  const bobMedia = await testPrisma.media.findFirst({
    where: { authorId: bob.id, mediaType: 'IMAGE', processingStatus: 'COMPLETED' }
  })
  
  const charlieMedia = await testPrisma.media.findFirst({
    where: { authorId: charlie.id, mediaType: 'IMAGE', processingStatus: 'COMPLETED' }
  })
  
  let groupsCreated = 0
  
  // ========================================
  // PUBLIC GROUPS (4 groups)
  // ========================================
  
  // 1. Tech Enthusiasts (PUBLIC, owned by Bob)
  const techGroup = await testPrisma.group.create({
    data: {
      name: 'Tech Enthusiasts',
      username: 'tech_enthusiasts',
      description: 'A community for technology lovers, developers, and innovators. Share your projects, ask questions, and learn together!',
      rules: '1. Be respectful\n2. No spam\n3. Stay on topic\n4. Help others learn',
      visibility: 'PUBLIC',
      type: 'SOCIAL_LEARNING',
      moderationPolicy: 'NO_MODERATION',
      avatarId: bobMedia?.id
    }
  })
  
  // Add members
  await testPrisma.groupMember.createMany({
    data: [
      { groupId: techGroup.id, userId: bob.id, role: 'OWNER' },
      { groupId: techGroup.id, userId: alice.id, role: 'MEMBER' },
      { groupId: techGroup.id, userId: charlie.id, role: 'MEMBER' },
      { groupId: techGroup.id, userId: david.id, role: 'ADMIN' }
    ]
  })
  groupsCreated++
  
  // 2. Photography Club (PUBLIC, owned by Charlie)
  const photoGroup = await testPrisma.group.create({
    data: {
      name: 'Photography Club',
      username: 'photo_club',
      description: 'Share your photography, get feedback, and learn from fellow photographers. All skill levels welcome!',
      rules: '1. Only original photos\n2. Constructive criticism only\n3. Credit other photographers\n4. No NSFW content',
      visibility: 'PUBLIC',
      type: 'GENERAL',
      moderationPolicy: 'NO_MODERATION',
      avatarId: charlieMedia?.id
    }
  })
  
  await testPrisma.groupMember.createMany({
    data: [
      { groupId: photoGroup.id, userId: charlie.id, role: 'OWNER' },
      { groupId: photoGroup.id, userId: alice.id, role: 'MODERATOR' },
      { groupId: photoGroup.id, userId: bob.id, role: 'MEMBER' }
    ]
  })
  groupsCreated++
  
  // 3. Gaming Community (PUBLIC, owned by David)
  const gamingGroup = await testPrisma.group.create({
    data: {
      name: 'Gaming Community',
      username: 'gaming_community',
      description: 'For gamers of all platforms! Discuss games, share clips, find teammates, and have fun.',
      rules: '1. Be friendly\n2. No toxicity\n3. Use spoiler warnings\n4. Respect all platforms',
      visibility: 'PUBLIC',
      type: 'GAMING',
      moderationPolicy: 'NO_MODERATION'
    }
  })
  
  await testPrisma.groupMember.createMany({
    data: [
      { groupId: gamingGroup.id, userId: david.id, role: 'OWNER' },
      { groupId: gamingGroup.id, userId: bob.id, role: 'ADMIN' },
      { groupId: gamingGroup.id, userId: alice.id, role: 'MEMBER' }
    ]
  })
  groupsCreated++
  
  // 4. Local Buy & Sell (PUBLIC, owned by Alice)
  const buySellGroup = await testPrisma.group.create({
    data: {
      name: 'Local Buy & Sell',
      username: 'local_marketplace',
      description: 'Buy, sell, and trade locally. Great deals, no shipping fees!',
      rules: '1. Post clear photos\n2. Include prices\n3. Meet safely\n4. No scams or fraud',
      visibility: 'PUBLIC',
      type: 'BUY_SELL',
      moderationPolicy: 'ADMIN_APPROVAL_REQUIRED',
      avatarId: aliceMedia?.id
    }
  })
  
  await testPrisma.groupMember.createMany({
    data: [
      { groupId: buySellGroup.id, userId: alice.id, role: 'OWNER' },
      { groupId: buySellGroup.id, userId: david.id, role: 'MODERATOR' },
      { groupId: buySellGroup.id, userId: charlie.id, role: 'MEMBER' }
    ]
  })
  groupsCreated++
  
  // ========================================
  // SEMI-PRIVATE GROUPS (4 groups - PRIVATE_VISIBLE)
  // ========================================
  
  // 5. React Developers (PRIVATE_VISIBLE, owned by Bob)
  const reactGroup = await testPrisma.group.create({
    data: {
      name: 'React Developers',
      username: 'react_devs',
      description: 'Private community for React developers. Share knowledge, best practices, and collaborate on projects.',
      rules: '1. React-related content only\n2. Share code responsibly\n3. No job spam\n4. Help junior developers',
      visibility: 'PRIVATE_VISIBLE',
      type: 'SOCIAL_LEARNING',
      moderationPolicy: 'ADMIN_APPROVAL_REQUIRED'
    }
  })
  
  await testPrisma.groupMember.createMany({
    data: [
      { groupId: reactGroup.id, userId: bob.id, role: 'OWNER' },
      { groupId: reactGroup.id, userId: alice.id, role: 'ADMIN' },
      { groupId: reactGroup.id, userId: david.id, role: 'MEMBER' }
    ]
  })
  
  // Add pending application from Charlie
  await testPrisma.groupApplication.create({
    data: {
      groupId: reactGroup.id,
      applicantId: charlie.id,
      message: 'I\'ve been working with React for 3 years and would love to join!',
      status: 'PENDING'
    }
  })
  groupsCreated++
  
  // 6. Professional Photographers (PRIVATE_VISIBLE, owned by Charlie)
  const proPhotoGroup = await testPrisma.group.create({
    data: {
      name: 'Professional Photographers',
      username: 'pro_photographers',
      description: 'Exclusive group for professional photographers. Portfolio reviews, business tips, and networking.',
      rules: '1. Professionals only\n2. No ads without permission\n3. Respect copyrights\n4. Share expertise',
      visibility: 'PRIVATE_VISIBLE',
      type: 'WORK',
      moderationPolicy: 'ADMIN_APPROVAL_REQUIRED'
    }
  })
  
  await testPrisma.groupMember.createMany({
    data: [
      { groupId: proPhotoGroup.id, userId: charlie.id, role: 'OWNER' },
      { groupId: proPhotoGroup.id, userId: alice.id, role: 'MEMBER' }
    ]
  })
  groupsCreated++
  
  // 7. Job Opportunities (PRIVATE_VISIBLE, owned by David)
  const jobsGroup = await testPrisma.group.create({
    data: {
      name: 'Job Opportunities',
      username: 'job_opportunities',
      description: 'Curated job postings for tech professionals. Quality over quantity.',
      rules: '1. Verified employers only\n2. Include salary ranges\n3. No MLM or pyramid schemes\n4. Be honest about requirements',
      visibility: 'PRIVATE_VISIBLE',
      type: 'JOBS',
      moderationPolicy: 'ADMIN_APPROVAL_REQUIRED'
    }
  })
  
  await testPrisma.groupMember.createMany({
    data: [
      { groupId: jobsGroup.id, userId: david.id, role: 'OWNER' },
      { groupId: jobsGroup.id, userId: bob.id, role: 'ADMIN' },
      { groupId: jobsGroup.id, userId: charlie.id, role: 'MEMBER' }
    ]
  })
  groupsCreated++
  
  // 8. Freelance Collective (PRIVATE_VISIBLE, owned by Alice)
  const freelanceGroup = await testPrisma.group.create({
    data: {
      name: 'Freelance Collective',
      username: 'freelance_collective',
      description: 'Support group for freelancers. Share contracts, pricing advice, and client tips.',
      rules: '1. Support each other\n2. Share knowledge freely\n3. No poaching clients\n4. Keep it professional',
      visibility: 'PRIVATE_VISIBLE',
      type: 'WORK',
      moderationPolicy: 'SELECTIVE_MODERATION'
    }
  })
  
  await testPrisma.groupMember.createMany({
    data: [
      { groupId: freelanceGroup.id, userId: alice.id, role: 'OWNER' },
      { groupId: freelanceGroup.id, userId: charlie.id, role: 'ADMIN' },
      { groupId: freelanceGroup.id, userId: bob.id, role: 'MEMBER' }
    ]
  })
  groupsCreated++
  
  // ========================================
  // PRIVATE HIDDEN GROUPS (2 groups)
  // ========================================
  
  // 9. Content Creators Inner Circle (PRIVATE_HIDDEN, owned by Charlie)
  const creatorsGroup = await testPrisma.group.create({
    data: {
      name: 'Content Creators Inner Circle',
      username: 'creators_circle',
      description: 'Private mastermind group for content creators. Strategy, monetization, and collaboration.',
      rules: '1. Invite only\n2. What happens here stays here\n3. Be vulnerable and honest\n4. Support each other\'s growth',
      visibility: 'PRIVATE_HIDDEN',
      type: 'WORK',
      moderationPolicy: 'NO_MODERATION'
    }
  })
  
  await testPrisma.groupMember.createMany({
    data: [
      { groupId: creatorsGroup.id, userId: charlie.id, role: 'OWNER' },
      { groupId: creatorsGroup.id, userId: alice.id, role: 'ADMIN' }
    ]
  })
  
  // Add invitation for Bob
  await testPrisma.groupInvitation.create({
    data: {
      groupId: creatorsGroup.id,
      inviterId: charlie.id,
      inviteeUserId: bob.id,
      inviteCode: 'CREATOR_BOB_2024',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
    }
  })
  groupsCreated++
  
  // 10. Family & Close Friends (PRIVATE_HIDDEN, owned by Alice)
  const familyGroup = await testPrisma.group.create({
    data: {
      name: 'Family & Close Friends',
      username: 'alice_inner_circle',
      description: 'Private group for family updates and close friends only.',
      rules: 'Be kind and stay connected!',
      visibility: 'PRIVATE_HIDDEN',
      type: 'PARENTING',
      moderationPolicy: 'NO_MODERATION'
    }
  })
  
  await testPrisma.groupMember.createMany({
    data: [
      { groupId: familyGroup.id, userId: alice.id, role: 'OWNER' },
      { groupId: familyGroup.id, userId: bob.id, role: 'MEMBER' },
      { groupId: familyGroup.id, userId: eve.id, role: 'MEMBER' }
    ]
  })
  groupsCreated++
  
  console.log(`✅ Created ${groupsCreated} groups`)
  console.log('   - 4 PUBLIC groups')
  console.log('   - 4 PRIVATE_VISIBLE (semi-private) groups')
  console.log('   - 2 PRIVATE_HIDDEN (fully private) groups')
  
  // Now create some group posts
  await seedGroupPosts([
    techGroup,
    photoGroup,
    gamingGroup,
    buySellGroup,
    reactGroup,
    proPhotoGroup,
    jobsGroup,
    freelanceGroup,
    creatorsGroup,
    familyGroup
  ], users)
}

async function seedGroupPosts(groups: any[], users: TestUser[]) {
  console.log('🌱 Seeding group posts...')
  
  const alice = users[0]
  const bob = users[1]
  const charlie = users[2]
  const david = users[3]
  
  // Get some existing posts from users
  const alicePosts = await testPrisma.post.findMany({
    where: { authorId: alice.id, publicationStatus: 'PUBLIC' },
    take: 1
  })
  
  const bobPosts = await testPrisma.post.findMany({
    where: { authorId: bob.id, publicationStatus: 'PUBLIC' },
    take: 2
  })
  
  const charliePosts = await testPrisma.post.findMany({
    where: { authorId: charlie.id, publicationStatus: 'PUBLIC' },
    take: 2
  })
  
  let groupPostsCreated = 0
  
  // Tech Enthusiasts - Bob shares his tutorial
  if (bobPosts.length > 0 && groups[0]) {
    await testPrisma.groupPost.create({
      data: {
        groupId: groups[0].id,
        postId: bobPosts[0].id,
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: bob.id
      }
    })
    groupPostsCreated++
  }
  
  // Photography Club - Charlie shares portfolio
  if (charliePosts.length > 0 && groups[1]) {
    await testPrisma.groupPost.create({
      data: {
        groupId: groups[1].id,
        postId: charliePosts[0].id,
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: charlie.id
      }
    })
    groupPostsCreated++
  }
  
  // Gaming Community - Alice shares vacation (pending approval for testing)
  if (alicePosts.length > 0 && groups[2]) {
    await testPrisma.groupPost.create({
      data: {
        groupId: groups[2].id,
        postId: alicePosts[0].id,
        status: 'PENDING_APPROVAL'
      }
    })
    groupPostsCreated++
  }
  
  // Local Buy & Sell - requires approval, Charlie's post is pending
  if (charliePosts.length > 1 && groups[3]) {
    await testPrisma.groupPost.create({
      data: {
        groupId: groups[3].id,
        postId: charliePosts[1].id,
        status: 'PENDING_APPROVAL'
      }
    })
    groupPostsCreated++
  }
  
  // React Developers - Bob shares another post
  if (bobPosts.length > 1 && groups[4]) {
    await testPrisma.groupPost.create({
      data: {
        groupId: groups[4].id,
        postId: bobPosts[1].id,
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: bob.id
      }
    })
    groupPostsCreated++
  }
  
  console.log(`✅ Created ${groupPostsCreated} group posts`)
}

export async function seedExtendedGroups(users: TestUser[]) {
  if (users.length < 10) {
    console.log('⚠️  Not enough users for extended group seeding')
    return
  }
  
  console.log('🌱 Seeding extended groups...')
  
  let groupsCreated = 0
  
  // Create a few more groups with extended users
  for (let i = 5; i < 8; i++) {
    const owner = users[i]
    
    const group = await testPrisma.group.create({
      data: {
        name: `${owner.name}'s Group`,
        username: `group_${owner.username}`,
        description: `Test group managed by ${owner.name}`,
        visibility: i % 2 === 0 ? 'PUBLIC' : 'PRIVATE_VISIBLE',
        type: 'GENERAL',
        moderationPolicy: 'NO_MODERATION'
      }
    })
    
    await testPrisma.groupMember.create({
      data: {
        groupId: group.id,
        userId: owner.id,
        role: 'OWNER'
      }
    })
    
    groupsCreated++
  }
  
  console.log(`✅ Created ${groupsCreated} extended groups`)
}

