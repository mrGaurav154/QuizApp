#!/usr/bin/env node

/**
 * Render Deployment Health Check
 * Run this script to diagnose issues with the Render deployment
 * Usage: node check-render-health.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const checks = {
    passed: [],
    failed: [],
    warnings: []
};

async function checkEnvironmentVariables() {
    console.log('\n📋 Checking Environment Variables...');
    
    const required = ['MONGODB_URI', 'SESSION_SECRET', 'NODE_ENV'];
    
    for (const env of required) {
        if (!process.env[env]) {
            checks.failed.push(`❌ Missing: ${env}`);
        } else {
            // Don't log sensitive values
            if (env === 'MONGODB_URI') {
                checks.passed.push(`✅ ${env}: ${process.env[env].substring(0, 30)}...`);
            } else {
                checks.passed.push(`✅ ${env} is set`);
            }
        }
    }
}

async function checkDatabaseConnection() {
    console.log('\n🗄️  Checking Database Connection...');
    
    if (!process.env.MONGODB_URI) {
        checks.failed.push('❌ Cannot check database - MONGODB_URI not set');
        return;
    }
    
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000
        });
        
        checks.passed.push(`✅ MongoDB connected: ${conn.connection.host}`);
        
        // Check collections
        const collections = await mongoose.connection.db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        
        checks.passed.push(`✅ Collections found: ${collectionNames.join(', ')}`);
        
        // Check if categories exist
        const Category = require('./server/models/Category');
        const categoryCount = await Category.countDocuments();
        
        if (categoryCount === 0) {
            checks.warnings.push(`⚠️  No categories found! Run: node seed-categories.js`);
        } else {
            checks.passed.push(`✅ ${categoryCount} categories found in database`);
        }
        
        // Check users
        const User = require('./server/models/User');
        const userCount = await User.countDocuments();
        checks.passed.push(`✅ ${userCount} users found in database`);
        
        await mongoose.connection.close();
        
    } catch (error) {
        checks.failed.push(`❌ Database connection failed: ${error.message}`);
        console.error('   Error details:', error);
    }
}

async function checkNodeVersion() {
    console.log('\n📦 Checking Node Version...');
    
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
    
    if (majorVersion >= 14) {
        checks.passed.push(`✅ Node version: ${nodeVersion}`);
    } else {
        checks.warnings.push(`⚠️  Node version ${nodeVersion} is older than recommended (14+)`);
    }
}

function checkPortConfiguration() {
    console.log('\n🔌 Checking Port Configuration...');
    
    const port = process.env.PORT || 3000;
    
    if (port === '3000') {
        checks.warnings.push(`⚠️  PORT is set to 3000 (development default)`);
    } else {
        checks.passed.push(`✅ PORT configured: ${port}`);
    }
}

function checkCORSConfiguration() {
    console.log('\n🔐 Checking CORS Configuration...');
    
    const clientUrl = process.env.CLIENT_URL;
    const baseUrl = process.env.BASE_URL;
    
    if (!clientUrl) {
        checks.warnings.push(`⚠️  CLIENT_URL not set - CORS may have issues`);
    } else {
        checks.passed.push(`✅ CLIENT_URL set: ${clientUrl}`);
    }
    
    if (!baseUrl) {
        checks.warnings.push(`⚠️  BASE_URL not set - quiz join links may be incorrect`);
    } else {
        checks.passed.push(`✅ BASE_URL set: ${baseUrl}`);
    }
}

function checkSessionConfiguration() {
    console.log('\n🔑 Checking Session Configuration...');
    
    const sessionSecret = process.env.SESSION_SECRET;
    
    if (!sessionSecret) {
        checks.failed.push(`❌ SESSION_SECRET not set`);
    } else if (sessionSecret.includes('default') || sessionSecret.length < 10) {
        checks.warnings.push(`⚠️  SESSION_SECRET appears to be default or too short`);
    } else {
        checks.passed.push(`✅ SESSION_SECRET is set and appears secure`);
    }
}

function printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('HEALTH CHECK SUMMARY');
    console.log('='.repeat(60));
    
    if (checks.passed.length > 0) {
        console.log('\n✅ PASSED:');
        checks.passed.forEach(p => console.log('   ' + p));
    }
    
    if (checks.warnings.length > 0) {
        console.log('\n⚠️  WARNINGS:');
        checks.warnings.forEach(w => console.log('   ' + w));
    }
    
    if (checks.failed.length > 0) {
        console.log('\n❌ FAILED:');
        checks.failed.forEach(f => console.log('   ' + f));
    }
    
    console.log('\n' + '='.repeat(60));
    
    if (checks.failed.length === 0) {
        console.log('✅ All critical checks passed!');
        console.log('\nNext steps if having issues:');
        console.log('1. Check Render logs in the dashboard');
        console.log('2. Verify environment variables are correctly set');
        console.log('3. Make sure categories are seeded: node seed-categories.js');
        console.log('4. Restart your Render service');
    } else {
        console.log('❌ Critical issues found! Please fix them before deploying.');
    }
    
    console.log('='.repeat(60) + '\n');
}

async function runChecks() {
    console.log('\n🚀 Running Render Deployment Health Checks...\n');
    
    checkEnvironmentVariables();
    checkNodeVersion();
    checkPortConfiguration();
    checkCORSConfiguration();
    checkSessionConfiguration();
    
    await checkDatabaseConnection();
    
    printSummary();
    
    process.exit(checks.failed.length > 0 ? 1 : 0);
}

runChecks().catch(error => {
    console.error('Health check failed:', error);
    process.exit(1);
});
