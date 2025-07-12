const fs = require('fs');
const path = require('path');

// Function to add missing imports
function addMissingImports(content, filePath) {
  if (content.includes('Request') || content.includes('Response')) {
    if (!content.includes("import { Router, Request, Response } from 'express'") && 
        !content.includes("import { Request, Response } from 'express'")) {
      content = content.replace(
        "import { Router } from 'express'",
        "import { Router, Request, Response } from 'express'"
      );
    }
  }
  return content;
}

// Function to add missing type annotations without explicit return types
function addMissingTypeAnnotations(content) {
  // Fix request/response parameters without types
  content = content.replace(
    /asyncHandler\(async \(req, res\) => {/g,
    'asyncHandler(async (req: Request, res: Response) => {'
  );
  
  content = content.replace(
    /asyncHandler\(async \(req: AuthenticatedRequest, res\) => {/g,
    'asyncHandler(async (req: AuthenticatedRequest, res: Response) => {'
  );
  
  return content;
}

// Function to remove explicit ': void' and ': Promise<void>' return types from async handler functions
function removeExplicitVoidReturnTypes(content) {
  // Remove ': void' and ': Promise<void>' from async handler functions
  content = content.replace(/: void\s*=>/g, ' =>');
  content = content.replace(/: Promise<void>\s*=>/g, ' =>');
  return content;
}

// Function to ensure all res.status(...).json(...) and res.json(...) are followed by 'return;'
function ensureReturnAfterResponse(content) {
  // Add 'return;' after res.status(...).json(...) if not already followed by return or response
  content = content.replace(/(res\.status\([^;]+?\)\.json\([^;]+?\));(?!\s*return|\s*res\.|\s*await|\s*\/\/)/gs, '$1; return;');
  // Add 'return;' after res.json(...) if not already followed by return or response
  content = content.replace(/(res\.json\([^;]+?\));(?!\s*return|\s*res\.|\s*await|\s*\/\/)/gs, '$1; return;');
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
    
    // Apply fixes
    content = addMissingImports(content, filePath);
    content = addMissingTypeAnnotations(content);
    content = removeExplicitVoidReturnTypes(content);
    content = ensureReturnAfterResponse(content);
    
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed ${filePath}`);
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error.message);
  }
});

console.log('🎉 TypeScript fixes applied!'); 