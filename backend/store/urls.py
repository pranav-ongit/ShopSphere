from django.urls import path
from .views import (
    CategoryListView, ProductListView, ProductDetailView, ProductReviewsView,
    RegisterView, LoginView, MeView,
    OrderListCreateView, OrderDetailView,
)

urlpatterns = [
    path('categories/', CategoryListView.as_view()),
    path('products/', ProductListView.as_view()),
    path('products/<slug:slug>/', ProductDetailView.as_view()),
    path('products/<slug:slug>/reviews/', ProductReviewsView.as_view()),
    path('auth/register/', RegisterView.as_view()),
    path('auth/login/', LoginView.as_view()),
    path('auth/me/', MeView.as_view()),
    path('orders/', OrderListCreateView.as_view()),
    path('orders/<int:pk>/', OrderDetailView.as_view()),
]