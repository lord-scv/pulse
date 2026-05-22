import logging
from datetime import datetime, timedelta
from django.utils import timezone
from django.contrib.auth import get_user_model, login, logout
from django.core.cache import cache
from django.core.signing import TimestampSigner, SignatureExpired, BadSignature
from django.db import transaction, models
from django.db.models import Q, F
from django.shortcuts import get_object_or_404
from rest_framework import status, permissions, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.pagination import CursorPagination, PageNumberPagination

from apps.users.models import Follow, FollowRequest
from apps.posts.models import Post, Hashtag, PostHashtag, PostMention
from apps.comments.models import Comment
from apps.likes.models import PostLike, CommentLike
from apps.notifications.models import Notification

from api.v1.serializers import (
    UserSerializer, UserMiniSerializer, RegisterSerializer, UserUpdateSerializer,
    FollowRequestSerializer, PostSerializer, CommentSerializer, NotificationSerializer
)

User = get_user_model()
signer = TimestampSigner()
logger = logging.getLogger(__name__)

# --- PERMISSIONS ---

class IsEmailVerified(permissions.BasePermission):
    """
    Allows access only to users who have verified their email for write actions.
    """
    message = "You must verify your email address before performing this action."
    code = "email_unverified"

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_authenticated and request.user.is_verified_email


# --- AUTH VIEWS ---

