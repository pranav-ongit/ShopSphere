"""
ShopSphere shopping assistant (free version).

It uses no AI model. It reads the customer's message, picks out a budget,
a category and product words, and searches your own products.

Later, answer() can be replaced by a call to an AI API. The website and
the API address do not need to change.
"""

import re
from decimal import Decimal

from django.db.models import Avg, Count

from .models import Category, Product

MAX_RESULTS = 4

# Words that point to a category. The key is the category slug.
CATEGORY_WORDS = {
    'audio': {
        'audio', 'headphone', 'headphones', 'earbud', 'earbuds', 'earphone',
        'earphones', 'speaker', 'speakers', 'music', 'sound', 'bass', 'bluetooth',
    },
    'wearables': {
        'wearable', 'wearables', 'watch', 'watches', 'smartwatch', 'band',
        'bands', 'fitness', 'tracker',
    },
    'accessories': {
        'accessory', 'accessories', 'charger', 'chargers', 'cable', 'cables',
        'adapter', 'case', 'cover',
    },
}

# Specific product words. They are used to rank results by product name.
TYPE_WORDS = {
    'headphone', 'headphones', 'earbud', 'earbuds', 'earphone', 'earphones',
    'speaker', 'speakers', 'bluetooth', 'watch', 'watches', 'smartwatch',
    'band', 'bands', 'charger', 'chargers', 'cable', 'cables', 'adapter',
    'case', 'cover',
}

ALL_CATEGORY_WORDS = set().union(*CATEGORY_WORDS.values())

# Words that tell us what the customer wants
GREETING = {'hi', 'hii', 'hello', 'hey', 'heyy', 'namaste'}
THANKS = {'thanks', 'thank', 'thx'}
CHEAPEST = {'cheapest', 'cheap', 'lowest', 'affordable'}
BEST = {'best', 'top', 'rated', 'popular', 'recommend', 'recommended',
        'favourite', 'favorite', 'bestseller', 'bestselling'}
DEALS = {'deal', 'deals', 'discount', 'discounts', 'offer', 'offers', 'sale', 'sales'}

FAQ_WORDS = {
    'delivery': {'delivery', 'shipping', 'ship', 'deliver', 'shipped'},
    'returns': {'return', 'returns', 'refund', 'refunds', 'exchange'},
    'payment': {'payment', 'pay', 'cod', 'upi', 'card'},
    'orders': {'order', 'orders', 'track', 'tracking', 'status'},
    'contact': {'contact', 'support', 'phone', 'email'},
}

FAQ_ANSWERS = {
    'delivery': 'Delivery is free on orders above ₹999. You can follow your order on the My orders page.',
    'returns': 'We offer easy 7-day returns on unused products.',
    'payment': 'Payment is in demo mode for now. When you place an order, it is saved as pending.',
    'orders': 'You can see all your orders and their status on the My orders page. Click your initial at the top right, then choose My orders.',
    'contact': 'You can reach us at support@shopsphere.com.',
}

# Words that carry no product meaning
STOPWORDS = {
    'a', 'an', 'the', 'i', 'me', 'my', 'we', 'you', 'your', 'is', 'are', 'am',
    'do', 'does', 'can', 'could', 'would', 'will', 'please', 'show', 'find',
    'get', 'want', 'need', 'looking', 'look', 'for', 'to', 'of', 'in', 'on',
    'at', 'with', 'and', 'or', 'any', 'some', 'have', 'has', 'give', 'tell',
    'about', 'what', 'which', 'where', 'when', 'how', 'who', 'why', 'whats',
    'good', 'nice', 'buy', 'under', 'below', 'above', 'over', 'than', 'less',
    'more', 'within', 'upto', 'up', 'max', 'maximum', 'min', 'minimum',
    'budget', 'around', 'about', 'between', 'price', 'cost', 'rs', 'inr',
    'rupees', 'rupee', 'products', 'product', 'item', 'items', 'something',
    'anything', 'option', 'options', 'suggest', 'new', 'latest', 'available',
    'stock', 'policy', 'info', 'information', 'details', 'know', 'long',
    'take', 'takes', 'ok', 'okay', 'yes', 'no', 'there', 'that', 'this', 'it',
    'be', 'by', 'from', 'one', 'ones', 'much', 'many', 'like',
} | GREETING | THANKS | CHEAPEST | BEST | DEALS | set().union(*FAQ_WORDS.values())

