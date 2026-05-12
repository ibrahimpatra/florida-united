/**
 * Florida United Company - Database Seed Script
 * Run: node scripts/seed.js
 * 
 * Requires FIREBASE_* env vars set in .env.local
 */
require('dotenv').config({ path: '.env.local' });
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});
const db = getFirestore(app);

async function seed() {
  console.log('🌱 Seeding Florida United Company database...\n');

  // Categories
  console.log('📂 Creating categories...');
  const categories = [
    { name:'Electrical Supplies', slug:'electrical', description:'Circuit breakers, wiring, panels, switches and all electrical components', icon:'⚡', isActive:true, sortOrder:1, metaTitle:'Electrical Supplies Florida | Florida United Company', metaDesc:'Shop electrical supplies, circuit breakers, wiring and panels.' },
    { name:'Hardware & Tools', slug:'hardware', description:'Hand tools, power tools, fasteners, and general hardware', icon:'🔧', isActive:true, sortOrder:2 },
    { name:'Safety Equipment', slug:'safety', description:'PPE, fire safety, first aid, and workplace safety products', icon:'🦺', isActive:true, sortOrder:3 },
    { name:'Lighting', slug:'lighting', description:'LED fixtures, emergency lighting, exit signs, and bulbs', icon:'💡', isActive:true, sortOrder:4 },
    { name:'Plumbing', slug:'plumbing', description:'Pipes, fittings, valves, faucets and plumbing supplies', icon:'🚿', isActive:true, sortOrder:5 },
    { name:'Industrial', slug:'industrial', description:'Motors, drives, pneumatics, bearings and industrial equipment', icon:'🏗', isActive:true, sortOrder:6 },
    { name:'Fasteners', slug:'fasteners', description:'Bolts, screws, nuts, anchors and all fastening solutions', icon:'🔩', isActive:true, sortOrder:7 },
    { name:'Conduit & Fittings', slug:'conduit', description:'EMT, rigid conduit, PVC conduit and all fittings', icon:'🔌', isActive:true, sortOrder:8 },
  ];
  const catRefs = {};
  for (const cat of categories) {
    const ref = await db.collection('categories').add({ ...cat, productCount:0, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() });
    catRefs[cat.slug] = ref.id;
    console.log(`  ✅ ${cat.name} (${ref.id})`);
  }

  // Products
  console.log('\n📦 Creating products...');
  const products = [
    { name:'20A Single Pole Circuit Breaker', slug:'20a-single-pole-circuit-breaker', sku:'CB-SP-20A-001', categoryId:catRefs['electrical'], categoryName:'Electrical Supplies', brand:'Siemens', price:8.99, comparePrice:12.99, stock:250, lowStockAlert:20, description:'UL Listed 20-Amp single-pole circuit breaker for Siemens EQ and ITE load centers. Provides overload and short-circuit protection.', shortDescription:'20A single-pole breaker, UL listed, compatible with Siemens panels', images:['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400'], tags:['circuit breaker','siemens','20amp','electrical'], isFeatured:true, isNewArrival:false, isOnSale:true, isActive:true, isReturnable:true, returnDays:30, weight:0.5, metaTitle:'20A Single Pole Circuit Breaker | Florida United Company', avgRating:4.8, totalReviews:124, totalSold:892 },
    { name:'12/2 NM-B Romex Wire 250ft', slug:'12-2-nm-b-romex-wire-250ft', sku:'WR-12-2-250', categoryId:catRefs['electrical'], categoryName:'Electrical Supplies', brand:'Southwire', price:89.99, comparePrice:109.99, stock:85, lowStockAlert:10, description:'12/2 NM-B (Romex) non-metallic sheathed cable with ground, 250ft coil. For use in dry locations.', shortDescription:'12/2 Romex 250ft - UL Listed, with ground wire', images:['https://images.unsplash.com/photo-1621905251189-08b45249e04c?w=400'], tags:['wire','romex','12-2','southwire','electrical cable'], isFeatured:true, isNewArrival:true, isOnSale:false, isActive:true, isReturnable:true, returnDays:30, weight:8.5, avgRating:4.9, totalReviews:67, totalSold:445 },
    { name:'Klein Tools 11-in-1 Screwdriver', slug:'klein-tools-11-in-1-screwdriver', sku:'KT-32500', categoryId:catRefs['hardware'], categoryName:'Hardware & Tools', brand:'Klein Tools', price:24.99, comparePrice:29.99, stock:180, lowStockAlert:15, description:'Multi-bit screwdriver/nut driver with 11 functions. Features four Phillips, four slotted, and three nut driver sizes.', shortDescription:'11-function multi-bit screwdriver with cushion-grip handle', images:['https://images.unsplash.com/photo-1504148455328-c376907d081c?w=400'], tags:['screwdriver','klein tools','hand tools','multi-bit'], isFeatured:true, isNewArrival:false, isOnSale:false, isActive:true, isReturnable:true, returnDays:30, weight:0.8, avgRating:4.9, totalReviews:203, totalSold:1247 },
    { name:'3M Hard Hat Class E Yellow', slug:'3m-hard-hat-class-e-yellow', sku:'HH-3M-E-YLW', categoryId:catRefs['safety'], categoryName:'Safety Equipment', brand:'3M', price:19.99, comparePrice:null, stock:320, lowStockAlert:30, description:'ANSI/ISEA Z89.1-2014 Type I, Class E hard hat. Protects against impact, penetration, and electrical hazards up to 20,000 volts.', shortDescription:'ANSI Class E hard hat, 6-point suspension, adjustable', images:['https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=400'], tags:['hard hat','ppe','safety','3m','helmet'], isFeatured:false, isNewArrival:false, isOnSale:false, isActive:true, isReturnable:true, returnDays:30, weight:0.9, avgRating:4.7, totalReviews:89, totalSold:567 },
    { name:'4ft LED Shop Light 5000K 50W', slug:'4ft-led-shop-light-5000k-50w', sku:'LED-SHP-4FT-50W', categoryId:catRefs['lighting'], categoryName:'Lighting', brand:'Commercial Electric', price:34.99, comparePrice:49.99, stock:145, lowStockAlert:12, description:'50W LED shop light, 5000K daylight, 5000 lumens. Linkable design, plug-in or hardwire. Energy Star certified.', shortDescription:'50W 4ft LED shop light, 5000 lumens, linkable, Energy Star', images:['https://images.unsplash.com/photo-1565138163631-4d3ca2d8e1f1?w=400'], tags:['led','shop light','lighting','4ft','energy star'], isFeatured:true, isNewArrival:true, isOnSale:true, isActive:true, isReturnable:true, returnDays:30, weight:3.2, avgRating:4.6, totalReviews:156, totalSold:834 },
    { name:'Milwaukee M18 Fuel Drill/Driver', slug:'milwaukee-m18-fuel-drill-driver', sku:'MW-2903-20', categoryId:catRefs['hardware'], categoryName:'Hardware & Tools', brand:'Milwaukee', price:149.00, comparePrice:179.00, stock:42, lowStockAlert:5, description:"Milwaukee M18 FUEL 1/2\" Drill/Driver with POWERSTATE Brushless Motor, REDLINK PLUS Intelligence and REDLITHIUM battery technology.", shortDescription:"M18 FUEL 1/2\" brushless drill/driver - bare tool (tool only)", images:['https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=400'], tags:['drill','milwaukee','m18','power tools','cordless'], isFeatured:true, isNewArrival:false, isOnSale:true, isActive:true, isReturnable:true, returnDays:30, weight:3.1, avgRating:4.9, totalReviews:312, totalSold:678 },
    { name:'1/2" EMT Conduit 10ft', slug:'half-inch-emt-conduit-10ft', sku:'EMT-05-10FT', categoryId:catRefs['conduit'], categoryName:'Conduit & Fittings', brand:'Allied Tube', price:6.49, comparePrice:null, stock:500, lowStockAlert:50, description:'1/2-inch EMT electrical metallic tubing, 10-foot length. Hot-dip galvanized for corrosion resistance. UL listed.', shortDescription:'1/2" EMT conduit 10ft - galvanized, UL listed', images:['https://images.unsplash.com/photo-1565891741441-64926e3e74fd?w=400'], tags:['conduit','emt','1/2 inch','electrical','metallic'], isFeatured:false, isNewArrival:false, isOnSale:false, isActive:true, isReturnable:true, returnDays:30, weight:2.1, avgRating:4.8, totalReviews:44, totalSold:2341 },
    { name:'Fluke 323 True-RMS Clamp Meter', slug:'fluke-323-true-rms-clamp-meter', sku:'FL-323', categoryId:catRefs['electrical'], categoryName:'Electrical Supplies', brand:'Fluke', price:89.99, comparePrice:119.99, stock:38, lowStockAlert:5, description:'Fluke 323 True-RMS Clamp Meter measures AC current to 400A and AC/DC voltage to 600V. CAT III 600V safety rating.', shortDescription:'400A True-RMS clamp meter, CAT III 600V rated', images:['https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=400'], tags:['fluke','clamp meter','multimeter','electrical test','measurement'], isFeatured:true, isNewArrival:false, isOnSale:false, isActive:true, isReturnable:true, returnDays:30, weight:0.7, avgRating:4.9, totalReviews:178, totalSold:423 },
  ];

  for (const product of products) {
    const ref = await db.collection('products').add({ ...product, variants:[], createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() });
    console.log(`  ✅ ${product.name} - $${product.price}`);
  }

  // Shipping Config
  console.log('\n🚚 Creating shipping config...');
  await db.collection('settings').doc('shipping').set({
    storeLat:25.7617, storeLng:-80.1918, storeAddress:'123 Commerce Blvd, Miami, FL 33101',
    defaultFreeShippingThreshold:99, defaultTaxRate:7, handlingFee:0,
    localPickupEnabled:true, localPickupAddress:'123 Commerce Blvd, Miami, FL 33101',
    localPickupInstructions:'Available Mon-Fri 8AM-6PM, Sat 9AM-4PM. Bring your order number.',
    createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(),
  });

  // Shipping Zones
  console.log('\n📍 Creating shipping zones...');
  const zones = [
    { name:'Miami-Dade Metro', type:'radius', centerLat:25.7617, centerLng:-80.1918, radiusMiles:30, isActive:true, sortOrder:1, description:'Miami-Dade county and surroundings within 30 miles',
      rates:[
        { id:'mia-std', name:'Standard Delivery', method:'flat', carrier:'UPS', estimatedDays:'1-2', isActive:true, basePrice:4.99, freeAboveAmount:49, badge:'LOCAL' },
        { id:'mia-exp', name:'Express Delivery', method:'flat', carrier:'UPS', estimatedDays:'Same Day', isActive:true, basePrice:14.99, badge:'FAST' },
      ]},
    { name:'South Florida', type:'zipcode', isActive:true, sortOrder:2, description:'Broward, Palm Beach counties',
      zipcodes:['33004','33009','33060','33064','33066','33071','33073','33076','33301','33304','33306','33308','33309','33310','33311','33312','33314','33315','33316','33317','33319','33321','33322','33324','33325','33326','33328','33330','33331','33334'],
      rates:[
        { id:'sfl-std', name:'Standard Shipping', method:'flat', carrier:'UPS', estimatedDays:'2-3', isActive:true, basePrice:7.99, freeAboveAmount:79, badge:'' },
        { id:'sfl-exp', name:'2-Day Express', method:'flat', carrier:'FedEx', estimatedDays:'2', isActive:true, basePrice:19.99 },
      ]},
    { name:'Florida Statewide', type:'state', states:['FL'], isActive:true, sortOrder:3,
      rates:[
        { id:'fl-std', name:'Standard Shipping', method:'flat', carrier:'UPS', estimatedDays:'2-4', isActive:true, basePrice:9.99, freeAboveAmount:99 },
        { id:'fl-exp', name:'2-Day Express', method:'flat', carrier:'FedEx', estimatedDays:'2', isActive:true, basePrice:24.99 },
        { id:'fl-ovnt', name:'Overnight', method:'flat', carrier:'FedEx', estimatedDays:'1', isActive:true, basePrice:49.99, badge:'FAST' },
      ]},
    { name:'Continental US', type:'country', countries:['US'], isActive:true, sortOrder:4,
      rates:[
        { id:'us-std', name:'Standard Shipping', method:'flat', carrier:'UPS', estimatedDays:'5-7', isActive:true, basePrice:12.99, freeAboveAmount:149 },
        { id:'us-exp', name:'Express Shipping', method:'flat', carrier:'FedEx', estimatedDays:'2-3', isActive:true, basePrice:29.99 },
      ]},
  ];
  for (const zone of zones) {
    await db.collection('shippingZones').add({ ...zone, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() });
    console.log(`  ✅ ${zone.name}`);
  }

  // Sample Flash Deal
  console.log('\n⚡ Creating sample flash deal...');
  await db.collection('flashDeals').add({
    title:'Summer Electrical Sale', subtitle:'Stock up before the heat!', badgeText:'FLASH SALE',
    type:'percentage', discountValue:25, scope:'category', categoryIds:[catRefs['electrical']],
    startAt:new Date().toISOString(), endAt:new Date(Date.now()+86400000*3).toISOString(),
    bannerColor:'#1a56db', showCountdown:true, showOnHomepage:true, showOnProductPage:true,
    isActive:true, isPinned:true, usedCount:0, maxUsesTotal:null,
    createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(),
  });
  console.log('  ✅ Summer Electrical Sale (25% off)');

  // Sample Coupon
  console.log('\n🎟 Creating sample coupon...');
  await db.collection('coupons').add({
    code:'WELCOME10', type:'percentage', value:10, minOrderAmount:0, maxDiscount:50,
    usageLimit:null, usedCount:0, isActive:true, expiresAt:null,
    createdAt:new Date().toISOString(),
  });
  console.log('  ✅ WELCOME10 (10% off first order)');

  // Banner
  console.log('\n🖼 Creating sample banner...');
  await db.collection('banners').add({
    title:'Professional Electrical Supplies', subtitle:'Trusted by Florida Contractors Since 2005',
    image:'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200',
    link:'/shop/electrical', buttonText:'Shop Electrical', isActive:true, sortOrder:1,
    createdAt:new Date().toISOString(),
  });

  console.log('\n✅ Seed complete! Your database is ready.\n');
  console.log('👤 Next: Create an admin user by registering at /auth/register');
  console.log('   Then update their role to "admin" in Firestore console\n');
  process.exit(0);
}

seed().catch(e => { console.error('Seed failed:', e); process.exit(1); });
