from django.urls import path
from api.v1.views import (
    RegisterView, LoginView, LogoutView, CheckUsernameView, VerifyEmailView,
    PasswordResetView, PasswordResetConfirmView, UserProfileView, UserMeView,
    UserPostsView, UserFollowersView, UserFollowingView, UserFollowToggleView,
    FollowRequestListView, FollowRequestActionView, UserSuggestedView, UserSearchView,
    PostCreateView, PostDetailView, FeedView, ExploreView, TagPostsView,
    PostLikeToggleView, PostLikersView, CommentListView, CommentDeleteView,
    CommentLikeToggleView, NotificationListView, NotificationReadView
)

app_name = 'api_v1'

urlpatterns = [
    # Auth
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/check-username/', CheckUsernameView.as_view(), name='check-username'),
    path('auth/verify-email/<str:token>/', VerifyEmailView.as_view(), name='verify-email'),
    path('auth/password/reset/', PasswordResetView.as_view(), name='password-reset'),
    path('auth/password/reset/confirm/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),

    # Users
    path('users/me/', UserMeView.as_view(), name='user-me'),
    path('users/suggested/', UserSuggestedView.as_view(), name='user-suggested'),
    path('users/search/', UserSearchView.as_view(), name='user-search'),
    path('users/follow-requests/', FollowRequestListView.as_view(), name='follow-requests-list'),
    path('users/follow-requests/<int:pk>/', FollowRequestActionView.as_view(), name='follow-request-action'),
    path('users/<str:username>/', UserProfileView.as_view(), name='user-profile'),
    path('users/<str:username>/posts/', UserPostsView.as_view(), name='user-posts'),
    path('users/<str:username>/followers/', UserFollowersView.as_view(), name='user-followers'),
    path('users/<str:username>/following/', UserFollowingView.as_view(), name='user-following'),
    path('users/<str:username>/follow/', UserFollowToggleView.as_view(), name='user-follow-toggle'),

    # Posts
    path('feed/', FeedView.as_view(), name='feed'),
    path('explore/', ExploreView.as_view(), name='explore'),
    path('explore/tags/<str:tag>/', TagPostsView.as_view(), name='tag-posts'),
    path('posts/', PostCreateView.as_view(), name='post-create'),
    path('posts/<uuid:pk>/', PostDetailView.as_view(), name='post-detail'),
    path('posts/<uuid:pk>/like/', PostLikeToggleView.as_view(), name='post-like-toggle'),
    path('posts/<uuid:pk>/likes/', PostLikersView.as_view(), name='post-likers'),

    # Comments
    path('posts/<uuid:pk>/comments/', CommentListView.as_view(), name='comment-list-create'),
    path('comments/<uuid:pk>/', CommentDeleteView.as_view(), name='comment-delete'),
    path('comments/<uuid:pk>/like/', CommentLikeToggleView.as_view(), name='comment-like-toggle'),

    # Notifications
    path('notifications/', NotificationListView.as_view(), name='notifications-list'),
    path('notifications/read/', NotificationReadView.as_view(), name='notifications-mark-read'),
    path('notifications/<uuid:pk>/read/', NotificationReadView.as_view(), name='notification-mark-single-read'),
]
