from rest_framework import generics
from .models import Category, Product
from .serializers import CategorySerializer, ProductSerializer


class CategoryListView(generics.ListAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer


class ProductListView(generics.ListAPIView):
    serializer_class = ProductSerializer

    def get_queryset(self):
        queryset = Product.objects.select_related('category')

        category = self.request.query_params.get('category')
        featured = self.request.query_params.get('featured')
        search = self.request.query_params.get('search')

        if category:
            queryset = queryset.filter(category__slug=category)
        if featured == 'true':
            queryset = queryset.filter(is_featured=True)
        if search:
            queryset = queryset.filter(name__icontains=search)

        return queryset


class ProductDetailView(generics.RetrieveAPIView):
    queryset = Product.objects.select_related('category')
    serializer_class = ProductSerializer
    lookup_field = 'slug'