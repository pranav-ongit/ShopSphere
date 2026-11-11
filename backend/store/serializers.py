from decimal import Decimal

from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from rest_framework import serializers
from .models import Category, Product, Order, OrderItem, Review


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug']


class ProductSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    rating = serializers.SerializerMethodField()
    review_count = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'slug', 'description', 'price',
            'old_price', 'image', 'stock', 'is_featured', 'category',
            'rating', 'review_count',
        ]

    # avg_rating and review_count are added by the views (see with_ratings)
    def get_rating(self, obj):
        value = getattr(obj, 'avg_rating', None)
        return round(value, 1) if value else None

    def get_review_count(self, obj):
        return getattr(obj, 'review_count', 0)


class RegisterSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate_email(self, value):
        value = value.lower()
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data['email'],
            email=validated_data['email'],
            first_name=validated_data['name'],
            password=validated_data['password'],
        )


class UserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source='first_name')

    class Meta:
        model = User
        fields = ['id', 'name', 'email']


# ---------- Orders ----------

class OrderItemSerializer(serializers.ModelSerializer):
    line_total = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = ['id', 'product', 'name', 'price', 'quantity', 'line_total']

    def get_line_total(self, obj):
        return obj.price * obj.quantity


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'status', 'full_name', 'phone', 'address', 'city',
            'state', 'pincode', 'total', 'created_at', 'items',
        ]


class OrderItemInputSerializer(serializers.Serializer):
    product = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1, max_value=20)


class PlaceOrderSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=100)
    phone = serializers.RegexField(
        r'^\+?\d{10,13}$', max_length=15,
        error_messages={'invalid': 'Enter a valid phone number.'},
    )
    address = serializers.CharField(max_length=255)
    city = serializers.CharField(max_length=80)
    state = serializers.CharField(max_length=80)
    pincode = serializers.RegexField(
        r'^\d{6}$', max_length=6,
        error_messages={'invalid': 'Enter a valid 6-digit pincode.'},
    )
    items = OrderItemInputSerializer(many=True, allow_empty=False)

    def create(self, validated_data):
        user = self.context['request'].user
        items_data = validated_data.pop('items')

        # If the same product appears twice, add the quantities together
        quantities = {}
        for item in items_data:
            pid = item['product']
            quantities[pid] = quantities.get(pid, 0) + item['quantity']

        # Everything inside this block succeeds together or not at all
        with transaction.atomic():
            products = Product.objects.select_for_update().filter(id__in=quantities.keys())
            found = {p.id: p for p in products}

            problems = []
            for pid, qty in quantities.items():
                product = found.get(pid)
                if product is None:
                    problems.append(f'Product {pid} no longer exists.')
                elif product.stock == 0:
                    problems.append(f'{product.name} is out of stock.')
                elif product.stock < qty:
                    problems.append(f'Only {product.stock} of {product.name} left.')
            if problems:
                raise serializers.ValidationError({'items': problems})

            order = Order.objects.create(user=user, **validated_data)

            total = Decimal('0')
            for pid, qty in quantities.items():
                product = found[pid]
                OrderItem.objects.create(
                    order=order,
                    product=product,
                    name=product.name,
                    price=product.price,
                    quantity=qty,
                )
                product.stock -= qty
                product.save(update_fields=['stock'])
                total += product.price * qty

            order.total = total
            order.save(update_fields=['total'])

        return order


# ---------- Reviews ----------

class ReviewSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    verified = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = ['id', 'rating', 'comment', 'name', 'verified', 'created_at']

    def get_name(self, obj):
        # Show the first name and the first letter of the last name only
        parts = (obj.user.first_name or 'Customer').split()
        if len(parts) > 1:
            return f'{parts[0]} {parts[-1][0]}.'
        return parts[0]

    def get_verified(self, obj):
        # A verified review comes from someone who really ordered this product
        return (
            OrderItem.objects
            .filter(order__user=obj.user, product=obj.product)
            .exclude(order__status=Order.Status.CANCELLED)
            .exists()
        )


class ReviewInputSerializer(serializers.Serializer):
    rating = serializers.IntegerField(min_value=1, max_value=5)
    comment = serializers.CharField(required=False, allow_blank=True, max_length=1000)