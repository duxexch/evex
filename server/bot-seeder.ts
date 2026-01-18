import { db } from "./db";
import { users } from "@shared/schema";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";

const ARABIC_FIRST_NAMES = [
  "محمد", "أحمد", "علي", "خالد", "سعيد", "فهد", "عبدالله", "يوسف", "عمر", "حسن",
  "سلطان", "ناصر", "ماجد", "طارق", "كريم", "سامي", "رامي", "وليد", "زياد", "بدر",
  "نورة", "سارة", "فاطمة", "ريم", "لينا", "دانة", "هدى", "مريم", "ليلى", "رنا"
];

const ENGLISH_FIRST_NAMES = [
  "Alex", "Max", "Sam", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Jamie", "Drew",
  "Chris", "Pat", "Quinn", "Avery", "Blake", "Cameron", "Dylan", "Emerson", "Finley", "Harper",
  "Logan", "Peyton", "Reese", "River", "Sage", "Skyler", "Spencer", "Sydney", "Tyler", "Winter"
];

const ARABIC_LAST_NAMES = [
  "العتيبي", "القحطاني", "الشمري", "الدوسري", "الحربي", "المطيري", "السبيعي", "الزهراني", "الغامدي", "البلوي",
  "العنزي", "الرشيدي", "التميمي", "السعيدي", "المالكي", "الشهري", "الحسيني", "الفهدي", "الخالدي", "السالمي"
];

const ENGLISH_LAST_NAMES = [
  "Pro", "Master", "King", "Legend", "Star", "Ace", "Elite", "Champion", "Winner", "Beast",
  "Gamer", "Player", "Champ", "Hero", "Boss", "Chief", "Prime", "Top", "Supreme", "Ultra"
];

const PROFILE_AVATARS = [
  "https://api.dicebear.com/7.x/avataaars/svg?seed=bot1",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=bot2",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=bot3",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=bot4",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=bot5",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=bot6",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=bot7",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=bot8",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=bot9",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=bot10",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=bot11",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=bot12",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=bot13",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=bot14",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=bot15",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=bot16",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=bot17",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=bot18",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=bot19",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=bot20",
];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateAccountId(): string {
  return Math.floor(100000000 + Math.random() * 900000000).toString();
}

function generateRandomStats() {
  const gamesPlayed = Math.floor(Math.random() * 500) + 50;
  const winRate = 0.4 + Math.random() * 0.3;
  const gamesWon = Math.floor(gamesPlayed * winRate);
  const gamesLost = gamesPlayed - gamesWon;
  
  return {
    gamesPlayed,
    gamesWon,
    gamesLost,
    gamesDraw: Math.floor(Math.random() * 20),
    chessPlayed: Math.floor(Math.random() * 100),
    chessWon: Math.floor(Math.random() * 50),
    backgammonPlayed: Math.floor(Math.random() * 100),
    backgammonWon: Math.floor(Math.random() * 50),
    dominoPlayed: Math.floor(Math.random() * 100),
    dominoWon: Math.floor(Math.random() * 50),
    tarneebPlayed: Math.floor(Math.random() * 80),
    tarneebWon: Math.floor(Math.random() * 40),
    balootPlayed: Math.floor(Math.random() * 80),
    balootWon: Math.floor(Math.random() * 40),
    currentWinStreak: Math.floor(Math.random() * 10),
    longestWinStreak: Math.floor(Math.random() * 25) + 5,
    vipLevel: Math.floor(Math.random() * 5),
    p2pRating: (4 + Math.random()).toFixed(2),
    p2pTotalTrades: Math.floor(Math.random() * 50),
    p2pSuccessfulTrades: Math.floor(Math.random() * 45),
  };
}

export async function seedBotAccounts(): Promise<string[]> {
  console.log("Starting bot account seeding...");
  
  const allUsers = await db.select({ id: users.id, email: users.email }).from(users);
  const existingBots = allUsers.filter(u => u.email?.endsWith("@vix.bot"));
  
  if (existingBots.length >= 20) {
    console.log(`${existingBots.length} bot accounts already exist.`);
    return existingBots.map(b => b.id);
  }
  
  const botIds: string[] = [];
  const passwordHash = await bcrypt.hash("bot_secure_password_" + nanoid(8), 10);
  
  for (let i = 0; i < 20; i++) {
    const isArabic = Math.random() > 0.5;
    const firstName = isArabic ? randomElement(ARABIC_FIRST_NAMES) : randomElement(ENGLISH_FIRST_NAMES);
    const lastName = isArabic ? randomElement(ARABIC_LAST_NAMES) : randomElement(ENGLISH_LAST_NAMES);
    const nickname = isArabic ? `${firstName}_${randomElement(ARABIC_LAST_NAMES)}` : `${firstName}${randomElement(ENGLISH_LAST_NAMES)}${Math.floor(Math.random() * 99)}`;
    const username = `bot_${nanoid(8)}`;
    const accountId = generateAccountId();
    const stats = generateRandomStats();
    
    try {
      const [bot] = await db.insert(users).values({
        username,
        password: passwordHash,
        accountId,
        nickname,
        firstName,
        lastName: isArabic ? "" : lastName,
        email: `${username}@vix.bot`,
        emailVerified: true,
        phoneVerified: true,
        role: "player",
        status: "active",
        profilePicture: PROFILE_AVATARS[i % PROFILE_AVATARS.length],
        balance: (Math.random() * 10000 + 500).toFixed(2),
        totalDeposited: (Math.random() * 50000 + 1000).toFixed(2),
        totalWithdrawn: (Math.random() * 20000).toFixed(2),
        totalWagered: (Math.random() * 100000 + 5000).toFixed(2),
        totalWon: (Math.random() * 80000).toFixed(2),
        isOnline: true,
        lastActiveAt: new Date(),
        ...stats,
      }).returning();
      
      botIds.push(bot.id);
      console.log(`Created bot: ${nickname} (${accountId})`);
    } catch (error: any) {
      console.error(`Failed to create bot ${i + 1}:`, error.message);
    }
  }
  
  console.log(`Successfully created ${botIds.length} bot accounts.`);
  return botIds;
}

export async function getBotAccounts(): Promise<Array<{ id: string; nickname: string | null; accountId: string }>> {
  const bots = await db.select({
    id: users.id,
    nickname: users.nickname,
    accountId: users.accountId,
  }).from(users).where(eq(users.email, "")).limit(0);
  
  const allBots = await db.select({
    id: users.id,
    nickname: users.nickname,
    accountId: users.accountId,
    email: users.email,
  }).from(users);
  
  return allBots.filter(u => u.email?.endsWith("@vix.bot")).map(({ id, nickname, accountId }) => ({ id, nickname, accountId }));
}

export async function updateBotOnlineStatus(): Promise<void> {
  const bots = await getBotAccounts();
  for (const bot of bots) {
    await db.update(users)
      .set({ isOnline: true, lastActiveAt: new Date() })
      .where(eq(users.id, bot.id));
  }
}

