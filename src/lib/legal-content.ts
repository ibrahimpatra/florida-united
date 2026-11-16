import { SITE_CONFIG as C } from './siteConfig';
import type { Bi, Section } from '@/components/info/InfoPage';

const name: Bi = { en: C.fullName, ar: C.fullNameAr };
const contact: Bi = { en: `${C.email} or ${C.phone}`, ar: `${C.email} أو ${C.phone}` };

export const UPDATED = '15 November 2026';

export const ABOUT = {
  title: { en: `About ${C.fullName}`, ar: `عن ${C.fullNameAr}` } as Bi,
  intro: { en: 'Hardware and electrical supplies for contractors, businesses and households across Kuwait.', ar: 'مستلزمات الأدوات والكهرباء للمقاولين والشركات والمنازل في جميع أنحاء الكويت.' } as Bi,
  sections: [
    { h: { en: 'Who we are', ar: 'من نحن' }, p: [
      { en: `${C.fullName} supplies tools, electrical materials, safety equipment and building hardware. Our shop is in ${C.addressFull}, and everything you see online is stocked and shipped from Kuwait.`, ar: `${C.fullNameAr} توفر الأدوات والمواد الكهربائية ومعدات السلامة وأدوات البناء. يقع متجرنا في ${C.addressFullAr}، وكل ما تراه على الموقع متوفر ويُشحن من داخل الكويت.` },
    ] },
    { h: { en: 'What you can expect', ar: 'ماذا تتوقع منا' }, list: [
      { en: 'Prices in Kuwaiti Dinar with no VAT added at checkout.', ar: 'أسعار بالدينار الكويتي دون إضافة ضريبة عند الدفع.' },
      { en: 'Delivery to all six governorates, with live delivery charges shown before you pay.', ar: 'توصيل إلى المحافظات الست مع عرض رسوم التوصيل قبل الدفع.' },
      { en: 'Pay on delivery, or by card online.', ar: 'الدفع عند الاستلام أو بالبطاقة عبر الإنترنت.' },
      { en: 'A clear returns process for eligible products.', ar: 'عملية إرجاع واضحة للمنتجات المؤهلة.' },
      { en: 'Arabic and English throughout the store.', ar: 'العربية والإنجليزية في كامل المتجر.' },
    ] },
    { h: { en: 'Visit or call', ar: 'زرنا أو اتصل بنا' }, p: [
      { en: `${C.addressFull}. ${C.hoursWeekdays}; ${C.hoursSaturday}; ${C.hoursSunday}. Phone ${C.phone}.`, ar: `${C.addressFullAr}. للتواصل: ${C.phone}.` },
    ] },
  ] as Section[],
};

