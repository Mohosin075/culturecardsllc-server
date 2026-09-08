const path = require('path')
const serverDir = path.resolve(__dirname, '..')
require(path.join(serverDir, 'node_modules/dotenv')).config({
  path: path.join(serverDir, '.env'),
})
const mongoose = require(path.join(serverDir, 'node_modules/mongoose'))

async function seedProducts() {
  try {
    const dbUrl = process.env.DATABASE_URL
    if (!dbUrl) {
      console.error('❌ Error: DATABASE_URL not found in .env')
      process.exit(1)
    }

    console.log('🔌 Connecting to MongoDB...')
    await mongoose.connect(dbUrl)
    console.log('✅ Connected to database successfully!')

    const db = mongoose.connection.db
    const categoriesColl = db.collection('categories')
    const usersColl = db.collection('users')
    const productsColl = db.collection('products')

    // 1. Fetch categories
    const categories = await categoriesColl.find({}).toArray()
    const getCatId = name => {
      const cat = categories.find(
        c => c.name.toLowerCase() === name.toLowerCase(),
      )
      return cat ? cat._id : null
    }

    const tradingCardsCatId =
      getCatId('Trading Cards') || categories[0]?._id
    const watchesCatId =
      getCatId('Watches') || categories[1]?._id
    const rolexCatId =
      getCatId('Rolex') || watchesCatId
    const techCatId =
      getCatId('Tech') || categories[2]?._id

    // 2. Fetch or update verified sellers
    const candidateEmails = [
      'test_seller@culturecards.com',
      'hetehew380@gwshare.com',
      'ritutasfia1@gmail.com',
      'vefiyaf757@archifun.com',
    ]

    const sellers = await usersColl
      .find({ email: { $in: candidateEmails } })
      .toArray()

    if (sellers.length === 0) {
      const anyUsers = await usersColl.find({}).limit(3).toArray()
      sellers.push(...anyUsers)
    }

    for (const seller of sellers) {
      await usersColl.updateOne(
        { _id: seller._id },
        { $set: { sellerVerified: true, status: 'active' } },
      )
    }

    const s1 = sellers[0]._id
    const s2 = (sellers[1] || sellers[0])._id
    const s3 = (sellers[2] || sellers[0])._id
    const s4 = (sellers[3] || sellers[0])._id

    // 3. Define 10 realistic collectible products with local upload paths
    const newProducts = [
      {
        sellerId: s1,
        title:
          '1999 Pokémon Base Set 1st Edition Charizard Holo #4 (PSA 9)',
        description:
          'The holy grail of vintage Pokémon collecting. 1999 Wizards of the Coast Base Set 1st Edition Shadowless Charizard #4 graded PSA 9 Mint. Features pristine holographic foil, sharp 4-point corners, and immaculate edge preservation.',
        images: [
          '/uploads/images/1788581495569-n4l8uz-1999-pok-mon-base-set-1st-edit-1.jpg',
          '/uploads/images/1788581495669-edy901-1999-pok-mon-base-set-1st-edit-2.jpg',
        ],
        category: tradingCardsCatId,
        condition: 'Mint',
        estValue: 18500,
        buyNowPrice: 18500,
        startingBid: 12000,
        reservePrice: 16000,
        status: 'active',
        stock: 1,
        isFeatured: true,
        boostedUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        allowTrade: true,
        allowOffers: true,
        minOfferAmount: 14000,
        shippingWeight: 0.5,
        shareCount: 24,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        sellerId: s2,
        title:
          '1986 Fleer Michael Jordan Rookie Card #57 (PSA 8.5 NM-MT+)',
        description:
          'The most iconic and influential modern sports card in existence. 1986-87 Fleer #57 Michael Jordan Rookie graded PSA 8.5 with superb red-white-and-blue border clarity, deep print saturation, and crisp gloss.',
        images: [
          '/uploads/images/1788581495783-uaz34i-1986-fleer-michael-jordan-rook-1.jpg',
          '/uploads/images/1788581495801-oh1m9u-1986-fleer-michael-jordan-rook-2.jpg',
        ],
        category: tradingCardsCatId,
        condition: 'Near Mint',
        estValue: 12500,
        buyNowPrice: 12500,
        startingBid: 8500,
        reservePrice: 10500,
        status: 'active',
        stock: 1,
        isFeatured: true,
        boostedUntil: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        allowTrade: true,
        allowOffers: true,
        minOfferAmount: 9500,
        shippingWeight: 0.4,
        shareCount: 18,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        sellerId: s1,
        title: 'Magic: The Gathering Alpha Black Lotus (BGS 9.0 Mint)',
        description:
          'The definitive crown jewel of Magic: The Gathering. 1993 Limited Edition Alpha Black Lotus, original art by Christopher Rush. Graded BGS 9 with subgrades: Centering 9, Edges 9, Corners 9, Surface 9.5. True investment grade Power Nine.',
        images: [
          '/uploads/images/1788581495920-4ommrb-magic-the-gathering-alpha-blac-1.jpg',
          '/uploads/images/1788581495949-pxa61q-magic-the-gathering-alpha-blac-2.jpg',
        ],
        category: tradingCardsCatId,
        condition: 'Mint',
        estValue: 85000,
        buyNowPrice: 85000,
        startingBid: 60000,
        reservePrice: 75000,
        status: 'active',
        stock: 1,
        isFeatured: true,
        boostedUntil: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        allowTrade: true,
        allowOffers: true,
        minOfferAmount: 70000,
        shippingWeight: 0.5,
        shareCount: 42,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        sellerId: s3,
        title:
          '2003 Topps Chrome LeBron James Rookie #111 (PSA 10 Gem Mint)',
        description:
          'The definitive rookie card for LeBron James from the legendary 2003-04 draft class. Graded PSA 10 Gem Mint with 50/50 centering, pristine chrome sheen, clean edges, and zero surface dimples.',
        images: [
          '/uploads/images/1788581496062-dzdned-2003-topps-chrome-lebron-james-1.jpg',
          '/uploads/images/1788581496087-i6d8kt-2003-topps-chrome-lebron-james-2.jpg',
        ],
        category: tradingCardsCatId,
        condition: 'Mint',
        estValue: 9800,
        buyNowPrice: 9800,
        startingBid: 6500,
        reservePrice: 8500,
        status: 'active',
        stock: 1,
        isFeatured: false,
        allowTrade: true,
        allowOffers: true,
        minOfferAmount: 7500,
        shippingWeight: 0.4,
        shareCount: 15,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        sellerId: s4,
        title:
          '2000 Pokémon Neo Genesis 1st Edition Lugia Holo #9 (BGS 9.5)',
        description:
          'A true master-set centerpiece. Extremely rare 1st Edition Neo Genesis Lugia #9 certified BGS 9.5 Gem Mint. Famed for notorious manufacturing print lines, making a 9.5 specimen one of the rarest finds in early Pokémon WOTC history.',
        images: [
          '/uploads/images/1788581495669-edy901-1999-pok-mon-base-set-1st-edit-2.jpg',
          '/uploads/images/1788581495569-n4l8uz-1999-pok-mon-base-set-1st-edit-1.jpg',
        ],
        category: tradingCardsCatId,
        condition: 'Mint',
        estValue: 14200,
        buyNowPrice: 14200,
        startingBid: 9500,
        reservePrice: 12000,
        status: 'active',
        stock: 1,
        isFeatured: false,
        allowTrade: true,
        allowOffers: true,
        minOfferAmount: 10500,
        shippingWeight: 0.5,
        shareCount: 11,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        sellerId: s1,
        title:
          "Rolex Submariner Date 'Kermit' 126610LV (Unworn 2024 Full Set)",
        description:
          'The modern luxury icon. Rolex Submariner Date reference 126610LV with vibrant green Cerachrom ceramic bezel and deep black dial. Features Rolex caliber 3235 automatic movement, Oystersteel bracelet with Glidelock clasp. Unworn condition.',
        images: [
          '/uploads/images/1788581496295-i3psb4-rolex-submariner-date-kermit-1-1.jpg',
          '/uploads/images/1788581496316-7t3yy6-rolex-submariner-date-kermit-1-2.jpg',
        ],
        category: rolexCatId,
        condition: 'Mint',
        estValue: 15800,
        buyNowPrice: 15800,
        startingBid: 12500,
        reservePrice: 14500,
        status: 'active',
        stock: 1,
        isFeatured: true,
        boostedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        allowTrade: true,
        allowOffers: true,
        minOfferAmount: 13500,
        shippingWeight: 2.5,
        shareCount: 31,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        sellerId: s2,
        title:
          "Rolex Cosmograph Daytona 116500LN 'Panda' Dial (Complete Set)",
        description:
          'The modern chronograph benchmark. Rolex Daytona 116500LN featuring the highly coveted white lacquer dial with black sub-dial rings (Panda) and black monobloc Cerachrom ceramic tachymeter bezel. Complete with full links, card & double box.',
        images: [
          '/uploads/images/1788581496442-unve8v-rolex-cosmograph-daytona-11650-1.jpg',
          '/uploads/images/1788581496465-0k49sl-rolex-cosmograph-daytona-11650-2.jpg',
        ],
        category: rolexCatId,
        condition: 'Excellent',
        estValue: 28500,
        buyNowPrice: 28500,
        startingBid: 22000,
        reservePrice: 26000,
        status: 'active',
        stock: 1,
        isFeatured: true,
        boostedUntil: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
        allowTrade: true,
        allowOffers: true,
        minOfferAmount: 24000,
        shippingWeight: 2.6,
        shareCount: 29,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        sellerId: s3,
        title: 'Audemars Piguet Royal Oak 41mm 15500ST Blue Dial',
        description:
          "Gérald Genta's legendary masterpiece. Audemars Piguet Royal Oak reference 15500ST in stainless steel sporting the coveted boutique 'Grande Tapisserie' deep blue dial. White gold applied hour-markers and hands, exhibition sapphire caseback.",
        images: [
          '/uploads/images/1788581496565-8ldqlz-audemars-piguet-royal-oak-41mm-1.jpg',
          '/uploads/images/1788581496579-7mlym1-audemars-piguet-royal-oak-41mm-2.jpg',
        ],
        category: watchesCatId,
        condition: 'Excellent',
        estValue: 39500,
        buyNowPrice: 39500,
        startingBid: 31000,
        reservePrice: 36000,
        status: 'active',
        stock: 1,
        isFeatured: false,
        allowTrade: true,
        allowOffers: true,
        minOfferAmount: 34000,
        shippingWeight: 3.0,
        shareCount: 19,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        sellerId: s4,
        title:
          '1998 Nintendo Game Boy Color Atomic Purple (Sealed NIB VGA 85+)',
        description:
          'Museum quality piece of video game history. Original 1998 Nintendo Game Boy Color in iconic translucent Atomic Purple casing. Factory brand new sealed in box, authenticated and graded VGA 85+ NM+ with immaculate factory H-seam seal intact.',
        images: [
          '/uploads/images/1788581496692-cfntmh-1998-nintendo-game-boy-color-a-1.jpg',
          '/uploads/images/1788581496714-h8w66z-1998-nintendo-game-boy-color-a-2.jpg',
        ],
        category: techCatId,
        condition: 'Mint',
        estValue: 3200,
        buyNowPrice: 3200,
        startingBid: 1800,
        reservePrice: 2600,
        status: 'active',
        stock: 1,
        isFeatured: false,
        allowTrade: true,
        allowOffers: true,
        minOfferAmount: 2200,
        shippingWeight: 1.8,
        shareCount: 8,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        sellerId: s1,
        title:
          'Sony PlayStation 1 SCPH-1001 Launch Edition (Factory Sealed NIB)',
        description:
          'Extremely scarce collector grade 1995 North American launch edition original Sony PlayStation (SCPH-1001 audiophile AKM DAC edition). Unopened factory plastic seal with clean horizontal pull-strip, pristine sharp box corners, zero UV fading.',
        images: [
          '/uploads/images/1788581496811-dn1mmj-sony-playstation-1-scph-1001-l-1.jpg',
          '/uploads/images/1788581496830-nm9isx-sony-playstation-1-scph-1001-l-2.jpg',
        ],
        category: techCatId,
        condition: 'Mint',
        estValue: 4800,
        buyNowPrice: 4800,
        startingBid: 2800,
        reservePrice: 4000,
        status: 'active',
        stock: 1,
        isFeatured: true,
        boostedUntil: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        allowTrade: true,
        allowOffers: true,
        minOfferAmount: 3500,
        shippingWeight: 5.2,
        shareCount: 16,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]

    console.log(`🚀 Inserting ${newProducts.length} realistic products...`)
    const insertResult = await productsColl.insertMany(newProducts)
    console.log(
      `🎉 Successfully inserted ${insertResult.insertedCount} products!`,
    )

    const totalCount = await productsColl.countDocuments()
    console.log(`📊 Total products in database now: ${totalCount}`)
  } catch (error) {
    console.error('❌ Error during seeding:', error)
  } finally {
    await mongoose.disconnect()
    console.log('🔌 Disconnected from MongoDB.')
    process.exit(0)
  }
}

seedProducts()
