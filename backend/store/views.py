from django.contrib.auth import authenticate
from rest_framework import generics
from rest_framework.authtoken.models import Token
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Category, Product, Order
from .serializers import (
    CategorySerializer, ProductSerializer,
    RegisterSerializer, UserSerializer,
    OrderSerializer, PlaceOrderSerializer,
)


class CategoryListView(generics.ListAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer


class ProductPagination(PageNumberPagination):
    """Sends products in pages: ?page=2&page_size=8"""
    page_size = 8
    page_size_query_param = 'page_size'
    max_page_size = 24


class ProductListView(generics.ListAPIView):
    serializer_class = ProductSerializer
    pagination_class = ProductPagination

    # ?sort=newest | price_asc | price_desc | name
    SORTS = {
        'newest': ('-created_at', '-id'),
        'price_asc': ('price', 'id'),
        'price_desc': ('-price', '-id'),
        'name': ('name', 'id'),
    }

    def get_queryset(self):
        queryset = Product.objects.select_related('category')

        category = self.request.query_params.get('category')
        featured = self.request.query_params.get('featured')
        search = self.request.query_params.get('search')
        sort = self.request.query_params.get('sort', 'newest')
        ids = self.request.query_params.get('ids')

        if category:
            queryset = queryset.filter(category__slug=category)
        if featured == 'true':
            queryset = queryset.filter(is_featured=True)
        if search:
            queryset = queryset.filter(name__icontains=search) 
        if ids:
            id_list = [int(i) for i in ids.split(',') if i.strip().isdigit()]
            queryset = queryset.filter(id__in=id_list)

        return queryset.order_by(*self.SORTS.get(sort, self.SORTS['newest']))


class ProductDetailView(generics.RetrieveAPIView):
    queryset = Product.objects.select_related('category')
    serializer_class = ProductSerializer
    lookup_field = 'slug'


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {'token': token.key, 'user': UserSerializer(user).data},
            status=201,
        )


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        password = request.data.get('password', '')

        user = authenticate(request, username=email, password=password)
        if user is None:
            return Response({'detail': 'Invalid email or password.'}, status=401)

        token, _ = Token.objects.get_or_create(user=user)
        return Response({'token': token.key, 'user': UserSerializer(user).data})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class OrderListCreateView(generics.ListCreateAPIView):
    """GET: the signed-in user's orders. POST: place a new order."""
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Order.objects.filter(user=self.request.user).prefetch_related('items')

    def get_serializer_class(self):
        return PlaceOrderSerializer if self.request.method == 'POST' else OrderSerializer

    def create(self, request, *args, **kwargs):
        serializer = PlaceOrderSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        return Response(OrderSerializer(order).data, status=201)


class OrderDetailView(generics.RetrieveAPIView):
    """One order. Users can only open their own."""
    permission_classes = [IsAuthenticated]
    serializer_class = OrderSerializer

    def get_queryset(self):
        return Order.objects.filter(user=self.request.user).prefetch_related('items')