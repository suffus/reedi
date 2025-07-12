const fs = require('fs');
const path = require('path');

// Function to remove return statements before res.status().json() and res.json()
function removeReturnBeforeResJson(content) {
  // Handle multi-line return statements with res.status().json()
  content = content.replace(/return\s+res\.status\([^)]+\)\.json\([\s\S]*?\);/g, (match) => {
    return match.replace(/^return\s+/, '');
  });
  
  // Handle multi-line return statements with res.json()
  content = content.replace(/return\s+res\.json\([\s\S]*?\);/g, (match) => {
    return match.replace(/^return\s+/, '');
  });
  
  // Handle single-line patterns as backup
  content = content.replace(/return\s+(res\.status\([^;]+?\)\.json\([^;]+?\));/gs, '$1;');
  content = content.replace(/return\s+(res\.json\([^;]+?\));/gs, '$1;');
  
  return content;
}

// Files to fix
const files = [
  'src/routes/auth.ts',
  'src/routes/comments.ts', 
  'src/routes/galleries.ts',
  'src/routes/images.ts',
  'src/routes/posts.ts',
  'src/routes/search.ts',
  'src/routes/users.ts'
];

files.forEach(filePath => {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Apply the fix
    content = removeReturnBeforeResJson(content);
    
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed ${filePath}`);
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error.message);
  }
});

console.log('🎉 Express.js return statements fixed!'); 