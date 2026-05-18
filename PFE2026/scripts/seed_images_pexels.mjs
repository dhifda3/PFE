import pg from 'pg';

const PEXELS_API_KEY = 'L2uIDJTx3wSCwIihZLDhfvfWMkx8bXpuZBqPggpyCZMsNSOWddfGmPJ3';
const DB_URL = 'postgresql://postgres:admin@localhost:5432/cosmetica_db';

const client = new pg.Client({ connectionString: DB_URL });

// Category → search query mapping
const categoryQueries = {
  serum:    'face serum dropper bottle skincare',
  cream:    'face cream moisturizer jar skincare',
  mask:     'clay face mask skincare jar',
  cleanser: 'facial cleanser foam wash bottle',
  toner:    'toner skincare bottle spray',
  sunscreen:'sunscreen spf lotion bottle',
  shampoo:  'shampoo bottle hair care',
  hairmask: 'hair mask conditioner jar',
  hairoil:  'argan hair oil bottle',
  bodylotion:'body lotion moisturizer bottle',
  bodyscrub: 'body scrub exfoliant jar',
  essentialoil: 'essential oil dropper bottle',
  soap:     'natural organic soap bar',
  lipbalm:  'lip balm tube chapstick',
  eyecream: 'eye cream skincare tube',
  nightcream:'night cream jar skincare',
  glove:    'exfoliating bath glove spa',
  rosewater:'rose water spray bottle',
  bodybutter:'body butter shea cream jar',
};

// Product ID → category mapping
const productCategories = {
  // Serums
  'c7032bc0-892e-4151-b1be-448730f586bb': 'serum',   // Calming Centella Serum
  '56a4ee97-ad7d-4f75-b2c9-8bbc87b56bd4': 'serum',   // Hyaluronic Acid Serum
  '11690bde-72fa-41af-bd49-f08daa9036cd': 'serum',   // Niacinamide Pore Serum
  '1f47cd0b-4719-4696-9c05-7199d8050f2a': 'serum',   // Retinol Anti-Age Serum
  'bfd409cf-5d51-4ecc-b0f9-375cdffa82c8': 'serum',   // Vitamin C Brightening Serum
  '40f0c6e5-a310-47e8-86b1-b24814d5abc7': 'serum',   // Scalp Soothing Serum
  '009d5b1f-9e5a-49cd-8eaa-f7d50b1def13': 'serum',   // Frizz Control Hair Serum
  'prod-004': 'serum',   // Prickly Pear Anti-Age Serum
  'prod-013': 'serum',   // Vitamin C Radiance Serum
  'prod_001': 'serum',   // Hyaluronic Hydrating Serum

  // Face Creams
  '8b192930-1d4d-446a-b863-80b54d24f182': 'cream',   // Hydra-Boost Day Cream
  '4bdb0692-eed5-422e-bf6a-7a55e8c04cc0': 'cream',   // Oil-Free Gel Moisturizer
  'ac785571-39eb-477c-be35-77ebb6cf0faa': 'cream',   // Repair Night Cream
  '68d656bb-e45e-49a6-80e3-72f96ec6c445': 'cream',   // Soothing Barrier Cream
  '8d523ca2-8dd5-4bc2-9d0b-534e893693fc': 'eyecream',// Peptide Eye Cream
  'prod-001': 'cream',   // Argan Hydrating Face Cream
  'prod-014': 'cream',   // Prickly Pear Anti-Aging Cream
  'prod-019': 'cream',   // Fig Repair Hand Cream
  'prod_002': 'cream',   // Brightening Vitamin C Day Cream
  'prod_005': 'nightcream', // Anti-Aging Retinol Night Cream

  // Masks
  '59663324-415a-40c3-92a8-57a127fc6cf6': 'mask',    // Brightening Glow Mask
  'a5d1a885-b3c2-4894-bd6a-821eb243acf6': 'mask',    // Hydrating Sleeping Mask
  'b877ce49-92d9-42df-93cc-3e0e595d511d': 'mask',    // Kaolin Clay Purifying Mask
  'prod-003': 'mask',    // Green Clay Purifying Mask
  'prod-018': 'mask',    // Rhassoul Purifying Clay Mask
  'de425223-7eef-4b36-bce4-47efbd67f1cb': 'hairmask',// Scalp Detox Hair Mask
  'dadac86a-d136-4bbd-9109-c08c610bf827': 'hairmask',// Intensive Repair Hair Mask
  'prod-008': 'hairmask',// Strengthening Hair Mask

  // Cleansers
  '33aedac9-d14c-4ff7-a84e-aa2ae132fd1d': 'cleanser',// Gentle Foam Cleanser
  '1cd52ae9-4922-4b15-a7f1-2e05cb030881': 'cleanser',// Purifying Gel Cleanser
  'prod-002': 'cleanser',// Rose Water Cleansing Gel
  'prod_003': 'cleanser',// Gentle Foam Cleanser Classic

  // Toners
  '1fb7d267-3b12-488c-a618-6eb747c4102b': 'toner',   // AHA BHA Toner
  '85e4e72f-25f3-49dc-92ff-0a1f67e6d723': 'toner',   // Balancing Micellar Water
  '55de4d62-9590-44fc-8cb6-762f02eb8bec': 'toner',   // Hydrating Rose Toner
  'prod-021': 'toner',   // Chamomile Soothing Toner
  'prod-023': 'toner',   // Lemon Purifying Toner
  'prod_006': 'toner',   // Pore Balancing Toner

  // Sunscreens
  '60655e51-8ea0-4851-bebf-c1aee4d2e7df': 'sunscreen',// Daily SPF 50
  '3351f2a7-dfcc-4224-8815-aaa48144ab46': 'sunscreen',// Matte SPF 50
  'prod-009': 'sunscreen',// SPF50 Face Sunscreen
  'prod-025': 'sunscreen',// SPF30 Body Sunscreen
  'prod_004': 'sunscreen',// SPF50 Sunscreen Fluid

  // Shampoos
  '46fda68f-e97d-48e9-ad17-1d0a2c209aff': 'shampoo', // Curl Define Shampoo
  'd96dca64-af15-4523-9f96-bbb91f67ae3b': 'shampoo', // Moisture Repair Shampoo
  '561c119f-9275-4461-8764-98cb2808af98': 'shampoo', // Purifying Scalp Shampoo
  'd240ef92-9523-408b-8fb4-952ed0ebd4bf': 'shampoo', // Volume Boost Shampoo
  'prod-007': 'shampoo', // Argan Repair Shampoo
  'prod-022': 'shampoo', // Black Seed Strengthening Shampoo

  // Conditioners
  '7fb7ac4a-12a2-4278-ac30-ba92c0d8a8a4': 'hairmask', // Argan Repair Conditioner
  'd061c370-116d-4db5-821c-30b95e34353d': 'hairmask', // Lightweight Curl Conditioner

  // Hair Oils
  'prod-015': 'hairoil', // Black Seed & Argan Hair Oil
  'prod-011': 'hairoil', // Pure Organic Argan Oil

  // Body Products
  'b7b46c63-7904-48a2-81bb-c0d520cfe241': 'bodylotion',// Body Glow Lotion
  '9d50bff4-4bbd-4eb7-96cb-ce9d6843ca59': 'bodybutter',// Hydra-Rich Body Butter
  'abce6ebf-f02a-49d3-92ce-15b1a92ece3c': 'bodyscrub', // Coffee Body Scrub
  'prod-006': 'bodylotion',// Olive Oil Body Lotion
  'prod-010': 'bodyscrub', // Sea Salt Body Scrub

  // Soaps
  'prod-005': 'soap',    // Natural Goat Milk Soap
  'prod-017': 'soap',    // Beldi Soap with Ghassoul Clay

  // Special
  'prod-016': 'glove',   // Traditional Kessa Exfoliating Glove
  'prod-020': 'essentialoil', // Tunisian Neroli Essential Oil
  'prod-012': 'rosewater',    // Gammarth Pure Rose Water
  'prod-024': 'lipbalm',      // Shea & Honey Lip Balm
};