SUGGESTIONS = ['Headphones under ₹1,500', 'Best rated products', 'Any deals?', 'Track my order']

# ---------- Reading a budget from the message ----------

NUM = r'(\d+(?:,\d{2,3})*(?:\.\d+)?)(?:\s*(k)\b)?'
CUR = r'\s*(?:rs\.?|inr|₹)?\s*'
HIGH = re.compile(
    r'\b(?:under|below|less than|within|upto|up to|maximum|max|budget of|budget|not more than|cheaper than)' + CUR + NUM
)
LOW = re.compile(r'\b(?:above|over|more than|at least|minimum|min|costlier than)' + CUR + NUM)
AROUND = re.compile(r'\b(?:around|about|approximately)' + CUR + NUM)
BETWEEN = re.compile(r'\bbetween' + CUR + NUM + r'\s*(?:and|to|-)' + CUR + NUM)
BARE = re.compile(r'(?:rs\.?|inr|₹)\s*' + NUM)


def to_amount(number, k):
    value = Decimal(number.replace(',', ''))
    return value * 1000 if k else value


def parse_budget(text):
    """Returns (low, high). Either can be None."""
    m = BETWEEN.search(text)
    if m:
        a = to_amount(m.group(1), m.group(2))
        b = to_amount(m.group(3), m.group(4))
        return min(a, b), max(a, b)

    low = high = None
    m = HIGH.search(text)
    if m:
        high = to_amount(m.group(1), m.group(2))
    m = LOW.search(text)
    if m:
        low = to_amount(m.group(1), m.group(2))

    if low is None and high is None:
        m = AROUND.search(text)
        if m:
            value = to_amount(m.group(1), m.group(2))
            return value * Decimal('0.7'), value * Decimal('1.3')
        m = BARE.search(text)
        if m:
            high = to_amount(m.group(1), m.group(2))

    return low, high


def money(value):
    digits = str(int(value))
    if len(digits) > 3:
        head, tail = digits[:-3], digits[-3:]
        head = re.sub(r'(\d)(?=(\d\d)+$)', r'\1,', head)
        digits = head + ',' + tail
    return '₹' + digits


# ---------- Finding products ----------

def find_categories(token_set):
    found = []
    for category in Category.objects.all():
        words = CATEGORY_WORDS.get(category.slug, set())
        if token_set & words or category.slug in token_set or category.name.lower() in token_set:
            found.append(category)
    return found


def score(product, words):
    name = product.name.lower()
    description = (product.description or '').lower()
    category = product.category.name.lower()
    total = 0
    for word in words:
        stem = word[:-1] if len(word) > 3 and word.endswith('s') else word
        if stem in name:
            total += 3
        elif stem in category:
            total += 2
        elif stem in description:
            total += 1
    return total


def rating_of(product):
    return float(product.avg_rating or 0)


def discount_of(product):
    return float((product.old_price - product.price) / product.old_price)


def range_text(low, high):
    if low is not None and high is not None:
        return f'between {money(low)} and {money(high)}'
    if high is not None:
        return f'under {money(high)}'
    if low is not None:
        return f'above {money(low)}'
    return ''


def reply(text, products=None):
    return {'reply': text, 'products': products or [], 'suggestions': SUGGESTIONS}


def no_results(categories, low, high):
    cheapest = Product.objects.filter(stock__gt=0)
    if categories:
        cheapest = cheapest.filter(category__in=categories)
    cheapest = cheapest.order_by('price').first()

    if cheapest and (low is not None or high is not None):
        where = ' in ' + ' and '.join(c.name for c in categories) if categories else ''
        return reply(
            f'I could not find anything {range_text(low, high)}{where}. '
            f'The lowest price there is {money(cheapest.price)} for {cheapest.name}.',
            [cheapest],
        )

    return reply(
        'I could not find a match for that. Try a product type like headphones, '
        'a watch or a charger, and add a budget like “under ₹2,000” if you like.'
    )


