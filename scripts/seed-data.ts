import { db } from "../server/db";
import { countryPaymentMethods, currencies, games } from "../shared/schema";
import { sql } from "drizzle-orm";

const CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$", exchangeRate: "1.00" },
  { code: "EUR", name: "Euro", symbol: "€", exchangeRate: "0.92" },
  { code: "GBP", name: "British Pound", symbol: "£", exchangeRate: "0.79" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", exchangeRate: "149.50" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", exchangeRate: "7.24" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", exchangeRate: "1.53" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", exchangeRate: "1.36" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF", exchangeRate: "0.88" },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$", exchangeRate: "7.81" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", exchangeRate: "1.34" },
  { code: "INR", name: "Indian Rupee", symbol: "₹", exchangeRate: "83.12" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$", exchangeRate: "4.97" },
  { code: "RUB", name: "Russian Ruble", symbol: "₽", exchangeRate: "92.50" },
  { code: "KRW", name: "South Korean Won", symbol: "₩", exchangeRate: "1324.50" },
  { code: "MXN", name: "Mexican Peso", symbol: "Mex$", exchangeRate: "17.15" },
  { code: "ZAR", name: "South African Rand", symbol: "R", exchangeRate: "18.75" },
  { code: "TRY", name: "Turkish Lira", symbol: "₺", exchangeRate: "32.15" },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ", exchangeRate: "3.67" },
  { code: "SAR", name: "Saudi Riyal", symbol: "﷼", exchangeRate: "3.75" },
  { code: "EGP", name: "Egyptian Pound", symbol: "E£", exchangeRate: "30.90" },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦", exchangeRate: "1550.00" },
  { code: "KWD", name: "Kuwaiti Dinar", symbol: "د.ك", exchangeRate: "0.31" },
  { code: "QAR", name: "Qatari Riyal", symbol: "ر.ق", exchangeRate: "3.64" },
  { code: "BHD", name: "Bahraini Dinar", symbol: "ب.د", exchangeRate: "0.38" },
  { code: "OMR", name: "Omani Rial", symbol: "ر.ع.", exchangeRate: "0.39" },
  { code: "JOD", name: "Jordanian Dinar", symbol: "د.ا", exchangeRate: "0.71" },
  { code: "LBP", name: "Lebanese Pound", symbol: "ل.ل", exchangeRate: "89500.00" },
  { code: "IQD", name: "Iraqi Dinar", symbol: "ع.د", exchangeRate: "1310.00" },
  { code: "PKR", name: "Pakistani Rupee", symbol: "₨", exchangeRate: "278.50" },
  { code: "BDT", name: "Bangladeshi Taka", symbol: "৳", exchangeRate: "109.75" },
  { code: "VND", name: "Vietnamese Dong", symbol: "₫", exchangeRate: "24500.00" },
  { code: "THB", name: "Thai Baht", symbol: "฿", exchangeRate: "35.50" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM", exchangeRate: "4.72" },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", exchangeRate: "15700.00" },
  { code: "PHP", name: "Philippine Peso", symbol: "₱", exchangeRate: "56.25" },
  { code: "TWD", name: "Taiwan Dollar", symbol: "NT$", exchangeRate: "31.50" },
  { code: "PLN", name: "Polish Zloty", symbol: "zł", exchangeRate: "4.02" },
  { code: "SEK", name: "Swedish Krona", symbol: "kr", exchangeRate: "10.45" },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr", exchangeRate: "10.75" },
  { code: "DKK", name: "Danish Krone", symbol: "kr", exchangeRate: "6.88" },
  { code: "CZK", name: "Czech Koruna", symbol: "Kč", exchangeRate: "23.15" },
  { code: "HUF", name: "Hungarian Forint", symbol: "Ft", exchangeRate: "358.50" },
  { code: "RON", name: "Romanian Leu", symbol: "lei", exchangeRate: "4.58" },
  { code: "BGN", name: "Bulgarian Lev", symbol: "лв", exchangeRate: "1.80" },
  { code: "HRK", name: "Croatian Kuna", symbol: "kn", exchangeRate: "6.92" },
  { code: "ILS", name: "Israeli Shekel", symbol: "₪", exchangeRate: "3.65" },
  { code: "CLP", name: "Chilean Peso", symbol: "CLP$", exchangeRate: "950.00" },
  { code: "COP", name: "Colombian Peso", symbol: "COL$", exchangeRate: "3950.00" },
  { code: "PEN", name: "Peruvian Sol", symbol: "S/", exchangeRate: "3.72" },
  { code: "ARS", name: "Argentine Peso", symbol: "AR$", exchangeRate: "850.00" },
  { code: "UAH", name: "Ukrainian Hryvnia", symbol: "₴", exchangeRate: "37.50" },
  { code: "KZT", name: "Kazakhstani Tenge", symbol: "₸", exchangeRate: "450.00" },
  { code: "MAD", name: "Moroccan Dirham", symbol: "د.م.", exchangeRate: "10.05" },
  { code: "TND", name: "Tunisian Dinar", symbol: "د.ت", exchangeRate: "3.12" },
  { code: "DZD", name: "Algerian Dinar", symbol: "د.ج", exchangeRate: "134.50" },
  { code: "LYD", name: "Libyan Dinar", symbol: "ل.د", exchangeRate: "4.85" },
  { code: "SDG", name: "Sudanese Pound", symbol: "ج.س.", exchangeRate: "601.00" },
  { code: "SYP", name: "Syrian Pound", symbol: "ل.س", exchangeRate: "13000.00" },
  { code: "YER", name: "Yemeni Rial", symbol: "﷼", exchangeRate: "250.50" },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh", exchangeRate: "153.50" },
  { code: "GHS", name: "Ghanaian Cedi", symbol: "₵", exchangeRate: "12.45" },
  { code: "XAF", name: "Central African CFA", symbol: "FCFA", exchangeRate: "603.50" },
  { code: "XOF", name: "West African CFA", symbol: "CFA", exchangeRate: "603.50" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", exchangeRate: "1.64" },
  { code: "BTC", name: "Bitcoin", symbol: "₿", exchangeRate: "0.000024" },
  { code: "ETH", name: "Ethereum", symbol: "Ξ", exchangeRate: "0.00042" },
  { code: "USDT", name: "Tether", symbol: "USDT", exchangeRate: "1.00" },
  { code: "USDC", name: "USD Coin", symbol: "USDC", exchangeRate: "1.00" },
];

const PAYMENT_METHODS = [
  { name: "Bank Transfer", type: "bank_transfer", countryCode: "ALL", minAmount: "10", maxAmount: "50000", processingTime: "1-3 business days", sortOrder: 1 },
  { name: "Visa", type: "card", countryCode: "ALL", minAmount: "10", maxAmount: "10000", processingTime: "Instant", sortOrder: 2 },
  { name: "Mastercard", type: "card", countryCode: "ALL", minAmount: "10", maxAmount: "10000", processingTime: "Instant", sortOrder: 3 },
  { name: "PayPal", type: "e_wallet", countryCode: "ALL", minAmount: "5", maxAmount: "10000", processingTime: "Instant", sortOrder: 4 },
  { name: "Skrill", type: "e_wallet", countryCode: "ALL", minAmount: "5", maxAmount: "10000", processingTime: "Instant", sortOrder: 5 },
  { name: "Neteller", type: "e_wallet", countryCode: "ALL", minAmount: "5", maxAmount: "10000", processingTime: "Instant", sortOrder: 6 },
  { name: "Apple Pay", type: "e_wallet", countryCode: "ALL", minAmount: "10", maxAmount: "5000", processingTime: "Instant", sortOrder: 7 },
  { name: "Google Pay", type: "e_wallet", countryCode: "ALL", minAmount: "10", maxAmount: "5000", processingTime: "Instant", sortOrder: 8 },
  { name: "Bitcoin (BTC)", type: "crypto", countryCode: "ALL", minAmount: "20", maxAmount: "100000", processingTime: "10-60 minutes", sortOrder: 9 },
  { name: "Ethereum (ETH)", type: "crypto", countryCode: "ALL", minAmount: "20", maxAmount: "100000", processingTime: "5-15 minutes", sortOrder: 10 },
  { name: "Tether (USDT)", type: "crypto", countryCode: "ALL", minAmount: "10", maxAmount: "100000", processingTime: "5-30 minutes", sortOrder: 11 },
  { name: "USD Coin (USDC)", type: "crypto", countryCode: "ALL", minAmount: "10", maxAmount: "100000", processingTime: "5-30 minutes", sortOrder: 12 },
  { name: "Binance Pay", type: "crypto", countryCode: "ALL", minAmount: "10", maxAmount: "50000", processingTime: "Instant", sortOrder: 13 },
  { name: "Perfect Money", type: "e_wallet", countryCode: "ALL", minAmount: "5", maxAmount: "20000", processingTime: "Instant", sortOrder: 14 },
  { name: "WebMoney", type: "e_wallet", countryCode: "ALL", minAmount: "5", maxAmount: "10000", processingTime: "Instant", sortOrder: 15 },
  { name: "Paysafecard", type: "e_wallet", countryCode: "EU", minAmount: "10", maxAmount: "1000", processingTime: "Instant", sortOrder: 16 },
  { name: "Vodafone Cash", type: "e_wallet", countryCode: "EG", minAmount: "50", maxAmount: "50000", processingTime: "Instant", sortOrder: 17 },
  { name: "Fawry", type: "e_wallet", countryCode: "EG", minAmount: "50", maxAmount: "50000", processingTime: "1-24 hours", sortOrder: 18 },
  { name: "InstaPay", type: "bank_transfer", countryCode: "EG", minAmount: "50", maxAmount: "100000", processingTime: "Instant", sortOrder: 19 },
  { name: "Orange Cash", type: "e_wallet", countryCode: "EG", minAmount: "50", maxAmount: "50000", processingTime: "Instant", sortOrder: 20 },
  { name: "Etisalat Cash", type: "e_wallet", countryCode: "EG", minAmount: "50", maxAmount: "50000", processingTime: "Instant", sortOrder: 21 },
  { name: "STC Pay", type: "e_wallet", countryCode: "SA", minAmount: "10", maxAmount: "20000", processingTime: "Instant", sortOrder: 22 },
  { name: "Mada", type: "card", countryCode: "SA", minAmount: "10", maxAmount: "50000", processingTime: "Instant", sortOrder: 23 },
  { name: "M-Pesa", type: "e_wallet", countryCode: "KE", minAmount: "100", maxAmount: "150000", processingTime: "Instant", sortOrder: 24 },
  { name: "MTN Mobile Money", type: "e_wallet", countryCode: "GH", minAmount: "10", maxAmount: "10000", processingTime: "Instant", sortOrder: 25 },
  { name: "AirtelTigo Money", type: "e_wallet", countryCode: "GH", minAmount: "10", maxAmount: "10000", processingTime: "Instant", sortOrder: 26 },
  { name: "OPay", type: "e_wallet", countryCode: "NG", minAmount: "500", maxAmount: "1000000", processingTime: "Instant", sortOrder: 27 },
  { name: "Paystack", type: "e_wallet", countryCode: "NG", minAmount: "500", maxAmount: "500000", processingTime: "Instant", sortOrder: 28 },
  { name: "Flutterwave", type: "e_wallet", countryCode: "NG", minAmount: "500", maxAmount: "500000", processingTime: "Instant", sortOrder: 29 },
  { name: "Paytm", type: "e_wallet", countryCode: "IN", minAmount: "100", maxAmount: "200000", processingTime: "Instant", sortOrder: 30 },
  { name: "PhonePe", type: "e_wallet", countryCode: "IN", minAmount: "100", maxAmount: "200000", processingTime: "Instant", sortOrder: 31 },
  { name: "GPay India", type: "e_wallet", countryCode: "IN", minAmount: "100", maxAmount: "200000", processingTime: "Instant", sortOrder: 32 },
  { name: "UPI", type: "bank_transfer", countryCode: "IN", minAmount: "100", maxAmount: "500000", processingTime: "Instant", sortOrder: 33 },
  { name: "Alipay", type: "e_wallet", countryCode: "CN", minAmount: "10", maxAmount: "50000", processingTime: "Instant", sortOrder: 34 },
  { name: "WeChat Pay", type: "e_wallet", countryCode: "CN", minAmount: "10", maxAmount: "50000", processingTime: "Instant", sortOrder: 35 },
  { name: "GrabPay", type: "e_wallet", countryCode: "SG", minAmount: "10", maxAmount: "5000", processingTime: "Instant", sortOrder: 36 },
  { name: "GCash", type: "e_wallet", countryCode: "PH", minAmount: "100", maxAmount: "100000", processingTime: "Instant", sortOrder: 37 },
  { name: "PayMaya", type: "e_wallet", countryCode: "PH", minAmount: "100", maxAmount: "100000", processingTime: "Instant", sortOrder: 38 },
  { name: "OVO", type: "e_wallet", countryCode: "ID", minAmount: "10000", maxAmount: "10000000", processingTime: "Instant", sortOrder: 39 },
  { name: "GoPay", type: "e_wallet", countryCode: "ID", minAmount: "10000", maxAmount: "10000000", processingTime: "Instant", sortOrder: 40 },
  { name: "DANA", type: "e_wallet", countryCode: "ID", minAmount: "10000", maxAmount: "10000000", processingTime: "Instant", sortOrder: 41 },
  { name: "TrueMoney", type: "e_wallet", countryCode: "TH", minAmount: "100", maxAmount: "50000", processingTime: "Instant", sortOrder: 42 },
  { name: "Touch 'n Go", type: "e_wallet", countryCode: "MY", minAmount: "10", maxAmount: "5000", processingTime: "Instant", sortOrder: 43 },
  { name: "Boost", type: "e_wallet", countryCode: "MY", minAmount: "10", maxAmount: "5000", processingTime: "Instant", sortOrder: 44 },
];

const GAMES = [
  { name: "Penalty Shootout", nameAr: "ضربات الجزاء", description: "Score goals and win big! Beat the goalkeeper in this exciting penalty shootout game.", descriptionAr: "سجل الأهداف واربح! تغلب على حارس المرمى في هذه اللعبة المثيرة", category: "sports", rtp: "96.5", volatility: "medium", minBet: "0.50", maxBet: "100", status: "active" },
  { name: "Crash", nameAr: "كراش", description: "Watch the multiplier rise and cash out before it crashes! High risk, high reward gameplay.", descriptionAr: "شاهد المضاعف يرتفع واسحب أرباحك قبل السقوط!", category: "crash", rtp: "97.0", volatility: "high", minBet: "0.10", maxBet: "500", status: "active" },
  { name: "Aviator", nameAr: "الطيار", description: "The plane takes off - cash out before it flies away! Exciting multiplier game.", descriptionAr: "الطائرة تقلع - اسحب أموالك قبل أن تطير!", category: "crash", rtp: "97.0", volatility: "high", minBet: "0.10", maxBet: "500", status: "active" },
  { name: "Lucky Dice", nameAr: "النرد المحظوظ", description: "Roll the dice and predict the outcome. Classic casino dice game.", descriptionAr: "ارم النرد وتوقع النتيجة. لعبة النرد الكلاسيكية", category: "dice", rtp: "98.5", volatility: "low", minBet: "0.10", maxBet: "200", status: "active" },
  { name: "Plinko", nameAr: "بلينكو", description: "Drop the ball and watch it bounce to your prize. Physics-based luck game.", descriptionAr: "أسقط الكرة وشاهدها ترتد نحو جائزتك", category: "arcade", rtp: "97.0", volatility: "medium", minBet: "0.10", maxBet: "100", status: "active" },
  { name: "Mines", nameAr: "الألغام", description: "Navigate the minefield and collect gems. One wrong step and it's game over!", descriptionAr: "تنقل في حقل الألغام واجمع الجواهر!", category: "arcade", rtp: "97.0", volatility: "high", minBet: "0.10", maxBet: "100", status: "active" },
  { name: "Tower Climb", nameAr: "تسلق البرج", description: "Climb the tower and multiply your winnings with each level. How high can you go?", descriptionAr: "تسلق البرج وضاعف أرباحك مع كل مستوى!", category: "arcade", rtp: "96.0", volatility: "high", minBet: "0.50", maxBet: "100", status: "active" },
  { name: "Keno", nameAr: "كينو", description: "Pick your lucky numbers and watch the draw. Classic lottery-style game.", descriptionAr: "اختر أرقامك المحظوظة وشاهد السحب", category: "lottery", rtp: "95.0", volatility: "medium", minBet: "0.10", maxBet: "50", status: "active" },
  { name: "Wheel of Fortune", nameAr: "عجلة الحظ", description: "Spin the wheel and win amazing prizes! Lucky wheel game.", descriptionAr: "أدر العجلة واربح جوائز مذهلة!", category: "wheel", rtp: "96.5", volatility: "medium", minBet: "0.50", maxBet: "100", status: "active" },
  { name: "Hi-Lo", nameAr: "أعلى أم أقل", description: "Guess if the next card is higher or lower. Simple yet exciting card game.", descriptionAr: "خمن إذا كانت الورقة التالية أعلى أم أقل", category: "cards", rtp: "98.0", volatility: "low", minBet: "0.10", maxBet: "200", status: "active" },
  { name: "Blackjack", nameAr: "بلاك جاك", description: "Beat the dealer to 21! Classic casino card game.", descriptionAr: "تغلب على الموزع للوصول إلى 21!", category: "cards", rtp: "99.5", volatility: "low", minBet: "1.00", maxBet: "500", status: "active" },
  { name: "Roulette", nameAr: "الروليت", description: "Place your bets and spin the wheel. European roulette with exciting payouts.", descriptionAr: "ضع رهاناتك وأدر العجلة", category: "table", rtp: "97.3", volatility: "medium", minBet: "0.50", maxBet: "500", status: "active" },
  { name: "Baccarat", nameAr: "باكاراه", description: "Bet on player, banker, or tie in this elegant card game.", descriptionAr: "راهن على اللاعب أو البنك أو التعادل", category: "cards", rtp: "98.9", volatility: "low", minBet: "1.00", maxBet: "1000", status: "active" },
  { name: "Coin Flip", nameAr: "رمي العملة", description: "Heads or tails? Double your money with a simple flip.", descriptionAr: "صورة أم كتابة؟ ضاعف أموالك برمية واحدة", category: "arcade", rtp: "98.0", volatility: "low", minBet: "0.10", maxBet: "500", status: "active" },
  { name: "Scratch Cards", nameAr: "بطاقات الحك", description: "Scratch and reveal your instant prizes!", descriptionAr: "احك واكشف عن جوائزك الفورية!", category: "instant", rtp: "95.0", volatility: "high", minBet: "0.50", maxBet: "50", status: "active" },
  { name: "Slots Classic", nameAr: "سلوتس كلاسيك", description: "Classic 3-reel slot machine with fruit symbols.", descriptionAr: "ماكينة السلوتس الكلاسيكية بثلاث بكرات", category: "slots", rtp: "96.0", volatility: "medium", minBet: "0.20", maxBet: "100", status: "active" },
  { name: "Mega Slots", nameAr: "ميجا سلوتس", description: "5-reel video slots with bonus rounds and free spins.", descriptionAr: "سلوتس فيديو بخمس بكرات مع جولات إضافية", category: "slots", rtp: "96.5", volatility: "high", minBet: "0.20", maxBet: "200", status: "active" },
  { name: "Dragon Tiger", nameAr: "التنين والنمر", description: "Simple and fast card game - bet on Dragon or Tiger.", descriptionAr: "لعبة ورق بسيطة وسريعة", category: "cards", rtp: "96.3", volatility: "low", minBet: "0.50", maxBet: "500", status: "active" },
  { name: "Sic Bo", nameAr: "سيك بو", description: "Ancient Chinese dice game with multiple betting options.", descriptionAr: "لعبة النرد الصينية القديمة", category: "dice", rtp: "97.2", volatility: "medium", minBet: "0.50", maxBet: "200", status: "active" },
  { name: "Craps", nameAr: "كرابس", description: "Roll the dice and win big in this classic casino game.", descriptionAr: "ارم النرد واربح في هذه اللعبة الكلاسيكية", category: "dice", rtp: "98.6", volatility: "medium", minBet: "1.00", maxBet: "500", status: "active" },
];

async function seedCurrencies() {
  console.log("Seeding currencies...");
  for (const currency of CURRENCIES) {
    try {
      await db.insert(currencies).values({
        code: currency.code,
        name: currency.name,
        symbol: currency.symbol,
        exchangeRate: currency.exchangeRate,
        isActive: true,
      }).onConflictDoNothing();
    } catch (err) {
      console.log(`Currency ${currency.code} may already exist`);
    }
  }
  console.log(`Seeded ${CURRENCIES.length} currencies`);
}

async function seedPaymentMethods() {
  console.log("Seeding payment methods...");
  for (const method of PAYMENT_METHODS) {
    try {
      await db.insert(countryPaymentMethods).values({
        name: method.name,
        type: method.type as any,
        countryCode: method.countryCode,
        minAmount: method.minAmount,
        maxAmount: method.maxAmount,
        processingTime: method.processingTime,
        sortOrder: method.sortOrder,
        isActive: true,
      }).onConflictDoNothing();
    } catch (err) {
      console.log(`Payment method ${method.name} may already exist`);
    }
  }
  console.log(`Seeded ${PAYMENT_METHODS.length} payment methods`);
}

async function seedGames() {
  console.log("Seeding games...");
  for (const game of GAMES) {
    try {
      await db.insert(games).values({
        name: game.name,
        nameAr: game.nameAr,
        description: game.description,
        descriptionAr: game.descriptionAr,
        category: game.category,
        rtp: game.rtp,
        volatility: game.volatility as any,
        minBet: game.minBet,
        maxBet: game.maxBet,
        status: game.status as any,
        isFeatured: false,
        isFree: false,
        imageUrl: `/game-thumbnails/${game.name.toLowerCase().replace(/\s+/g, '-')}.png`,
      }).onConflictDoNothing();
    } catch (err) {
      console.log(`Game ${game.name} may already exist`);
    }
  }
  console.log(`Seeded ${GAMES.length} games`);
}

async function main() {
  console.log("Starting seed...");
  
  try {
    await seedCurrencies();
    await seedPaymentMethods();
    await seedGames();
    
    console.log("Seed completed successfully!");
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

main();
