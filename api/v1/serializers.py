import re
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.db import models, transaction
from django.conf import settings
from django.core.validators import EmailValidator

from apps.users.models import Follow, FollowRequest
from apps.posts.models import Post, Hashtag, PostHashtag, PostMention
from apps.comments.models import Comment
from apps.likes.models import PostLike, CommentLike
from apps.notifications.models import Notification
from pulse.utils import compress_to_webp

User = get_user_model()

# --- USER SERIALIZERS ---

class UserMiniSerializer(serializers.ModelSerializer):
    """
    Minimal user representation for cards, headers, lists.
    """
    class Meta:
        model = User
        fields = ['id', 'username', 'display_name', 'profile_photo', 'is_private']
        read_only_fields = fields


class UserSerializer(serializers.ModelSerializer):
    is_following = serializers.SerializerMethodField()
    is_following_pending = serializers.SerializerMethodField()
    followers_count = serializers.SerializerMethodField()
    following_count = serializers.SerializerMethodField()
    posts_count = serializers.SerializerMethodField()
    is_self = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'display_name', 'bio', 'website',
            'profile_photo', 'is_private', 'is_verified_email', 'last_active',
            'is_following', 'is_following_pending', 'followers_count',
            'following_count', 'posts_count', 'is_self'
        ]
        read_only_fields = ['id', 'email', 'is_verified_email', 'last_active']

    def get_is_following(self, obj):
        user = self.context.get('request').user if self.context.get('request') else None
        if not user or user.is_anonymous or user == obj:
            return False
        return Follow.objects.filter(follower=user, following=obj, status='ACTIVE').exists()

    def get_is_following_pending(self, obj):
        user = self.context.get('request').user if self.context.get('request') else None
        if not user or user.is_anonymous or user == obj:
            return False
        return Follow.objects.filter(follower=user, following=obj, status='PENDING').exists()

    def get_followers_count(self, obj):
        return Follow.objects.filter(following=obj, status='ACTIVE').count()

    def get_following_count(self, obj):
        return Follow.objects.filter(follower=obj, status='ACTIVE').count()

    def get_posts_count(self, obj):
        return obj.posts.count()

    def get_is_self(self, obj):
        user = self.context.get('request').user if self.context.get('request') else None
        return user == obj


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'confirm_password']

    def validate(self, attrs):
        if attrs['password'] != attrs['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        return attrs

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        password = validated_data.pop('password')
        
        # Set display_name to username by default
        if 'display_name' not in validated_data or not validated_data['display_name']:
            validated_data['display_name'] = validated_data['username']
            
        user = User.objects.create(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ['username', 'display_name', 'bio', 'website', 'email', 'profile_photo', 'is_private', 'password']

    def validate_username(self, value):
        user = self.context['request'].user
        if User.objects.filter(username=value).exclude(id=user.id).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def validate_email(self, value):
        user = self.context['request'].user
        if User.objects.filter(email=value).exclude(id=user.id).exists():
            raise serializers.ValidationError("This email is already in use.")
        return value

    def validate(self, attrs):
        user = self.context['request'].user
        email = attrs.get('email')
        
        # Email change requires password confirmation
        if email and email != user.email:
            password = attrs.get('password')
            if not password:
                raise serializers.ValidationError({"password": "Password confirmation is required to change email."})
            if not user.check_password(password):
                raise serializers.ValidationError({"password": "Incorrect password."})
                
        return attrs

    def update(self, instance, validated_data):
        validated_data.pop('password', None) # remove confirm password
        
        profile_photo = validated_data.get('profile_photo')
        if profile_photo:
            # Compress image to WebP
            validated_data['profile_photo'] = compress_to_webp(profile_photo)
            
        return super().update(instance, validated_data)


# --- FOLLOW SERIALIZERS ---

class FollowRequestSerializer(serializers.ModelSerializer):
    requester = UserMiniSerializer(read_only=True)
    target = UserMiniSerializer(read_only=True)

    class Meta:
        model = FollowRequest
        fields = ['id', 'requester', 'target', 'status', 'created_at']
        read_only_fields = fields


# --- POST SERIALIZERS ---

class PostSerializer(serializers.ModelSerializer):
    author = UserMiniSerializer(read_only=True)
    is_liked = serializers.SerializerMethodField()
    is_own_post = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            'id', 'author', 'image', 'caption', 'comments_disabled',
            'like_count', 'comment_count', 'created_at', 'updated_at',
            'is_liked', 'is_own_post'
        ]
        read_only_fields = ['id', 'author', 'like_count', 'comment_count', 'created_at', 'updated_at']

    def get_is_liked(self, obj):
        user = self.context.get('request').user if self.context.get('request') else None
        if not user or user.is_anonymous:
            return False
        return PostLike.objects.filter(user=user, post=obj).exists()

    def get_is_own_post(self, obj):
        user = self.context.get('request').user if self.context.get('request') else None
        return user == obj.author

    @transaction.atomic
    def create(self, validated_data):
        user = self.context['request'].user
        image = validated_data.get('image')
        
        # Compress image to WebP
        if image:
            validated_data['image'] = compress_to_webp(image)
            
        post = Post.objects.create(author=user, **validated_data)
        
        # Parse hashtags and mentions from caption
        caption = validated_data.get('caption', '')
        self._parse_hashtags_and_mentions(post, caption)
        
        return post

    def _parse_hashtags_and_mentions(self, post, caption):
        if not caption:
            return
            
        # Extract hashtags
        hashtags = set(re.findall(r'#(\w+)', caption))
        for tag in hashtags:
            tag_lower = tag.lower()
            hashtag, created = Hashtag.objects.get_or_create(tag=tag_lower)
            PostHashtag.objects.get_or_create(post=post, hashtag=hashtag)
            # Increment tag counter
            Hashtag.objects.filter(id=hashtag.id).update(post_count=models.F('post_count') + 1)
            
        # Extract mentions
        mentions = set(re.findall(r'@(\w+)', caption))
        for m in mentions:
            try:
                mentioned_user = User.objects.get(username__iexact=m)
                PostMention.objects.get_or_create(post=post, mentioned_user=mentioned_user)
                # Notify mentioned user
                if mentioned_user != post.author:
                    Notification.objects.create(
                        recipient=mentioned_user,
                        actor=post.author,
                        type='MENTION_POST',
                        post=post
                    )
            except User.DoesNotExist:
                pass


# --- COMMENT SERIALIZERS ---

class CommentSerializer(serializers.ModelSerializer):
    author = UserMiniSerializer(read_only=True)
    is_liked = serializers.SerializerMethodField()
    is_own_comment = serializers.SerializerMethodField()
    replies = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = [
            'id', 'post', 'author', 'parent_comment', 'body',
            'like_count', 'is_deleted', 'created_at', 'replies',
            'is_liked', 'is_own_comment'
        ]
        read_only_fields = ['id', 'post', 'author', 'like_count', 'is_deleted', 'created_at']

    def get_is_liked(self, obj):
        user = self.context.get('request').user if self.context.get('request') else None
        if not user or user.is_anonymous:
            return False
        return CommentLike.objects.filter(user=user, comment=obj).exists()

    def get_is_own_comment(self, obj):
        user = self.context.get('request').user if self.context.get('request') else None
        return user == obj.author

    def get_replies(self, obj):
        # Only show replies for top-level comments (1-level nesting)
        if obj.parent_comment is not None:
            return []
        
        replies = obj.replies.filter(is_deleted=False)
        return CommentSerializer(replies, many=True, context=self.context).data

    @transaction.atomic
    def create(self, validated_data):
        user = self.context['request'].user
        post = validated_data.get('post')
        parent_comment = validated_data.get('parent_comment')
        body = validated_data.get('body')
        
        comment = Comment.objects.create(author=user, **validated_data)
        
        # Increment comment counter on post
        Post.objects.filter(id=post.id).update(comment_count=models.F('comment_count') + 1)
        
        # Parse mentions in comment body
        self._parse_mentions(comment, body)
        
        # Notify appropriate parties
        if parent_comment:
            # Notify parent comment author
            if parent_comment.author != user:
                Notification.objects.create(
                    recipient=parent_comment.author,
                    actor=user,
                    type='COMMENT_REPLY',
                    post=post,
                    comment=comment
                )
        else:
            # Notify post author
            if post.author != user:
                Notification.objects.create(
                    recipient=post.author,
                    actor=user,
                    type='COMMENT',
                    post=post,
                    comment=comment
                )
                
        return comment

    def _parse_mentions(self, comment, body):
        if not body:
            return
        mentions = set(re.findall(r'@(\w+)', body))
        for m in mentions:
            try:
                mentioned_user = User.objects.get(username__iexact=m)
                if mentioned_user != comment.author:
                    Notification.objects.create(
                        recipient=mentioned_user,
                        actor=comment.author,
                        type='MENTION_COMMENT',
                        post=comment.post,
                        comment=comment
                    )
            except User.DoesNotExist:
                pass


# --- NOTIFICATION SERIALIZERS ---

class NotificationSerializer(serializers.ModelSerializer):
    actor = UserMiniSerializer(read_only=True)
    post_thumbnail = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = ['id', 'recipient', 'actor', 'type', 'post', 'comment', 'is_read', 'created_at', 'post_thumbnail']
        read_only_fields = fields

    def get_post_thumbnail(self, obj):
        if obj.post and obj.post.image:
            return obj.post.image.url
        return None
