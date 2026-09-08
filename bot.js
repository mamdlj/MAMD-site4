// ربات تلگرام که پیام کاربر رو می‌گیره، به Claude می‌فرسته، و جواب رو برمی‌گردونه

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const Anthropic = require('@anthropic-ai/sdk');

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!TELEGRAM_TOKEN || !ANTHROPIC_API_KEY) {
  console.error('❌ لطفاً TELEGRAM_BOT_TOKEN و ANTHROPIC_API_KEY رو در فایل .env تنظیم کنید.');
  process.exit(1);
}

// این متن رو می‌تونید عوض کنید تا شخصیت/رفتار بات رو مشخص کنه
const SYSTEM_PROMPT = 'تو یک دستیار هوشمند و مفید هستی که به زبان فارسی و دوستانه جواب می‌ده.';

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// تاریخچه‌ی مکالمه هر کاربر رو جدا نگه می‌داریم (در حافظه — با ری‌استارت شدن پاک می‌شه)
const conversations = new Map();
const MAX_HISTORY = 20; // حداکثر تعداد پیام‌هایی که برای هر کاربر نگه می‌داریم

function getHistory(chatId) {
  if (!conversations.has(chatId)) conversations.set(chatId, []);
  return conversations.get(chatId);
}

bot.onText(/\/start/, (msg) => {
  conversations.delete(msg.chat.id);
  bot.sendMessage(msg.chat.id, 'سلام! من به Claude وصلم، هر سوالی داری بپرس. برای شروع دوباره مکالمه، دستور /reset رو بزن.');
});

bot.onText(/\/reset/, (msg) => {
  conversations.delete(msg.chat.id);
  bot.sendMessage(msg.chat.id, 'مکالمه پاک شد ✅');
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // دستورات (که با / شروع میشن) رو نادیده بگیر، چون هندلر جدا دارن
  if (!text || text.startsWith('/')) return;

  bot.sendChatAction(chatId, 'typing');

  const history = getHistory(chatId);
  history.push({ role: 'user', content: text });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: history,
    });

    const reply = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    history.push({ role: 'assistant', content: reply });

    // جلوگیری از رشد بی‌نهایت تاریخچه
    if (history.length > MAX_HISTORY) {
      history.splice(0, history.length - MAX_HISTORY);
    }

    bot.sendMessage(chatId, reply);
  } catch (err) {
    console.error('Claude API error:', err);
    bot.sendMessage(chatId, '⚠ متاسفانه یه خطا پیش اومد. لطفاً دوباره امتحان کن.');
  }
});

console.log('🤖 بات روشن شد و منتظر پیامه...');