export const TERMS = {
  title: { en: 'Terms & Conditions', ar: 'الشروط والأحكام' } as Bi,
  intro: { en: `These terms apply when you browse or buy from ${C.fullName}. By placing an order you agree to them.`, ar: `تنطبق هذه الشروط عند تصفح أو الشراء من ${C.fullNameAr}. بتقديم طلبك فإنك توافق عليها.` } as Bi,
  sections: [
    { h: { en: 'Orders and availability', ar: 'الطلبات والتوفر' }, p: [
      { en: 'An order is confirmed when it appears in your account with an order number. Stock is reserved when the order is placed. If an item turns out to be unavailable we will contact you and refund anything you have paid for it.', ar: 'يُعتبر الطلب مؤكداً عندما يظهر في حسابك برقم طلب. يُحجز المخزون عند تقديم الطلب. إذا تبين أن أحد المنتجات غير متوفر فسنتواصل معك ونعيد إليك أي مبلغ دفعته عنه.' } ] },
    { h: { en: 'Prices and offers', ar: 'الأسعار والعروض' }, p: [
      { en: 'Prices are in Kuwaiti Dinar (KWD) and include no VAT. The price you pay is the price calculated at checkout, including any active offer, coupon and delivery charge. Offers end at the time shown and cannot be combined where the page says so. We may correct obvious pricing mistakes before shipping; if so you can cancel for a full refund.', ar: 'الأسعار بالدينار الكويتي ولا تتضمن ضريبة. السعر الذي تدفعه هو المحتسب عند إتمام الطلب شاملاً أي عرض فعّال وكوبون ورسوم التوصيل. تنتهي العروض في الوقت المعروض. قد نصحح الأخطاء الواضحة في الأسعار قبل الشحن، وعندها يمكنك الإلغاء مع استرداد كامل.' } ] },
    { h: { en: 'Payment', ar: 'الدفع' }, list: [
      { en: 'Cash on delivery: pay the courier when the order arrives. A small fee may apply and is shown at checkout.', ar: 'الدفع عند الاستلام: تدفع للمندوب عند وصول الطلب. قد تُطبق رسوم بسيطة تظهر عند إتمام الطلب.' },
      { en: 'Card: payments are processed by Stripe and charged in US dollars. The dollar amount is the KWD total converted at the rate shown at checkout. Your bank may add its own currency charges.', ar: 'البطاقة: تُعالج المدفوعات عبر Stripe وتُحصَّل بالدولار الأمريكي. المبلغ بالدولار هو إجمالي الدينار محوّلاً بالسعر المعروض عند الدفع. قد يضيف مصرفك رسومه الخاصة.' },
      { en: 'Unpaid card orders are cancelled automatically after a short time and the stock is released.', ar: 'تُلغى طلبات البطاقة غير المدفوعة تلقائياً بعد وقت قصير ويُحرَّر المخزون.' },
    ] },
    { h: { en: 'Delivery', ar: 'التوصيل' }, p: [{ en: 'See our Shipping & Delivery page for charges and timings. Delivery dates are estimates, not guarantees.', ar: 'راجع صفحة الشحن والتوصيل للرسوم والمدد. مواعيد التوصيل تقديرية وليست مضمونة.' }] },
    { h: { en: 'Cancellations, returns and refunds', ar: 'الإلغاء والإرجاع والاسترداد' }, p: [{ en: 'You can cancel an order online until it is shipped. Returns follow our Returns & Refunds page.', ar: 'يمكنك إلغاء الطلب عبر الإنترنت قبل شحنه. يخضع الإرجاع لصفحة الإرجاع والاسترداد.' }] },
    { h: { en: 'Your account', ar: 'حسابك' }, p: [{ en: 'Keep your password private. You are responsible for activity on your account. We may suspend accounts that are used to abuse offers or place fraudulent orders.', ar: 'حافظ على سرية كلمة المرور. أنت مسؤول عن النشاط على حسابك. قد نوقف الحسابات المستخدمة في إساءة استغلال العروض أو الطلبات الاحتيالية.' }] },
    { h: { en: 'Product information and the AI assistant', ar: 'معلومات المنتجات والمساعد الذكي' }, p: [{ en: 'We try to keep descriptions, images and specifications accurate. The chat assistant is an automated helper: check important details such as specifications and prices on the product page or with our team before ordering.', ar: 'نحرص على دقة الأوصاف والصور والمواصفات. المساعد في المحادثة أداة آلية: تحقق من التفاصيل المهمة كالمواصفات والأسعار في صفحة المنتج أو مع فريقنا قبل الطلب.' }] },
    { h: { en: 'Liability', ar: 'المسؤولية' }, p: [{ en: 'To the extent allowed by law, our liability for any order is limited to the amount you paid for it. Nothing here limits rights you have under Kuwaiti consumer law.', ar: 'بالقدر الذي يسمح به القانون تقتصر مسؤوليتنا عن أي طلب على المبلغ الذي دفعته. لا يحد أي بند هنا من حقوقك بموجب قانون حماية المستهلك الكويتي.' }] },
    { h: { en: 'Governing law and contact', ar: 'القانون الواجب التطبيق والتواصل' }, p: [{ en: `These terms are governed by the laws of the State of Kuwait. Contact ${name.en}: ${contact.en}.`, ar: `تخضع هذه الشروط لقوانين دولة الكويت. للتواصل مع ${name.ar}: ${contact.ar}.` }] },
  ] as Section[],
};

