from django.contrib.auth import authenticate
from django.db.models import Avg, Count
from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.authtoken.models import Token
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import AnonRateThrottle
from .assistant import answer

from .models import Category, Product, Order, Review
from .serializers import (
    CategorySerializer, ProductSerializer,
    RegisterSerializer, UserSerializer,
    OrderSerializer, PlaceOrderSerializer,
    ReviewSerializer, ReviewInputSerializer,
)


def with_ratings(queryset):
    """Adds the average rating and the number of reviews to each product."""
    return queryset.annotate(
        avg_rating=Avg('reviews__rating'),
        review_count=Count('reviews'),
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
        queryset = with_ratings(Product.objects.select_related('category'))

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
    queryset = with_ratings(Product.objects.select_related('category'))
    serializer_class = ProductSerializer
    lookup_field = 'slug'


class ReviewPagination(PageNumberPagination):
    page_size = 5
    page_size_query_param = 'page_size'
    max_page_size = 20


class ProductReviewsView(generics.ListCreateAPIView):
    """GET: reviews of one product (public). POST: write or update your review."""
    pagination_class = ReviewPagination

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated()]
        return [AllowAny()]

    def get_product(self):
        return get_object_or_404(Product, slug=self.kwargs['slug'])

    def get_queryset(self):
        return Review.objects.filter(product=self.get_product()).select_related('user', 'product')

    def get_serializer_class(self):
        return ReviewInputSerializer if self.request.method == 'POST' else ReviewSerializer

    def create(self, request, *args, **kwargs):
        product = self.get_product()
        serializer = ReviewInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # One review per person per product: posting again updates it
        review, created = Review.objects.update_or_create(
            product=product,
            user=request.user,
            defaults={
                'rating': serializer.validated_data['rating'],
                'comment': serializer.validated_data.get('comment', '').strip(),
            },
        )
        return Response(ReviewSerializer(review).data, status=201 if created else 200)


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
    
class AssistantThrottle(AnonRateThrottle):
    rate = '30/min'


class AssistantView(APIView):
    """POST {"message": "..."} and get a reply with product suggestions."""
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [AssistantThrottle]

    def post(self, request):
        message = str(request.data.get('message', '')).strip()[:300]
        if not message:
            return Response({'detail': 'Please type a message.'}, status=400)

        result = answer(message)
        products = ProductSerializer(
            result['products'], many=True, context={'request': request}
        ).data
        return Response({
            'reply': result['reply'],
            'products': products,
            'suggestions': result['suggestions'],
        })