# ---------- The main function ----------

def answer(message):
    text = message.lower()
    tokens = re.findall(r'[a-z0-9]+', text)
    token_set = set(tokens)

    low, high = parse_budget(text)
    categories = find_categories(token_set)
    type_words = [t for t in tokens if t in TYPE_WORDS]
    keywords = [
        t for t in tokens
        if t not in STOPWORDS
        and t not in ALL_CATEGORY_WORDS
        and not re.fullmatch(r'\d+k?', t)
        and len(t) > 2
    ]

    wants_cheapest = bool(token_set & CHEAPEST)
    wants_best = bool(token_set & BEST)
    wants_deals = bool(token_set & DEALS)

    has_product_signal = bool(
        categories or type_words or keywords
        or low is not None or high is not None
        or wants_cheapest or wants_best or wants_deals
    )

    # Greetings, thanks and shop questions
    if not has_product_signal:
        if token_set & THANKS:
            return reply('You are welcome! Let me know if you would like to see anything else.')
        for topic, words in FAQ_WORDS.items():
            if token_set & words:
                return reply(FAQ_ANSWERS[topic])
        if token_set & GREETING:
            return reply(
                'Hi! I am the ShopSphere assistant. Tell me what you are looking for, '
                'for example a product type and a budget.'
            )
        return reply(
            'I can help you find products. Try something like “headphones under ₹1,500”, '
            '“best rated watch” or “any deals?”.'
        )

    # Search the shop
    queryset = (
        Product.objects.select_related('category')
        .filter(stock__gt=0)
        .annotate(avg_rating=Avg('reviews__rating'), review_count=Count('reviews'))
    )
    if categories:
        queryset = queryset.filter(category__in=categories)
    if low is not None:
        queryset = queryset.filter(price__gte=low)
    if high is not None:
        queryset = queryset.filter(price__lte=high)
    products = list(queryset)

    deals = []
    if wants_deals:
        deals = [p for p in products if p.old_price and p.old_price > p.price]
        if deals:
            products = deals
        else:
            wants_cheapest = True  # no discounts: show the most affordable instead

    rank_words = keywords + type_words
    scores = {}
    loose = False
    if rank_words:
        scores = {p.id: score(p, rank_words) for p in products}
        matched = [p for p in products if scores[p.id] > 0]
        if matched:
            products = matched
        elif categories or low is not None or high is not None:
            loose = True
        else:
            products = []

    if wants_cheapest:
        products.sort(key=lambda p: (p.price, -rating_of(p)))
    elif deals:
        products.sort(key=lambda p: -discount_of(p))
    elif wants_best:
        products.sort(key=lambda p: (-rating_of(p), -p.review_count, p.price))
    else:
        products.sort(key=lambda p: (-scores.get(p.id, 0), -rating_of(p), p.price))

    shown = products[:MAX_RESULTS]
    if not shown:
        return no_results(categories, low, high)

    # Write the answer
    bits = []
    if categories:
        bits.append('in ' + ' and '.join(c.name for c in categories))
    if range_text(low, high):
        bits.append(range_text(low, high))
    where = (' ' + ' '.join(bits)) if bits else ''

    n = len(shown)
    if loose:
        lead = 'I could not find an exact match, but here ' + ('is one option' if n == 1 else 'are some options')
    elif deals:
        lead = 'Here are the current deals'
    elif wants_cheapest and wants_deals:
        lead = 'There are no discounted items right now. Here are the most affordable options'
    elif wants_cheapest:
        lead = 'Here are the most affordable options'
    elif wants_best:
        lead = 'Here are our top rated picks'
    else:
        lead = f'I found {n} option' + ('' if n == 1 else 's')

    return reply(f'{lead}{where}:', shown)