export const PRIVACY = {
  title: { en: 'Privacy Policy', ar: 'سياسة الخصوصية' } as Bi,
  intro: { en: 'What we collect, why, and the choices you have.', ar: 'ما الذي نجمعه ولماذا والخيارات المتاحة لك.' } as Bi,
  sections: [
    { h: { en: 'What we collect', ar: 'ما نجمعه' }, list: [
      { en: 'Account details: name, email, phone number and password (stored only as a one-way hash).', ar: 'بيانات الحساب: الاسم والبريد الإلكتروني ورقم الهاتف وكلمة المرور (تُحفظ مشفرة بشكل لا رجعة فيه).' },
      { en: 'Delivery addresses and the orders you place.', ar: 'عناوين التوصيل والطلبات التي تقدمها.' },
      { en: 'Messages you send us through the contact form or the chat assistant.', ar: 'الرسائل التي ترسلها عبر نموذج التواصل أو المساعد.' },
      { en: 'Your cart and language choice, kept in your browser.', ar: 'سلة التسوق واللغة المختارة، وتُحفظ في متصفحك.' },
    ] },
    { h: { en: 'How we use it', ar: 'كيف نستخدمها' }, list: [
      { en: 'To process, deliver and support your orders and returns.', ar: 'لمعالجة طلباتك وتوصيلها ودعمها وإدارة المرتجعات.' },
      { en: 'To send order updates and account emails such as password resets.', ar: 'لإرسال تحديثات الطلب ورسائل الحساب مثل استعادة كلمة المرور.' },
      { en: 'To keep the store secure and prevent fraud.', ar: 'للحفاظ على أمان المتجر ومنع الاحتيال.' },
    ] },
    { h: { en: 'Card payments', ar: 'مدفوعات البطاقات' }, p: [{ en: 'Card details are entered on Stripe\'s secure page. We never see or store your card number; we keep only the payment reference needed to match and refund your order.', ar: 'تُدخل بيانات البطاقة في صفحة Stripe الآمنة. لا نرى رقم بطاقتك ولا نخزنه، ونحتفظ فقط بمرجع الدفع اللازم لمطابقة الطلب وإجراء الاسترداد.' }] },
    { h: { en: 'The chat assistant', ar: 'المساعد في المحادثة' }, p: [{ en: 'Your chat messages, and store information needed to answer them, are sent to Google\'s Gemini service to generate replies. If you are signed in and ask about your orders, the assistant can read your own orders only. Please do not share passwords or card numbers in the chat.', ar: 'تُرسل رسائلك في المحادثة، مع معلومات المتجر اللازمة للرد، إلى خدمة Gemini من Google لإنشاء الردود. إذا كنت مسجلاً وسألت عن طلباتك فيمكن للمساعد قراءة طلباتك أنت فقط. يرجى عدم مشاركة كلمات المرور أو أرقام البطاقات في المحادثة.' }] },
    { h: { en: 'Who we share it with', ar: 'من نشاركها معه' }, p: [{ en: 'Only service providers that help us run the store: delivery staff or couriers (name, phone, address), Stripe for card payments, our email provider, our cloud database host and Google for the chat assistant. We do not sell your data.', ar: 'فقط مزودو الخدمات الذين يساعدوننا في تشغيل المتجر: المناديب وشركات التوصيل (الاسم والهاتف والعنوان) وStripe لمدفوعات البطاقة ومزود البريد ومضيف قاعدة البيانات السحابية وGoogle للمساعد. لا نبيع بياناتك.' }] },
    { h: { en: 'Your choices', ar: 'خياراتك' }, p: [{ en: `You can view and edit your details in My Account. To ask for a copy of your data or for it to be deleted, contact ${contact.en}. We may keep order records as long as needed for accounting and legal reasons.`, ar: `يمكنك عرض بياناتك وتعديلها من حسابي. لطلب نسخة من بياناتك أو حذفها تواصل معنا على ${contact.ar}. قد نحتفظ بسجلات الطلبات للمدة اللازمة لأغراض المحاسبة والقانون.` }] },
  ] as Section[],
};

export const SHIPPING = (threshold: number | null, fmt: (n: number) => string) => ({
  title: { en: 'Shipping & Delivery', ar: 'الشحن والتوصيل' } as Bi,
  intro: { en: 'We deliver to every governorate in Kuwait.', ar: 'نوصّل إلى جميع محافظات الكويت.' } as Bi,
  sections: [
    { h: { en: 'Charges', ar: 'الرسوم' }, p: [
      { en: 'Delivery charges depend on your governorate and are shown at checkout before you pay, so there are no surprises.', ar: 'تعتمد رسوم التوصيل على محافظتك وتظهر عند إتمام الطلب قبل الدفع، فلا مفاجآت.' },
      ...(threshold ? [{ en: `Orders with ${fmt(threshold)} or more of shippable goods qualify for free delivery. Some products are marked free shipping on their page.`, ar: `الطلبات التي تبلغ ${fmt(threshold)} أو أكثر من المنتجات القابلة للشحن تحصل على توصيل مجاني. بعض المنتجات تحمل علامة شحن مجاني في صفحتها.` }] : []),
    ] },
    { h: { en: 'Timing', ar: 'المدة' }, p: [{ en: 'Each delivery option at checkout shows an estimated time. Orders are prepared after confirmation; estimates are not guarantees and large or special-order items can take longer.', ar: 'يعرض كل خيار توصيل عند الدفع مدة تقديرية. تُجهَّز الطلبات بعد التأكيد، والمدد تقديرية وقد تطول للمنتجات الكبيرة أو الطلبات الخاصة.' }] },
    { h: { en: 'Paying on delivery', ar: 'الدفع عند الاستلام' }, p: [{ en: 'Keep the exact amount ready if you can. Cash on delivery may carry a small fee, shown at checkout.', ar: 'يُفضل تجهيز المبلغ بالتحديد. قد تُطبق رسوم بسيطة للدفع عند الاستلام تظهر عند إتمام الطلب.' }] },
    { h: { en: 'Tracking', ar: 'التتبع' }, p: [{ en: 'Follow your order from My Orders, or use Order Tracking with your order number and the email or phone used. We email you when the status changes.', ar: 'تابع طلبك من طلباتي، أو استخدم تتبع الطلب برقم الطلب والبريد أو الهاتف المستخدم. نراسلك عند تغير الحالة.' }] },
    { h: { en: 'When you receive your order', ar: 'عند استلام الطلب' }, p: [{ en: 'Please check the parcel on delivery. If something is damaged or missing, tell us within 48 hours and keep the packaging.', ar: 'يرجى فحص الطرد عند التسليم. إذا كان هناك تلف أو نقص فأبلغنا خلال 48 ساعة واحتفظ بالتغليف.' }] },
  ] as Section[],
});

