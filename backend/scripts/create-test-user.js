#!/usr/bin/env node
/**
 * Create Test User for Simulation
 * 
 * This script creates a test user in Firebase Auth and Firestore for testing purposes.
 * 
 * Usage: node backend/scripts/create-test-user.js [email]
 * Example: node backend/scripts/create-test-user.js test@specifys-ai.com
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Initialize Firebase Admin
const { db, auth } = require('../server/firebase-admin');

async function createTestUser(email) {
    try {
        console.log('🚀 Creating test user...');
        console.log('📧 Email:', email);
        
        // Create user in Firebase Auth
        const userRecord = await auth.createUser({
            email: email,
            displayName: 'Test User',
            emailVerified: true
        });
        
        console.log('✅ User created in Auth:', userRecord.uid);
        
        // Create user document in Firestore
        await db.collection('users').doc(userRecord.uid).set({
            email: email,
            displayName: 'Test User',
            emailVerified: true,
            plan: 'free',
            free_specs_remaining: 1,
            lemon_customer_id: null,
            last_entitlement_sync_at: new Date()
        });
        
        console.log('✅ User document created in Firestore');
        
        // Create entitlements document
        await db.collection('entitlements').doc(userRecord.uid).set({
            userId: userRecord.uid,
            spec_credits: 0,
            unlimited: false,
            can_edit: false,
            updated_at: new Date()
        });
        
        console.log('✅ Entitlements document created');
        
        console.log('');
        console.log('🎉 Test user created successfully!');
        console.log('User ID:', userRecord.uid);
        console.log('');
        console.log('Now run: node scripts/simulate-purchase-flow.js single_spec', userRecord.uid, email);
        
        return userRecord.uid;
        
    } catch (error) {
        console.error('❌ Error creating test user:', error);
        process.exit(1);
    }
}

// Main execution
const email = process.argv[2] || 'test@specifys-ai.com';
createTestUser(email).then(() => {
    process.exit(0);
});

