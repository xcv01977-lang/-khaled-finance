// Built-in guesses from merchant text to a default category name. They only pre-fill the category on
// a new merchant; a rule the user teaches always wins, and anything guessed stays flagged for review.
const RULES: [RegExp, string][] = [
  [/starbucks|ستاربكس|dunkin|دانكن|costa|كوستا|caribou|tim hortons|coffee|كوفي|قهوة|cafe|كافيه|barn|بارنز|dose|دوز|half million|نصف مليون/i, "قهوة"],
  [/panda|بنده|danube|دانوب|tamimi|التميمي|carrefour|كارفور|lulu|لولو|othaim|العثيم|farm|المزرعة|nesto|نستو|supermarket|سوبرماركت|بقالة|bakala|مخبز|bakery/i, "بقالة"],
  [/aldrees|الدريس|sasco|ساسكو|petrol|بترول|adnoc|أدنوك|naft|نفط|wafi|وقود|fuel|محطة|station|بنزين/i, "بنزين"],
  [/uber|اوبر|careem|كريم|jeeny|جيني|bolt|بولت|lime|train|قطار|saptco|سبتكو|bus\b/i, "مواصلات"],
  [/netflix|نتفلكس|spotify|سبوتيفاي|apple\.com|itunes|icloud|youtube|google ?(one|play|storage)|shahid|شاهد|osn|disney|anghami|أنغامي|subscription|اشتراك|openai|chatgpt/i, "اشتراكات"],
  [/\bstc\b|mobily|موبايلي|zain|زين|اتصالات|electricity|الكهرباء|national water|المياه|sec\b|بيل|bill|سداد|sadad|وصل/i, "فواتير"],
  [/pharmacy|صيدلي|nahdi|النهدي|dawaa|الدواء|whites|hospital|مستشفى|clinic|عيادة|medical|طبي|dental|اسنان|dr\.? sulaiman|سليمان الحبيب/i, "صحة"],
  [/mcdonald|ماكدونالدز|kfc|كنتاكي|burger|برجر|albaik|البيك|herfy|هرفي|pizza|بيتزا|kudu|كودو|maestro|shawarma|شاورما|restaurant|مطعم|jahez|جاهز|hungerstation|هنقرستيشن|mrsool|مرسول|toyou|dominos|دومينوز|subway|ساب واي|shake shack|taco|grill|مشويات|كبسة/i, "مطاعم"],
  [/amazon|امازون|noon|نون|shein|شي ان|zara|زارا|h&m|ikea|ايكيا|jarir|جرير|extra|اكسترا|centrepoint|سنتربوينت|namshi|نمشي|mall|مول|sephora|سيفورا|nike|adidas|store|ستور/i, "تسوق"],
  [/cinema|سينما|vox|فوكس|muvi|موفي|boulevard|البوليفارد|game|قيم|playstation|steam|xbox|ملاهي|trampoline/i, "ترفيه"],
];

export function categoryHint(merchant: string | null | undefined): string | null {
  if (!merchant) return null;
  for (const [re, name] of RULES) if (re.test(merchant)) return name;
  return null;
}