export const RETURNS = {
  title: { en: 'Returns & Refunds', ar: 'الإرجاع والاسترداد' } as Bi,
  intro: { en: 'If something is not right, we will make it right where the product is eligible.', ar: 'إذا كان هناك خطأ فسنصلحه متى كان المنتج مؤهلاً للإرجاع.' } as Bi,
  sections: [
    { h: { en: 'What can be returned', ar: 'ما يمكن إرجاعه' }, list: [
      { en: 'Products marked as returnable on their page, within the return period shown there (14 days from delivery unless stated otherwise).', ar: 'المنتجات المعلّمة بأنها قابلة للإرجاع في صفحتها، خلال مدة الإرجاع الموضحة (14 يوماً من التسليم ما لم يُذكر غير ذلك).' },
      { en: 'Items must be unused, in their original packaging and with all accessories.', ar: 'يجب أن تكون القطع غير مستخدمة وبتغليفها الأصلي ومع جميع ملحقاتها.' },
      { en: 'Products marked non-returnable cannot be returned unless they arrive faulty or wrong.', ar: 'المنتجات المعلّمة غير قابلة للإرجاع لا تُرجع إلا إذا وصلت معيبة أو خاطئة.' },
    ] },
    { h: { en: 'How to return', ar: 'طريقة الإرجاع' }, list: [
      { en: 'Open My Orders, choose the delivered order and press Return.', ar: 'افتح طلباتي، اختر الطلب المسلّم واضغط إرجاع.' },
      { en: 'Select the items, give a reason and add photos if the item is faulty or damaged.', ar: 'اختر القطع واذكر السبب وأضف صوراً إن كانت القطعة معيبة أو تالفة.' },
      { en: 'We review the request and tell you the decision by email.', ar: 'نراجع الطلب ونعلمك بالقرار عبر البريد.' },
      { en: 'Once approved, we arrange collection or you bring the item to our shop.', ar: 'بعد الموافقة ننظم الاستلام أو تحضر القطعة إلى متجرنا.' },
    ] },
    { h: { en: 'Refunds', ar: 'الاسترداد' }, list: [
      { en: 'Card orders are refunded to the same card through Stripe. The refund is in US dollars, in proportion to what you were charged, and your bank usually shows it within 5 to 10 working days.', ar: 'تُسترد طلبات البطاقة إلى البطاقة نفسها عبر Stripe. يكون الاسترداد بالدولار بما يتناسب مع المبلغ المحصّل، ويظهر عادةً في كشف مصرفك خلال 5 إلى 10 أيام عمل.' },
      { en: 'Cash-on-delivery orders are refunded by the method we agree with you, for example bank transfer or in-store.', ar: 'تُسترد طلبات الدفع عند الاستلام بالطريقة المتفق عليها معك، مثل التحويل المصرفي أو في المتجر.' },
      { en: 'Delivery charges are refunded only when the return is due to our error or a faulty item.', ar: 'تُسترد رسوم التوصيل فقط إذا كان الإرجاع بسبب خطئنا أو عيب في المنتج.' },
    ] },
    { h: { en: 'Cancelling instead', ar: 'الإلغاء بدلاً من الإرجاع' }, p: [{ en: 'You can cancel an order from My Orders before it ships. Stock is released and any card payment is refunded automatically.', ar: 'يمكنك إلغاء الطلب من طلباتي قبل شحنه. يُحرَّر المخزون وتُسترد مدفوعات البطاقة تلقائياً.' }] },
  ] as Section[],
};
