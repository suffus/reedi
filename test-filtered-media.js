const fetch = require('node-fetch')

async function testFilteredMediaAPI() {
  const baseUrl = 'http://localhost:8088'
  
  // You'll need to replace these with actual values from your system
  const userId = 'your-user-id' // Replace with actual user ID
  const token = 'your-token' // Replace with actual token
  
  console.log('Testing filtered media API...')
  
  // Test 1: Basic user media (no filters)
  try {
    const response1 = await fetch(`${baseUrl}/api/media/user/${userId}?page=1&limit=5`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    
    const data1 = await response1.json()
    console.log('✅ Basic user media:', data1.success ? 'Success' : 'Failed')
    console.log('   Media count:', data1.data?.media?.length || 0)
  } catch (error) {
    console.log('❌ Basic user media failed:', error.message)
  }
  
  // Test 2: Filter by tags
  try {
    const response2 = await fetch(`${baseUrl}/api/media/user/${userId}?page=1&limit=5&tags=test,photo`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    
    const data2 = await response2.json()
    console.log('✅ Filter by tags:', data2.success ? 'Success' : 'Failed')
    console.log('   Filtered media count:', data2.data?.media?.length || 0)
  } catch (error) {
    console.log('❌ Filter by tags failed:', error.message)
  }
  
  // Test 3: Filter by title
  try {
    const response3 = await fetch(`${baseUrl}/api/media/user/${userId}?page=1&limit=5&title=test`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    
    const data3 = await response3.json()
    console.log('✅ Filter by title:', data3.success ? 'Success' : 'Failed')
    console.log('   Title filtered count:', data3.data?.media?.length || 0)
  } catch (error) {
    console.log('❌ Filter by title failed:', error.message)
  }
  
  // Test 4: Filter by gallery
  try {
    const response4 = await fetch(`${baseUrl}/api/media/user/${userId}?page=1&limit=5&galleryId=test-gallery-id`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    
    const data4 = await response4.json()
    console.log('✅ Filter by gallery:', data4.success ? 'Success' : 'Failed')
    console.log('   Gallery filtered count:', data4.data?.media?.length || 0)
  } catch (error) {
    console.log('❌ Filter by gallery failed:', error.message)
  }
  
  // Test 5: Combined filters
  try {
    const response5 = await fetch(`${baseUrl}/api/media/user/${userId}?page=1&limit=5&tags=test&title=photo&mediaType=IMAGE`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    
    const data5 = await response5.json()
    console.log('✅ Combined filters:', data5.success ? 'Success' : 'Failed')
    console.log('   Combined filtered count:', data5.data?.media?.length || 0)
  } catch (error) {
    console.log('❌ Combined filters failed:', error.message)
  }
}

testFilteredMediaAPI().catch(console.error) 