async function fetchPexelsImages(query, count = 3) {
  const encoded = encodeURIComponent(query);
  const url = `https://api.pexels.com/v1/search?query=${encoded}&per_page=${count}&orientation=portrait`;
  const res = await fetch(url, {
    headers: { Authorization: PEXELS_API_KEY }
  });
  const data = await res.json();
  return (data.photos || []).map(p => p.src.medium);
}

await client.connect();
console.log('✅ Connected to database\n');

// Step 1: Fetch images for each category
console.log('📸 Fetching images from Pexels...\n');
const categoryImages = {};

for (const [cat, query] of Object.entries(categoryQueries)) {
  try {
    const urls = await fetchPexelsImages(query, 3);
    categoryImages[cat] = urls;
    console.log(`✅ ${cat}: ${urls.length} images fetched`);
  } catch (err) {
    console.log(`❌ ${cat}: failed - ${err.message}`);
    categoryImages[cat] = [];
  }
  // Small delay to respect rate limits
  await new Promise(r => setTimeout(r, 200));
}

// Step 2: Update each product
console.log('\n📦 Updating products...\n');
let updated = 0;
let failed = 0;

for (const [id, cat] of Object.entries(productCategories)) {
  const imgs = categoryImages[cat] || [];
  if (imgs.length === 0) {
    console.log(`⚠️  No images for category ${cat}, skipping ${id}`);
    failed++;
    continue;
  }
  try {
    const result = await client.query(
      'UPDATE products SET images = $1 WHERE id = $2',
      [JSON.stringify(imgs), id]
    );
    if (result.rowCount > 0) {
      updated++;
      console.log(`✅ ${id} → ${cat}`);
    } else {
      console.log(`⚠️  Not found in DB: ${id}`);
      failed++;
    }
  } catch (err) {
    console.log(`❌ Error on ${id}: ${err.message}`);
    failed++;
  }
}

console.log(`\n🎉 Done! Updated: ${updated} | Skipped: ${failed}`);
await client.end();
