import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedFacets() {
  console.log('Starting facet seeding...');
  
  // Global admin facet
  await prisma.facet.upsert({
    where: {
      scope_name_value: {
        scope: 'reedi-admin',
        name: 'global',
        value: ''
      }
    },
    update: {},
    create: {
      scope: 'reedi-admin',
      name: 'global',
      value: '',
      description: 'Global administrator with full system access',
      requiresAudit: true,
      requiresReview: true,
      reviewDays: 90,
      hierarchyLevel: 100
    }
  });
  console.log('✓ Created reedi-admin:global facet');
  
  // Divisional admin facet
  await prisma.facet.upsert({
    where: {
      scope_name_value: {
        scope: 'reedi-admin',
        name: 'divisional',
        value: ''
      }
    },
    update: {},
    create: {
      scope: 'reedi-admin',
      name: 'divisional',
      value: '',
      description: 'Divisional administrator with access to division resources',
      requiresAudit: true,
      requiresReview: true,
      reviewDays: 90,
      hierarchyLevel: 50
    }
  });
  console.log('✓ Created reedi-admin:divisional facet');
  
  // Facet admin facet (meta-facet)
  await prisma.facet.upsert({
    where: {
      scope_name_value: {
        scope: 'reedi-facet-admin',
        name: 'global',
        value: ''
      }
    },
    update: {},
    create: {
      scope: 'reedi-facet-admin',
      name: 'global',
      value: '',
      description: 'Can assign and revoke any facet',
      requiresAudit: true,
      requiresReview: true,
      reviewDays: 30,
      hierarchyLevel: 100
    }
  });
  console.log('✓ Created reedi-facet-admin:global facet');
  
  // Feature access: locked posts
  await prisma.facet.upsert({
    where: {
      scope_name_value: {
        scope: 'feature-access',
        name: 'locked-posts',
        value: ''
      }
    },
    update: {},
    create: {
      scope: 'feature-access',
      name: 'locked-posts',
      value: '',
      description: 'Can create and manage locked/premium posts',
      requiresAudit: true,
      expiryDays: 365,
      hierarchyLevel: 10
    }
  });
  console.log('✓ Created feature-access:locked-posts facet');
  
  // User roles
  const roles = [
    { name: 'admin', description: 'User has admin role', level: 50 },
    { name: 'manager', description: 'User has manager role', level: 40 },
    { name: 'director', description: 'User has director role', level: 45 },
    { name: 'hr-admin', description: 'User has HR admin role', level: 35 },
    { name: 'moderator', description: 'User has moderator role', level: 30 }
  ];
  
  for (const role of roles) {
    await prisma.facet.upsert({
      where: {
        scope_name_value: {
          scope: 'user-role',
          name: role.name,
          value: ''
        }
      },
      update: {},
      create: {
        scope: 'user-role',
        name: role.name,
        value: '',
        description: role.description,
        requiresAudit: true,
        requiresReview: true,
        reviewDays: 180,
        hierarchyLevel: role.level
      }
    });
    console.log(`✓ Created user-role:${role.name} facet`);
  }
  
  // Example divisions (can be customized)
  const divisions = [
    'engineering',
    'sales',
    'marketing',
    'hr',
    'finance'
  ];
  
  for (const division of divisions) {
    await prisma.facet.upsert({
      where: {
        scope_name_value: {
          scope: 'org-division',
          name: 'division',
          value: division
        }
      },
      update: {},
      create: {
        scope: 'org-division',
        name: 'division',
        value: division,
        description: `User belongs to ${division} division`,
        requiresAudit: false,
        hierarchyLevel: 0
      }
    });
    console.log(`✓ Created org-division:division:${division} facet`);
  }
  
  // Example departments
  const departments = [
    'development',
    'design',
    'qa',
    'devops',
    'product',
    'customer-success',
    'accounting',
    'recruiting'
  ];
  
  for (const dept of departments) {
    await prisma.facet.upsert({
      where: {
        scope_name_value: {
          scope: 'org-department',
          name: 'department',
          value: dept
        }
      },
      update: {},
      create: {
        scope: 'org-department',
        name: 'department',
        value: dept,
        description: `User belongs to ${dept} department`,
        requiresAudit: false,
        hierarchyLevel: 0
      }
    });
    console.log(`✓ Created org-department:department:${dept} facet`);
  }
  
  console.log('Facet seeding completed successfully!');
}

// Run if executed directly
if (require.main === module) {
  seedFacets()
    .then(() => {
      console.log('Seeding complete');
      prisma.$disconnect();
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error seeding facets:', error);
      prisma.$disconnect();
      process.exit(1);
    });
}