class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            
            # Log the user in immediately
            login(request, user)
            
            # Generate email verification token
            token = signer.sign(str(user.id))
            verification_url = f"{request.build_absolute_uri('/api/v1/auth/verify-email/')}{token}/"
            
            # Mock sending email in console
            print("\n" + "="*50)
            print(f"EMAIL TO: {user.email}")
            print("SUBJECT: Verify your Pulse Account")
            print(f"LINK: {verification_url}")
            print("="*50 + "\n")
            
            serializer_user = UserSerializer(user, context={'request': request})
            return Response(serializer_user.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username_or_email = request.data.get('username') or request.data.get('email')
        password = request.data.get('password')
        remember_me = request.data.get('remember_me', False)

        if not username_or_email or not password:
            return Response(
                {"error": {"code": "validation_error", "message": "Username/email and password are required."}},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Rate Limiting: 5 attempts lock for 15 mins
        lock_key = f"login_lock_{username_or_email}"
        attempts_key = f"login_attempts_{username_or_email}"
        
        lock_duration = cache.get(lock_key)
        if lock_duration:
            # Check if still locked
            remaining = int((lock_duration - timezone.now()).total_seconds() / 60)
            if remaining <= 0:
                cache.delete(lock_key)
                cache.delete(attempts_key)
            else:
                return Response(
                    {"error": {"code": "account_locked", "message": f"Too many failed attempts. Try again in {remaining} minutes."}},
                    status=status.HTTP_423_LOCKED
                )

        # Authenticate (support both username and email)
        user = None
        if '@' in username_or_email:
            try:
                user_obj = User.objects.get(email=username_or_email)
                if user_obj.check_password(password):
                    user = user_obj
            except User.DoesNotExist:
                pass
        else:
            try:
                user_obj = User.objects.get(username=username_or_email)
                if user_obj.check_password(password):
                    user = user_obj
            except User.DoesNotExist:
                pass

        if user is not None:
            if not user.is_active:
                return Response(
                    {"error": {"code": "inactive_account", "message": "This account is deactivated."}},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Reset rate limits
            cache.delete(attempts_key)
            cache.delete(lock_key)
            
            login(request, user)
            
            # Session duration
            if remember_me:
                request.session.set_expiry(30 * 24 * 3600)  # 30 days
            else:
                request.session.set_expiry(24 * 3600)  # 24 hours
                
            # Update last active
            user.last_active = timezone.now()
            user.save(update_fields=['last_active'])
            
            serializer = UserSerializer(user, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)
        else:
            # Increment attempts
            attempts = cache.get(attempts_key, 0) + 1
            cache.set(attempts_key, attempts, 3600) # expiry 1 hour
            
            if attempts >= 5:
                # Lockout for 15 mins
                lock_until = timezone.now() + timedelta(minutes=15)
                cache.set(lock_key, lock_until, 900)
                return Response(
                    {"error": {"code": "account_locked", "message": "Too many failed attempts. Account locked for 15 minutes."}},
                    status=status.HTTP_423_LOCKED
                )
                
            return Response(
                {"error": {"code": "invalid_credentials", "message": "Invalid username/email or password."}},
                status=status.HTTP_400_BAD_REQUEST
            )


class LogoutView(APIView):
    def post(self, request):
        logout(request)
        return Response({"message": "Successfully logged out."}, status=status.HTTP_200_OK)


from django.core.exceptions import ValidationError

class CheckUsernameView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        username = request.query_params.get('username', '').strip()
        
        # Run Django model-level field validators for the username
        try:
            username_field = User._meta.get_field('username')
            username_field.clean(username, None)
        except ValidationError as e:
            return Response({"available": False, "message": e.messages[0]}, status=status.HTTP_200_OK)
            
        exists = User.objects.filter(username__iexact=username).exists()
        if exists:
            return Response({"available": False, "message": "This username is already taken."}, status=status.HTTP_200_OK)
            
        return Response({"available": True}, status=status.HTTP_200_OK)


class VerifyEmailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, token):
        try:
            user_id = signer.unsign(token, max_age=86400) # Valid for 24 hours
            user = User.objects.get(id=user_id)
            user.is_verified_email = True
            user.save()
            return Response({"message": "Email verified successfully!"}, status=status.HTTP_200_OK)
        except (SignatureExpired, BadSignature, User.DoesNotExist):
            return Response(
                {"error": {"code": "invalid_token", "message": "The verification link is invalid or expired."}},
                status=status.HTTP_400_BAD_REQUEST
            )


class PasswordResetView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email')
        if not email:
            return Response(
                {"error": {"code": "validation_error", "message": "Email is required."}},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            user = User.objects.get(email=email)
            # Create a password reset token
            token = signer.sign(str(user.id))
            reset_url = f"{request.build_absolute_uri('/api/v1/auth/password/reset/confirm/')}{token}/"
            
            # Print mock email link in console
            print("\n" + "="*50)
            print(f"EMAIL TO: {user.email}")
            print("SUBJECT: Reset your Pulse Password")
            print(f"LINK: {reset_url}")
            print("="*50 + "\n")
        except User.DoesNotExist:
            pass # Silent failure to avoid user enumeration
            
        return Response({"message": "Password reset email sent if account exists."}, status=status.HTTP_200_OK)


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        token = request.data.get('token')
        password = request.data.get('password')
        
        if not token or not password:
            return Response(
                {"error": {"code": "validation_error", "message": "Token and password are required."}},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        try:
            user_id = signer.unsign(token, max_age=3600)  # Reset link valid for 1 hour
            user = User.objects.get(id=user_id)
            user.set_password(password)
            user.save()
            return Response({"message": "Password reset successfully."}, status=status.HTTP_200_OK)
        except (SignatureExpired, BadSignature, User.DoesNotExist):
            return Response(
                {"error": {"code": "invalid_token", "message": "The password reset link is invalid or expired."}},
                status=status.HTTP_400_BAD_REQUEST
            )


# --- USERS VIEWS ---

class UserProfileView(generics.RetrieveAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    lookup_field = 'username'
    lookup_url_kwarg = 'username'


class UserMeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserUpdateSerializer

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        if self.request.method == 'GET':
            return UserSerializer
        return UserUpdateSerializer

    def delete(self, request):
        username_confirm = request.data.get('username_confirm')
        if not username_confirm or username_confirm != request.user.username:
            return Response(
                {"error": {"code": "validation_error", "message": "Please type your username correctly to confirm account deletion."}},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        user = request.user
        logout(request)
        user.delete()
        return Response({"message": "Account successfully deleted."}, status=status.HTTP_200_OK)


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 12
    page_size_query_param = 'page_size'
    max_page_size = 100


class UserPostsView(generics.ListAPIView):
    serializer_class = PostSerializer
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        username = self.kwargs['username']
        target_user = get_object_or_404(User, username=username)
        
        # Check permissions for private profile
        if target_user.is_private and target_user != self.request.user:
            is_following = Follow.objects.filter(
                follower=self.request.user,
                following=target_user,
                status='ACTIVE'
            ).exists()
            if not is_following:
                raise permissions.exceptions.PermissionDenied(
                    detail="This account is private. Follow them to see their posts."
                )
                
        return Post.objects.filter(author=target_user)


class UserFollowersView(generics.ListAPIView):
    serializer_class = UserMiniSerializer
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        username = self.kwargs['username']
        target_user = get_object_or_404(User, username=username)
        return User.objects.filter(
            follower_relations__following=target_user,
            follower_relations__status='ACTIVE'
        )


class UserFollowingView(generics.ListAPIView):
    serializer_class = UserMiniSerializer
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        username = self.kwargs['username']
        target_user = get_object_or_404(User, username=username)
        return User.objects.filter(
            following_relations__follower=target_user,
            following_relations__status='ACTIVE'
        )


class UserFollowToggleView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsEmailVerified]

    @transaction.atomic
    def post(self, request, username):
        target_user = get_object_or_404(User, username=username)
        if target_user == request.user:
            return Response(
                {"error": {"code": "invalid_action", "message": "You cannot follow yourself."}},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Check if follow already exists
        follow = Follow.objects.filter(follower=request.user, following=target_user).first()
        if follow:
            return Response({"status": follow.status, "message": f"Already followed/requested. Status: {follow.status}"}, status=status.HTTP_200_OK)
            
        if target_user.is_private:
            # Create Follow PENDING
            Follow.objects.create(follower=request.user, following=target_user, status='PENDING')
            FollowRequest.objects.create(requester=request.user, target=target_user, status='PENDING')
            
            # Send Notification
            Notification.objects.create(
                recipient=target_user,
                actor=request.user,
                type='FOLLOW_REQUEST'
            )
            return Response({"status": "PENDING", "message": "Follow request sent."}, status=status.HTTP_201_CREATED)
        else:
            # Create Follow ACTIVE
            Follow.objects.create(follower=request.user, following=target_user, status='ACTIVE')
            
            # Send Notification
            Notification.objects.create(
                recipient=target_user,
                actor=request.user,
                type='FOLLOW'
            )
            return Response({"status": "ACTIVE", "message": f"You are now following {target_user.username}."}, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def delete(self, request, username):
        target_user = get_object_or_404(User, username=username)
        
        # Unfollow deletes Follow relations and FollowRequests
        deleted_follow, _ = Follow.objects.filter(follower=request.user, following=target_user).delete()
        FollowRequest.objects.filter(requester=request.user, target=target_user).delete()
        
        return Response({"message": f"Successfully unfollowed {target_user.username}."}, status=status.HTTP_200_OK)


class FollowRequestListView(generics.ListAPIView):
    serializer_class = FollowRequestSerializer

    def get_queryset(self):
        return FollowRequest.objects.filter(target=self.request.user, status='PENDING')


class FollowRequestActionView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsEmailVerified]

    @transaction.atomic
    def post(self, request, pk):
        action = request.data.get('action') # 'accept' or 'decline'
        follow_request = get_object_or_404(FollowRequest, id=pk, target=request.user, status='PENDING')
        
        if action == 'accept':
            follow_request.status = 'ACCEPTED'
            follow_request.save()
            
            # Set Follow status to ACTIVE
            follow = Follow.objects.filter(follower=follow_request.requester, following=request.user).first()
            if follow:
                follow.status = 'ACTIVE'
                follow.save()
            else:
                Follow.objects.create(follower=follow_request.requester, following=request.user, status='ACTIVE')
                
            # Create notification back to requester
            Notification.objects.create(
                recipient=follow_request.requester,
                actor=request.user,
                type='FOLLOW_ACCEPT'
            )
            return Response({"message": "Follow request accepted."}, status=status.HTTP_200_OK)
            
        elif action == 'decline':
            follow_request.status = 'DECLINED'
            follow_request.save()
            
            # Delete pending Follow relation
            Follow.objects.filter(follower=follow_request.requester, following=request.user).delete()
            
            return Response({"message": "Follow request declined."}, status=status.HTTP_200_OK)
            
        return Response(
            {"error": {"code": "validation_error", "message": "Invalid action. Must be 'accept' or 'decline'."}},
            status=status.HTTP_400_BAD_REQUEST
        )


class UserSuggestedView(generics.ListAPIView):
    serializer_class = UserMiniSerializer

    def get_queryset(self):
        user = self.request.user
        # Find following user IDs
        following_ids = Follow.objects.filter(follower=user, status='ACTIVE').values_list('following_id', flat=True)
        
        # Get users followed by friends-of-friends, excluding already followed and self
        suggested = User.objects.filter(
            follower_relations__follower_id__in=following_ids,
            follower_relations__status='ACTIVE'
        ).exclude(
            id=user.id
        ).exclude(
            id__in=following_ids
        ).distinct()[:5]

        # Convert to list to check length
        suggested_list = list(suggested)
        
        # Seed fallback public profiles if suggested count is less than 5
        if len(suggested_list) < 5:
            fallback = User.objects.exclude(
                id=user.id
            ).exclude(
                id__in=following_ids
            ).exclude(
                id__in=[u.id for u in suggested_list]
            ).order_by('?')[:5 - len(suggested_list)]
            suggested_list.extend(list(fallback))
            
        return suggested_list


class UserSearchView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        if not query:
            return Response({"users": [], "hashtags": []}, status=status.HTTP_200_OK)
            
        # Search users
        users = User.objects.filter(
            Q(username__icontains=query) | Q(display_name__icontains=query)
        ).distinct()[:20]
        users_serializer = UserMiniSerializer(users, many=True, context={'request': request})
        
        # Search hashtags
        hashtags = Hashtag.objects.filter(tag__icontains=query.replace('#', ''))[:20]
        hashtag_results = []
        for tag in hashtags:
            # Top 3 post thumbnails previews
            posts = Post.objects.filter(hashtags=tag, author__is_private=False)[:3]
            thumbnails = [p.image.url for p in posts if p.image]
            hashtag_results.append({
                "tag": tag.tag,
                "post_count": tag.post_count,
                "thumbnails": thumbnails
            })
            
        return Response({
            "users": users_serializer.data,
            "hashtags": hashtag_results
        }, status=status.HTTP_200_OK)


# --- POSTS & FEED VIEWS ---

class PostCreateView(generics.CreateAPIView):
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticated, IsEmailVerified]


class PostDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Post.objects.all()
    serializer_class = PostSerializer
    
    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated(), IsEmailVerified()]

    def update(self, request, *args, **kwargs):
        # Only caption can be edited as per PRD
        post = self.get_object()
        if post.author != request.user:
            return Response(
                {"error": {"code": "permission_denied", "message": "You can only edit your own posts."}},
                status=status.HTTP_403_FORBIDDEN
            )
        caption = request.data.get('caption')
        post.caption = caption
        post.save()
        
        # Re-parse hashtags and mentions (first clean old links, then re-add)
        with transaction.atomic():
            # Decrement hashtag post counts before deleting
            for ht in post.hashtags.all():
                ht.post_count = max(0, ht.post_count - 1)
                ht.save()
            PostHashtag.objects.filter(post=post).delete()
            PostMention.objects.filter(post=post).delete()
            
            # Run parser
            serializer = self.get_serializer(post)
            serializer._parse_hashtags_and_mentions(post, caption)
            
        serializer = self.get_serializer(post)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        post = self.get_object()
        if post.author != request.user:
            return Response(
                {"error": {"code": "permission_denied", "message": "You can only delete your own posts."}},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)


class FeedCursorPagination(CursorPagination):
    page_size = 10
    ordering = '-created_at'


class FeedView(generics.ListAPIView):
    serializer_class = PostSerializer
    pagination_class = FeedCursorPagination

    def get_queryset(self):
        user = self.request.user
        # Get posts from people followed (status active) + own posts
        following_ids = Follow.objects.filter(follower=user, status='ACTIVE').values_list('following_id', flat=True)
        return Post.objects.filter(
            Q(author__in=following_ids) | Q(author=user)
        ).select_related('author')


class ExploreView(generics.ListAPIView):
    serializer_class = PostSerializer
    pagination_class = StandardResultsSetPagination
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        # Public accounts posts ranked by engagement (likes + comments) in the last 24h/overall
        # DRF optimizes query
        return Post.objects.filter(author__is_private=False).annotate(
            engagement=F('like_count') + F('comment_count')
        ).order_by('-engagement', '-created_at').select_related('author')


class TagPostsView(generics.ListAPIView):
    serializer_class = PostSerializer
    pagination_class = StandardResultsSetPagination
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        tag_name = self.kwargs['tag'].lower()
        return Post.objects.filter(
            hashtags__tag=tag_name,
            author__is_private=False
        ).select_related('author')


class PostLikeToggleView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsEmailVerified]

    @transaction.atomic
    def post(self, request, pk):
        post = get_object_or_404(Post, id=pk)
        
        # Check if already liked
        like = PostLike.objects.filter(user=request.user, post=post).first()
        if like:
            return Response({"liked": True, "message": "Post already liked."}, status=status.HTTP_200_OK)
            
        PostLike.objects.create(user=request.user, post=post)
        Post.objects.filter(id=post.id).update(like_count=F('like_count') + 1)
        
        # Send Notification to post author
        if post.author != request.user:
            Notification.objects.create(
                recipient=post.author,
                actor=request.user,
                type='LIKE_POST',
                post=post
            )
            
        return Response({"liked": True, "message": "Post liked."}, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def delete(self, request, pk):
        post = get_object_or_404(Post, id=pk)
        deleted, _ = PostLike.objects.filter(user=request.user, post=post).delete()
        if deleted:
            Post.objects.filter(id=post.id).update(like_count=models.Case(
                models.When(like_count__gt=0, then=F('like_count') - 1),
                default=0
            ))
            
        return Response({"liked": False, "message": "Post unliked."}, status=status.HTTP_200_OK)


class PostLikersView(generics.ListAPIView):
    serializer_class = UserMiniSerializer
    pagination_class = StandardResultsSetPagination
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        post_id = self.kwargs['pk']
        return User.objects.filter(post_likes__post_id=post_id)


# --- COMMENTS VIEWS ---

class CommentListView(generics.ListCreateAPIView):
    serializer_class = CommentSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated(), IsEmailVerified()]

    def get_queryset(self):
        post_id = self.kwargs['pk']
        # Fetch top-level comments for the post. Nested replies are fetched inside the serializer
        return Comment.objects.filter(post_id=post_id, parent_comment__isnull=True).select_related('author')

    def perform_create(self, serializer):
        post = get_object_or_404(Post, id=self.kwargs['pk'])
        if post.comments_disabled:
            raise permissions.exceptions.PermissionDenied(detail="Comments are disabled on this post.")
        serializer.save(post=post)


class CommentDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsEmailVerified]

    @transaction.atomic
    def delete(self, request, pk):
        comment = get_object_or_404(Comment, id=pk)
        post = comment.post
        
        # Check permissions: comment author or post owner
        if comment.author != request.user and post.author != request.user:
            return Response(
                {"error": {"code": "permission_denied", "message": "You do not have permission to delete this comment."}},
                status=status.HTTP_403_FORBIDDEN
            )
            
        # Soft delete: if has replies, replace text. Else hard delete.
        has_replies = comment.replies.filter(is_deleted=False).exists()
        if has_replies:
            comment.is_deleted = True
            comment.body = "[Comment removed]"
            comment.save()
        else:
            comment.delete()
            
        # Decrement comment count on post
        Post.objects.filter(id=post.id).update(comment_count=models.Case(
            models.When(comment_count__gt=0, then=F('comment_count') - 1),
            default=0
        ))
        
        return Response({"message": "Comment deleted successfully."}, status=status.HTTP_200_OK)


class CommentLikeToggleView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsEmailVerified]

    @transaction.atomic
    def post(self, request, pk):
        comment = get_object_or_404(Comment, id=pk)
        like = CommentLike.objects.filter(user=request.user, comment=comment).first()
        if like:
            return Response({"liked": True, "message": "Comment already liked."}, status=status.HTTP_200_OK)
            
        CommentLike.objects.create(user=request.user, comment=comment)
        Comment.objects.filter(id=comment.id).update(like_count=F('like_count') + 1)
        
        # Send Notification to comment author
        if comment.author != request.user:
            Notification.objects.create(
                recipient=comment.author,
                actor=request.user,
                type='COMMENT_LIKE',
                comment=comment,
                post=comment.post
            )
            
        return Response({"liked": True, "message": "Comment liked."}, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def delete(self, request, pk):
        comment = get_object_or_404(Comment, id=pk)
        deleted, _ = CommentLike.objects.filter(user=request.user, comment=comment).delete()
        if deleted:
            Comment.objects.filter(id=comment.id).update(like_count=models.Case(
                models.When(like_count__gt=0, then=F('like_count') - 1),
                default=0
            ))
            
        return Response({"liked": False, "message": "Comment unliked."}, status=status.HTTP_200_OK)


# --- NOTIFICATIONS VIEWS ---

class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer

    def get_queryset(self):
        # Only notifications created within 90 days are kept as per PRD (rest is auto pruned)
        ninety_days_ago = timezone.now() - timedelta(days=90)
        
        # Clean older notifications (pruning)
        Notification.objects.filter(recipient=self.request.user, created_at__lt=ninety_days_ago).delete()
        
        return Notification.objects.filter(recipient=self.request.user)

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        unread_count = queryset.filter(is_read=False).count()
        page = self.paginate_queryset(queryset)
        
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            response = self.get_paginated_response(serializer.data)
            response.data['unread_count'] = unread_count
            return response
            
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            "results": serializer.data,
            "unread_count": unread_count
        }, status=status.HTTP_200_OK)


class NotificationReadView(APIView):
    def post(self, request):
        # Mark all as read
        Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
        return Response({"message": "All notifications marked as read."}, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        # Mark specific notification as read
        notification = get_object_or_404(Notification, id=pk, recipient=request.user)
        notification.is_read = True
        notification.save()
        return Response({"message": "Notification marked as read."}, status=status.HTTP_200_OK)
