require('dotenv').config()
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkJobs() {
  try {
    console.log('🔍 Checking media processing jobs...\n')

    // Get counts for each status
    const statusCounts = await prisma.mediaProcessingJob.groupBy({
      by: ['status'],
      _count: {
        id: true
      }
    })

    console.log('📊 Job Status Summary:')
    console.log('========================')
    
    let totalJobs = 0
    for (const status of statusCounts) {
      const count = status._count.id
      const statusName = status.status || 'NULL'
      console.log(`${statusName.padEnd(15)}: ${count} jobs`)
      totalJobs += count
    }
    
    console.log('========================')
    console.log(`Total Jobs: ${totalJobs}`)

    // Show recent jobs
    console.log('\n📋 Recent Jobs (last 10):')
    console.log('============================')

    const recentJobs = await prisma.mediaProcessingJob.findMany({
      select: {
        id: true,
        mediaId: true,
        userId: true,
        mediaType: true,
        status: true,
        progress: true,
        currentStep: true,
        createdAt: true,
        completedAt: true,
        originalFilename: true
      },
      take: 10,
      orderBy: {
        createdAt: 'desc'
      }
    })

    if (recentJobs.length === 0) {
      console.log('No jobs found')
    } else {
      recentJobs.forEach(job => {
        const filename = job.originalFilename || 'unnamed'
        const created = new Date(job.createdAt).toLocaleString()
        const completed = job.completedAt ? new Date(job.completedAt).toLocaleString() : 'N/A'
        console.log(`  - ${job.id}`)
        console.log(`    Media: ${job.mediaId} (${filename})`)
        console.log(`    Status: ${job.status} (${job.progress}%) - ${job.currentStep}`)
        console.log(`    Created: ${created}`)
        console.log(`    Completed: ${completed}`)
        console.log('')
      })
    }

    // Show jobs by media type
    console.log('\n📊 Jobs by Media Type:')
    console.log('=======================')
    
    const typeCounts = await prisma.mediaProcessingJob.groupBy({
      by: ['mediaType'],
      _count: {
        id: true
      }
    })

    for (const type of typeCounts) {
      const count = type._count.id
      const mediaType = type.mediaType || 'NULL'
      console.log(`${mediaType.padEnd(10)}: ${count} jobs`)
    }

  } catch (error) {
    console.error('❌ Script failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

console.log('🚀 Starting job status check...')
console.log(`📋 Configuration:`)
console.log(`   - Database: ${process.env['DATABASE_URL'] ? 'Connected' : 'Not configured'}`)
console.log('')

checkJobs() 