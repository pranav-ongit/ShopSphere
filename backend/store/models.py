from django.db import models
from django.conf import settings


class Category(models.Model):
    name = models.CharField(max_length=80)
    slug = models.SlugField(unique=True)

    class Meta:
        verbose_name_plural = 'categories'

    def __str__(self):
        return self.name


class Product(models.Model):
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='products')
    name = models.CharField(max_length=150)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    old_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    image = models.ImageField(upload_to='products/', blank=True)
    stock = models.PositiveIntegerField(default=0)
    is_featured = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class Order(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        PAID = 'paid', 'Paid'
        SHIPPED = 'shipped', 'Shipped'
        DELIVERED = 'delivered', 'Delivered'
        CANCELLED = 'cancelled', 'Cancelled'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='orders')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)

    full_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=15)
    address = models.CharField(max_length=255)
    city = models.CharField(max_length=80)
    state = models.CharField(max_length=80)
    pincode = models.CharField(max_length=6)

    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Order #{self.pk} by {self.user.email}'


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True)
    name = models.CharField(max_length=150)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveIntegerField(default=1)

    def __str__(self):
        return f'{self.quantity} x {self.name}'