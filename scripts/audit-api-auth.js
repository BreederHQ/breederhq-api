#!/usr/bin/env node
// scripts/audit-api-auth.js
// Quick audit script to check which routes have auth protection

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const routesDir = path.join(__dirname, '../src/routes');

const publicRoutes = [];
const protectedRoutes = [];
const unclearRoutes = [];
const marketplaceRoutes = [];

console.log('🔍 Auditing API routes for authentication...\n');

const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.ts') || f.endsWith('.js'));

files.forEach(file => {
  const filePath = path.join(routesDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');

  // Check for auth indicators
  const hasRequireAuth = content.match(/requireAuth|requireAuthentication|requireMarketplaceAuth/g);
  const hasPreHandler = content.match(/preHandler.*auth/gi);
  const hasMarketplaceEntitlement = content.match(/requireMarketplaceEntitlement/g);
  const hasSessionCheck = content.match(/parseVerifiedSession|getActorId|req\.userId/g);
  const hasPublicComment = content.match(/no auth required|public endpoint|anonymous access/gi);
  const hasAuthComment = content.match(/auth required|authentication required|requires auth|requires session|requires valid/gi);

  const authIndicators = (hasRequireAuth?.length || 0) +
                        (hasPreHandler?.length || 0) +
                        (hasMarketplaceEntitlement?.length || 0) +
                        (hasSessionCheck?.length || 0);

  const info = {
    file,
    authIndicators,
    hasPublicComment: !!hasPublicComment,
    hasAuthComment: !!hasAuthComment,
  };

  // Categorize
  if (file.startsWith('marketplace-')) {
    marketplaceRoutes.push(info);
  }

  if (hasPublicComment && authIndicators === 0) {
    publicRoutes.push(info);
  } else if (authIndicators > 0) {
    protectedRoutes.push(info);
  } else {
    unclearRoutes.push(info);
  }
});

// Sort marketplace routes by name
marketplaceRoutes.sort((a, b) => a.file.localeCompare(b.file));

console.log('=' .repeat(80));
console.log('📂 MARKETPLACE ROUTES (need special attention)');
console.log('='.repeat(80));
marketplaceRoutes.forEach(({ file, authIndicators, hasPublicComment, hasAuthComment }) => {
  const status = authIndicators > 0 ? '🔒 PROTECTED' :
                hasPublicComment ? '✅ PUBLIC' :
                '⚠️  UNCLEAR';

  console.log(`${status.padEnd(15)} ${file.padEnd(50)} (${authIndicators} auth checks)`);

  if (hasPublicComment && authIndicators > 0) {
    console.log(`           ⚠️  WARNING: Says "public" but has auth middleware!`);
  }
});

console.log('\n' + '='.repeat(80));
console.log('✅ PUBLIC ROUTES (no auth required)');
console.log('='.repeat(80));
if (publicRoutes.length === 0) {
  console.log('   (none found)');
} else {
  publicRoutes.forEach(({ file }) => {
    if (!file.startsWith('marketplace-')) {
      console.log(`   ✅ ${file}`);
    }
  });
}

console.log('\n' + '='.repeat(80));
console.log('🔒 PROTECTED ROUTES (auth required)');
console.log('='.repeat(80));
const nonMarketplaceProtected = protectedRoutes.filter(r => !r.file.startsWith('marketplace-'));
if (nonMarketplaceProtected.length === 0) {
  console.log('   (none found outside marketplace)');
} else {
  nonMarketplaceProtected.forEach(({ file, authIndicators }) => {
    console.log(`   🔒 ${file.padEnd(50)} (${authIndicators} auth checks)`);
  });
}

console.log('\n' + '='.repeat(80));
console.log('⚠️  UNCLEAR ROUTES (no auth indicators or comments)');
console.log('='.repeat(80));
const nonMarketplaceUnclear = unclearRoutes.filter(r => !r.file.startsWith('marketplace-'));
if (nonMarketplaceUnclear.length === 0) {
  console.log('   (none found)');
} else {
  nonMarketplaceUnclear.forEach(({ file }) => {
    console.log(`   ⚠️  ${file} - Review manually`);
  });
}

console.log('\n' + '='.repeat(80));
console.log('📊 SUMMARY');
console.log('='.repeat(80));
console.log(`Total routes:              ${files.length}`);
console.log(`Marketplace routes:        ${marketplaceRoutes.length}`);
console.log(`Public routes:             ${publicRoutes.length}`);
console.log(`Protected routes:          ${protectedRoutes.length}`);
console.log(`Unclear routes:            ${unclearRoutes.length}`);

console.log('\n' + '='.repeat(80));
console.log('🚨 ACTION ITEMS');
console.log('='.repeat(80));

// Find potential issues
const issuesFound = [];

marketplaceRoutes.forEach(({ file, authIndicators, hasPublicComment }) => {
  if (file.includes('public') && authIndicators > 0) {
    issuesFound.push(`⚠️  ${file} - Says "public" but requires auth`);
  }
  if (file.includes('saved') && authIndicators === 0) {
    issuesFound.push(`🚨 ${file} - Saved listings MUST require auth`);
  }
  if (file.includes('message') && authIndicators === 0) {
    issuesFound.push(`🚨 ${file} - Messages MUST require auth`);
  }
  if (file.includes('waitlist') && authIndicators === 0) {
    issuesFound.push(`🚨 ${file} - Waitlist MUST require auth`);
  }
  if (file.includes('notification') && authIndicators === 0) {
    issuesFound.push(`🚨 ${file} - Notifications MUST require auth`);
  }
  if (file.includes('profile') && authIndicators === 0) {
    issuesFound.push(`🚨 ${file} - Profile MUST require auth`);
  }
  if (file.includes('breeder') && authIndicators === 0 && !hasPublicComment) {
    issuesFound.push(`❓ ${file} - Unclear if public breeder browse or needs auth`);
  }
});

if (issuesFound.length === 0) {
  console.log('✅ No critical issues found!');
} else {
  issuesFound.forEach(issue => console.log(issue));
}

console.log('\n👉 Next steps:');
console.log('   1. Review unclear routes manually');
console.log('   2. Check public-marketplace.ts - should it require auth?');
console.log('   3. Ensure all user-specific routes (saved, messages, etc.) require auth');
console.log('   4. Run integration tests to verify auth enforcement');
console.log('\n📖 See API-SECURITY-AUDIT.md for detailed guidelines\n');
