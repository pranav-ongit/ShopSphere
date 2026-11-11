from django.contrib import admin
from .models import Category, Product, Order, OrderItem, Review

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'price', 'stock', 'is_featured')
    list_filter = ('category', 'is_featured')
    search_fields = ('name',)
    prepopulated_fields = {'slug': ('name',)}


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0


@admin.action(description='Mark selected orders as paid')
def mark_paid(modeladmin, request, queryset):
    queryset.update(status=Order.Status.PAID)


@admin.action(description='Mark selected orders as shipped')
def mark_shipped(modeladmin, request, queryset):
    queryset.update(status=Order.Status.SHIPPED)


@admin.action(description='Mark selected orders as delivered')
def mark_delivered(modeladmin, request, queryset):
    queryset.update(status=Order.Status.DELIVERED)


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'status', 'total', 'created_at')
    list_editable = ('status',)
    list_filter = ('status',)
    search_fields = ('user__email', 'full_name')
    inlines = [OrderItemInline]
    actions = [mark_paid, mark_shipped, mark_delivered]
    
@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ('product', 'user', 'rating', 'created_at')
    list_filter = ('rating',)
    search_fields = ('product__name', 'user__email', 'comment')